import "server-only";
import { z } from "zod";
import type { ActionCode, ActionResult } from "../../lib/schemas/action-result";
import { getAuthorizedUser } from "../auth";
import { destroyUserSession } from "../db/client";

export class ActionFailure extends Error {
  constructor(
    public readonly code: "VALIDATION" | "GENERATION_FAILED",
    message: string,
  ) {
    super(message);
  }
}

function failure(code: ActionCode, message: string): ActionResult<never> {
  return { ok: false, code, message };
}

export async function runAuthorizedAction<Input, Output>(
  input: unknown,
  schema: z.ZodType<Input>,
  operation: (value: Input, email: string) => Promise<Output>,
  revalidate: (value: Input) => void,
  consumeRateLimit?: (email: string) => Promise<ActionResult<void>>,
): Promise<ActionResult<Output>> {
  let hasSaved = false;

  try {
    const authorization = await getAuthorizedUser();

    if (!authorization.ok) {
      if (authorization.code === "FORBIDDEN") {
        await destroyUserSession();
        return failure(
          "FORBIDDEN",
          "This account does not have access. Nothing was changed.",
        );
      }

      return authorization.code === "UNAUTHENTICATED"
        ? failure(
            "UNAUTHENTICATED",
            "Please sign in and try again. Nothing was changed.",
          )
        : failure(
            "UNEXPECTED",
            "Your session could not be verified. Nothing was changed.",
          );
    }

    const parsed = schema.safeParse(input);

    if (!parsed.success) {
      return {
        ok: false,
        code: "VALIDATION",
        message: "Check the highlighted fields. Nothing was changed.",
        fields: Object.fromEntries(
          parsed.error.issues.map((issue) => [
            String(issue.path[0] ?? "input"),
            issue.message,
          ]),
        ),
      };
    }

    if (consumeRateLimit) {
      const allowance = await consumeRateLimit(authorization.user.email);

      if (!allowance.ok) {
        return allowance;
      }
    }

    const data = await operation(parsed.data, authorization.user.email);
    hasSaved = true;
    revalidate(parsed.data);
    return { ok: true, data };
  } catch (error) {
    const databaseCode =
      typeof error === "object" && error !== null && "code" in error
        ? error.code
        : undefined;
    console.error("Server action failed.", {
      code: typeof databaseCode === "string" ? databaseCode : undefined,
      hasSaved,
    });

    if (hasSaved) {
      return failure(
        "UNEXPECTED",
        "Your changes were saved, but the view could not refresh. Reload the page.",
      );
    }

    if (error instanceof ActionFailure) {
      return failure(
        error.code,
        error.code === "GENERATION_FAILED"
          ? "Generation didn't complete. Nothing was changed."
          : "This change is not allowed. Nothing was changed.",
      );
    }

    return ["P0001", "23514", "23505"].includes(String(databaseCode))
      ? failure(
          "VALIDATION",
          "This change is not allowed. Nothing was changed.",
        )
      : failure(
          "UNEXPECTED",
          "Something went wrong on our side. Nothing was changed.",
        );
  }
}

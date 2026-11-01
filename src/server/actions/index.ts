"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  AddNoteInputSchema,
  MarkPostedInputSchema,
  SkipItemInputSchema,
  type AddNoteInput,
  type MarkPostedInput,
  type SkipItemInput,
} from "../../lib/schemas/actions";
import {
  BrandProfileUpdateSchema,
  type BrandProfileUpdate,
} from "../../lib/schemas/brand-profile";
import { getAuthorizedUser } from "../auth";
import {
  appendActivityNote,
  changeContentStatus,
  updateBrandProfile as saveBrandProfile,
} from "../services";

type ActionCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "VALIDATION"
  | "RATE_LIMITED"
  | "GENERATION_FAILED"
  | "UNEXPECTED";

type ActionResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      code: ActionCode;
      message: string;
      fields?: Record<string, string>;
    };

function failure(
  code: ActionCode,
  message: string,
  fields?: Record<string, string>,
): ActionResult<never> {
  return fields
    ? { ok: false, code, message, fields }
    : { ok: false, code, message };
}

function revalidateContentPaths(itemId: string): void {
  for (const path of [
    "/",
    "/calendar",
    "/create",
    "/archive",
    `/item/${itemId}`,
  ]) {
    revalidatePath(path);
  }
}

function revalidateSettings(): void {
  revalidatePath("/settings");
}

async function runAuthorizedAction<Input, Output>(
  input: unknown,
  schema: z.ZodType<Input>,
  operation: (value: Input, email: string) => Promise<Output>,
  getItemId?: (value: Input) => string,
  revalidate: (value: Input) => void = (value) =>
    getItemId ? revalidateContentPaths(getItemId(value)) : undefined,
): Promise<ActionResult<Output>> {
  try {
    const authorization = await getAuthorizedUser();

    if (!authorization.ok) {
      if (authorization.code === "UNAUTHENTICATED") {
        return failure("UNAUTHENTICATED", "Please sign in and try again.");
      }

      if (authorization.code === "FORBIDDEN") {
        return failure("FORBIDDEN", "This account does not have access.");
      }

      return failure("UNEXPECTED", "Something went wrong on our side.");
    }

    const parsed = schema.safeParse(input);

    if (!parsed.success) {
      const fields = Object.fromEntries(
        parsed.error.issues.map((issue) => [
          String(issue.path[0] ?? "input"),
          issue.message,
        ]),
      );
      return failure("VALIDATION", "Check the highlighted fields.", fields);
    }

    const data = await operation(parsed.data, authorization.user.email);
    revalidate(parsed.data);
    return { ok: true, data };
  } catch (error) {
    console.error("Content action failed.", error);
    const code =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error.code === "P0001" ||
        error.code === "23514" ||
        error.code === "23505")
        ? "VALIDATION"
        : "UNEXPECTED";
    const message =
      code === "VALIDATION"
        ? "This item cannot be moved to that status."
        : "Something went wrong on our side.";
    return failure(code, message);
  }
}

export async function markPosted(
  input: MarkPostedInput,
): Promise<
  ActionResult<{
    posted_at: string | null;
    month_progress: { posted: number; planned: number };
  }>
> {
  return runAuthorizedAction(
    input,
    MarkPostedInputSchema,
    async (value) => {
      const item = await changeContentStatus({
        itemId: value.item_id,
        status: value.posted ? "posted" : "ready",
        note: value.note,
      });

      return {
        posted_at: item.item.posted_at,
        month_progress: item.month_progress,
      };
    },
    (value) => value.item_id,
  );
}

export async function skipItem(
  input: SkipItemInput,
): Promise<ActionResult<{ status: "ready" | "skipped" }>> {
  return runAuthorizedAction(
    input,
    SkipItemInputSchema,
    async (value) => {
      await changeContentStatus({
        itemId: value.item_id,
        status: value.skipped ? "skipped" : "ready",
        skipReason: value.reason,
      });
      return {
        status: value.skipped ? ("skipped" as const) : ("ready" as const),
      };
    },
    (value) => value.item_id,
  );
}

export async function addNote(
  input: AddNoteInput,
): Promise<ActionResult<{ ok: true }>> {
  return runAuthorizedAction(
    input,
    AddNoteInputSchema,
    async (value, email) => {
      await appendActivityNote({
        itemId: value.item_id,
        actorEmail: email,
        note: value.note,
      });
      return { ok: true as const };
    },
    (value) => value.item_id,
  );
}

export async function updateBrandProfile(
  input: BrandProfileUpdate,
): Promise<ActionResult<{ updated_at: string }>> {
  return runAuthorizedAction(
    input,
    BrandProfileUpdateSchema,
    (fields, email) => saveBrandProfile({ fields, actorEmail: email }),
    undefined,
    revalidateSettings,
  );
}

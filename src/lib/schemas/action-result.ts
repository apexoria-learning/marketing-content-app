import { z } from "zod";

export const ActionCodeSchema = z.enum([
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "VALIDATION",
  "RATE_LIMITED",
  "GENERATION_FAILED",
  "UNEXPECTED",
]);

export type ActionCode = z.infer<typeof ActionCodeSchema>;
export type ActionResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      code: ActionCode;
      message: string;
      fields?: Record<string, string>;
      retry_after?: string;
      saved?: true;
    };

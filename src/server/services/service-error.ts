import "server-only";

export class ActionFailure extends Error {
  constructor(
    public readonly code: "VALIDATION" | "GENERATION_FAILED",
    message: string,
    /** Optional user-safe explanation; must say whether data changed. */
    public readonly userMessage?: string,
  ) {
    super(message);
  }
}

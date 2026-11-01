import "server-only";

export class ActionFailure extends Error {
  constructor(
    public readonly code: "VALIDATION" | "GENERATION_FAILED",
    message: string,
  ) {
    super(message);
  }
}

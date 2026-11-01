import { z } from "zod";

export const SignInSearchSchema = z.object({
  error: z.enum(["oauth", "exchange", "session"]).optional().catch(undefined),
  next: z.string().max(2048).optional().catch(undefined),
  notice: z.enum(["signed-out", "local-signout"]).optional().catch(undefined),
});

export const NoAccessSearchSchema = z.object({
  error: z.literal("signout").optional().catch(undefined),
});

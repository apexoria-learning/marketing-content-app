import { isEmailAllowed } from "../../lib/auth/allowlist";

export function isMiddlewareUserAllowed(email: string | null | undefined) {
  return isEmailAllowed(email, process.env.ALLOWED_EMAILS ?? "");
}

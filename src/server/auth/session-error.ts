import "server-only";
import {
  isAuthSessionMissingError,
  type AuthError,
} from "@supabase/supabase-js";

export function isUnauthenticatedError(error: AuthError): boolean {
  return (
    isAuthSessionMissingError(error) ||
    error.status === 401 ||
    [
      "session_not_found",
      "refresh_token_not_found",
      "refresh_token_already_used",
      "bad_jwt",
      "user_not_found",
    ].includes(error.code ?? "")
  );
}

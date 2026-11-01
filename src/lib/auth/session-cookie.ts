export function getAuthCookieOptions(isProduction: boolean) {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  };
}

export function getSessionCookieName(supabaseUrl: string): string {
  return `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`;
}

export function isSessionCookie(
  cookieName: string,
  sessionName: string,
): boolean {
  return (
    cookieName === sessionName ||
    cookieName.startsWith(`${sessionName}.`) ||
    cookieName === `${sessionName}-code-verifier` ||
    cookieName.startsWith(`${sessionName}-code-verifier.`)
  );
}

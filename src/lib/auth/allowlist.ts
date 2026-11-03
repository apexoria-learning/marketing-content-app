export function normalizeEmail(
  email: string | null | undefined,
): string | null {
  return email?.trim().toLowerCase() || null;
}

export function parseEmailList(configuredEmails: string): string[] {
  return configuredEmails
    .split(",")
    .map((address) => address.trim().toLowerCase())
    .filter(Boolean);
}

// An empty list grants nothing: access fails closed (ARCHITECTURE.md §6.2).
export function isEmailListed(
  email: string | null | undefined,
  configuredEmails: string,
): boolean {
  const normalizedEmail = normalizeEmail(email);
  return (
    normalizedEmail !== null &&
    parseEmailList(configuredEmails).includes(normalizedEmail)
  );
}

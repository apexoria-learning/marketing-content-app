export function isEmailAllowed(
  email: string | null | undefined,
  configuredEmails: string,
): boolean {
  const normalizedEmail = email?.trim().toLowerCase();

  if (!normalizedEmail) {
    return false;
  }

  const allowlist = configuredEmails
    .split(",")
    .map((address) => address.trim().toLowerCase())
    .filter(Boolean);

  return allowlist.length === 0 || allowlist.includes(normalizedEmail);
}

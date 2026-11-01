export function parseLocalDatabaseUrl(value) {
  let url;

  try {
    url = new URL(value);
  } catch {
    throw new Error("DATABASE_URL must be a valid local PostgreSQL URL.");
  }

  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
    url.search ||
    url.hash ||
    url.pathname === "/"
  ) {
    throw new Error(
      "Database tests and type generation require an isolated loopback PostgreSQL database; hosted targets are forbidden.",
    );
  }

  return url;
}

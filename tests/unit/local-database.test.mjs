import { describe, expect, it } from "vitest";
import { parseLocalDatabaseUrl } from "../integration/support/local-database.mjs";

describe("isolated database target", () => {
  it.each([
    "postgres://localhost:54322/postgres",
    "postgresql://127.0.0.1:54322/postgres",
    "postgres://[::1]:54322/postgres",
  ])("accepts loopback PostgreSQL: %s", (url) => {
    expect(parseLocalDatabaseUrl(url).toString()).toBe(url);
  });

  it.each([
    "postgres://db.example.test:5432/postgres",
    "postgres://aws-0-ap-south-1.pooler.supabase.com:5432/postgres",
    "https://localhost/postgres",
    "postgres://localhost/postgres?host=db.example.test",
    "postgres://localhost/postgres#fragment",
    "postgres://localhost/",
    "not a url",
  ])("rejects unsafe database targets: %s", (url) => {
    expect(() => parseLocalDatabaseUrl(url)).toThrow();
  });

  it("does not echo credentials in errors", () => {
    expect(() =>
      parseLocalDatabaseUrl("postgres://user:private-value@db.example.test/db"),
    ).toThrow(
      "Database tests and type generation require an isolated loopback PostgreSQL database; hosted targets are forbidden.",
    );
  });
});

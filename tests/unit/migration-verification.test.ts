import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(
  new URL("../../.github/workflows/migrate-development.yml", import.meta.url),
  "utf8",
);
const verification = readFileSync(
  new URL("../../scripts/verify-database.sql", import.meta.url),
  "utf8",
);

describe("hosted migration verification", () => {
  it("requires client TLS and prints connection details in the verification session", () => {
    const step = workflow
      .split("- name: Verify migrated development database")[1]
      ?.split("- name: Show migration history")[0];

    expect(step).toBeDefined();
    expect(step).toContain("PGSSLMODE: require");
    expect(step).toContain(
      "psql --no-psqlrc --set=ON_ERROR_STOP=1 \\\n" +
        "            --command='\\conninfo' --file=scripts/verify-database.sql",
    );
  });

  it("keeps schema checks read-only without mistaking backend TLS for client TLS", () => {
    expect(verification.trim()).toMatch(/^begin read only;/);
    expect(verification.trim()).toMatch(/rollback;$/);
    expect(verification).not.toContain("pg_stat_ssl");
    expect(verification).toContain(
      "Required table is missing or RLS is disabled",
    );
    expect(verification).toContain(
      "Required atomic status function protection is missing",
    );
    expect(verification).toContain(
      "Append-only audit triggers are missing or disabled",
    );
  });
});

import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  collectSecretValues,
  scanClientBundle,
} from "../../scripts/check-client-bundle.mjs";

const PLANTED_SECRET = "pk-live-9f3c1a77b2e84d50";

const createdDirectories = [];

async function createBundle(files) {
  const directory = await mkdtemp(path.join(tmpdir(), "bundle-scan-"));

  createdDirectories.push(directory);

  for (const [relativePath, content] of Object.entries(files)) {
    const filePath = path.join(directory, relativePath);

    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, content, "utf8");
  }

  return directory;
}

afterEach(() => {
  createdDirectories.length = 0;
});

describe("scanClientBundle", () => {
  it("fails when a planted secret value appears in client output", async () => {
    const directory = await createBundle({
      "chunks/app.js": `const token="${PLANTED_SECRET}";`,
    });

    const { violations } = await scanClientBundle({
      directory,
      env: { PORTKEY_API_KEY: PLANTED_SECRET },
    });

    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain("PORTKEY_API_KEY");
  });

  it("finds a planted secret nested in a subdirectory", async () => {
    const directory = await createBundle({
      "chunks/nested/deep/page.js": `x=${JSON.stringify(PLANTED_SECRET)}`,
    });

    const { violations } = await scanClientBundle({
      directory,
      env: { CRON_SECRET: PLANTED_SECRET },
    });

    expect(violations).toHaveLength(1);
  });

  it("fails when a secret variable name is referenced", async () => {
    const directory = await createBundle({
      "chunks/app.js": "const a = process.env.SUPABASE_SERVICE_ROLE_KEY;",
    });

    const { violations } = await scanClientBundle({ directory, env: {} });

    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("passes on a clean bundle", async () => {
    const directory = await createBundle({
      "chunks/app.js": 'const a = "https://project.supabase.co";',
      "css/app.css": ".a{color:var(--accent)}",
    });

    const { checkedFiles, violations } = await scanClientBundle({
      directory,
      env: { PORTKEY_API_KEY: PLANTED_SECRET },
    });

    expect(violations).toEqual([]);
    expect(checkedFiles).toBe(2);
  });

  it("reports a missing bundle directory rather than passing silently", async () => {
    await expect(
      scanClientBundle({ directory: path.join(tmpdir(), "absent-bundle-dir") }),
    ).rejects.toThrow(/Client bundle directory is missing/);
  });
});

describe("collectSecretValues", () => {
  it("ignores values too short to match reliably", () => {
    const secrets = collectSecretValues({
      CRON_SECRET: "short",
      PORTKEY_API_KEY: PLANTED_SECRET,
    });

    expect(secrets.map((secret) => secret.name)).toEqual(["PORTKEY_API_KEY"]);
  });

  it("ignores variables that are not set", () => {
    expect(collectSecretValues({})).toEqual([]);
  });
});

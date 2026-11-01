import { spawnSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import {
  createTestDatabase,
  databaseUrl,
  dropTestDatabase,
} from "../tests/integration/support/database.mjs";

const db = await createTestDatabase();

try {
  const url = new URL(databaseUrl);

  url.pathname = `/${db.scratchDatabaseName}`;

  const result = spawnSync(
    "supabase",
    [
      "gen",
      "types",
      "typescript",
      "--db-url",
      url.toString(),
      "--schema",
      "public",
    ],
    { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 },
  );

  if (
    result.error ||
    result.status !== 0 ||
    !result.stdout.includes("export type Database")
  ) {
    throw new Error(
      "Supabase CLI database type generation failed. Ensure the pinned CLI and Docker are available on the isolated CI runner.",
    );
  }

  await writeFile("src/server/db/database.types.ts", result.stdout, "utf8");
} finally {
  await dropTestDatabase(db);
}

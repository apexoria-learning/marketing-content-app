import { spawnSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { format, resolveConfig } from "prettier";
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

  const filePath = "src/server/db/database.types.ts";
  const config = await resolveConfig(filePath);
  const formatted = await format(result.stdout, {
    ...config,
    filepath: filePath,
  });

  await writeFile(filePath, formatted, "utf8");
} finally {
  await dropTestDatabase(db);
}

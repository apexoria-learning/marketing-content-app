import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

// NFR-2.1 / L3: no secret value may appear in client output.
export const SECRET_NAMES = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "PORTKEY_API_KEY",
  "PORTKEY_VIRTUAL_KEY",
  "CRON_SECRET",
];

export const CLIENT_BUNDLE_DIRECTORY = path.join(".next", "static");

// Short values collide with minified identifiers and produce false positives.
const MINIMUM_SECRET_LENGTH = 8;

export function collectSecretValues(env, secretNames = SECRET_NAMES) {
  return secretNames
    .map((name) => ({ name, value: env[name] }))
    .filter(
      (secret) =>
        typeof secret.value === "string" &&
        secret.value.length >= MINIMUM_SECRET_LENGTH,
    );
}

async function findFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const entryPath = path.join(directory, entry.name);
      return entry.isDirectory() ? findFiles(entryPath) : [entryPath];
    }),
  );

  return nested.flat();
}

export async function scanClientBundle({
  directory = CLIENT_BUNDLE_DIRECTORY,
  env = process.env,
  secretNames = SECRET_NAMES,
} = {}) {
  let files;

  try {
    files = await findFiles(directory);
  } catch (error) {
    throw new Error(
      `Client bundle directory is missing: ${directory}. Run this check after next build.`,
      { cause: error },
    );
  }

  const secrets = collectSecretValues(env, secretNames);
  const violations = [];

  for (const file of files) {
    const content = await readFile(file, "utf8");
    const relativePath = path.relative(process.cwd(), file);

    for (const name of secretNames) {
      if (content.includes(name)) {
        violations.push(`${relativePath} references ${name}`);
      }
    }

    for (const secret of secrets) {
      if (content.includes(secret.value)) {
        violations.push(`${relativePath} contains the value of ${secret.name}`);
      }
    }
  }

  return { checkedFiles: files.length, violations };
}

const isDirectInvocation =
  process.argv[1] !== undefined &&
  pathToFileURL(process.argv[1]).href === import.meta.url;

if (isDirectInvocation) {
  const { checkedFiles, violations } = await scanClientBundle({
    directory: path.resolve(CLIENT_BUNDLE_DIRECTORY),
  });

  if (violations.length > 0) {
    throw new Error(
      `Client bundle secret scan failed:\n${violations.join("\n")}`,
    );
  }

  console.log(
    `Client bundle secret scan passed (${checkedFiles} files checked).`,
  );
}

import "server-only";
import { parseEnv } from "./env-schema";

// Read once, fail fast at boot rather than surfacing `undefined` later
// (ARCHITECTURE.md §11).
export const env = parseEnv(process.env);

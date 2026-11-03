import "server-only";
import type { Env } from "../config/env-schema";
import { env } from "../config/env";
import type { RuntimeConfig } from "../config/runtime";

// The gateway key never leaves the server environment; only the endpoint and
// model alias are admin-editable (ARCHITECTURE.md §11).
export function gatewayConfiguration(
  config: Pick<RuntimeConfig, "aiBaseUrl" | "aiModel">,
): Pick<Env, "PORTKEY_API_KEY" | "PORTKEY_BASE_URL" | "AI_MODEL"> {
  return {
    PORTKEY_API_KEY: env.PORTKEY_API_KEY,
    PORTKEY_BASE_URL: config.aiBaseUrl,
    AI_MODEL: config.aiModel,
  };
}

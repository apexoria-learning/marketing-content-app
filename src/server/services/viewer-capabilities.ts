import "server-only";
import { getAuthorizedUser } from "../auth";
import { env } from "../config/env";
import { getRuntimeConfig } from "../db/settings";

export type ViewerCapabilities = {
  canGenerate: boolean;
  isAdmin: boolean;
  planningHorizonMonths: number;
};

/**
 * What the signed-in viewer may do on this render. Controls only; every
 * action re-checks on the server. An unreadable settings row hides
 * generation rather than offering it (fail closed).
 */
export async function getViewerCapabilities(): Promise<ViewerCapabilities> {
  const authorization = await getAuthorizedUser();
  const user = authorization.ok ? authorization.user : null;
  try {
    const config = await getRuntimeConfig();
    return {
      canGenerate: Boolean(user?.canGenerate && config.aiGenerationEnabled),
      isAdmin: user?.role === "admin",
      planningHorizonMonths: config.planningHorizonMonths,
    };
  } catch (failure) {
    console.error("Runtime settings unavailable; generation hidden.", {
      code:
        typeof failure === "object" && failure !== null && "code" in failure
          ? String(failure.code)
          : undefined,
    });
    return {
      canGenerate: false,
      isAdmin: user?.role === "admin",
      planningHorizonMonths: env.PLANNING_HORIZON_MONTHS,
    };
  }
}

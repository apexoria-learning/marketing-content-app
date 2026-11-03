import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "../../components/shell/AppShell";
import { PillarCatalogueProvider } from "../../components/content/PillarCatalogue";
import { PlatformCatalogueProvider } from "../../components/content/PlatformCatalogue";
import { PwaControls } from "../../features/shell/PwaControls";
import { getAuthorizedUser } from "../../server/auth";
import { getPillarDisplays } from "../../server/services/pillar-display";
import { getPlatformDisplays } from "../../server/services/platform-display";

export default async function AppLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const authorization = await getAuthorizedUser();

  if (!authorization.ok) {
    if (authorization.code === "FORBIDDEN") {
      redirect("/no-access");
    }

    redirect(
      authorization.code === "UNEXPECTED"
        ? "/sign-in?error=session"
        : "/sign-in",
    );
  }

  const [platforms, pillars] = await Promise.all([
    getPlatformDisplays(),
    getPillarDisplays(),
  ]);

  return (
    <PlatformCatalogueProvider platforms={platforms}>
      <PillarCatalogueProvider pillars={pillars}>
        <AppShell prompts={<PwaControls />}>{children}</AppShell>
      </PillarCatalogueProvider>
    </PlatformCatalogueProvider>
  );
}

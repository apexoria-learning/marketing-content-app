"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { PlatformDisplay } from "@/lib/schemas/platforms";

const PlatformCatalogueContext = createContext<readonly PlatformDisplay[]>([]);

// The catalogue is loaded once per request on the server and handed to the
// client here, so badges and labels never hard-code platforms (DESIGN.md §6.2).
export function PlatformCatalogueProvider({
  platforms,
  children,
}: {
  platforms: readonly PlatformDisplay[];
  children?: ReactNode;
}) {
  return (
    <PlatformCatalogueContext.Provider value={platforms}>
      {children}
    </PlatformCatalogueContext.Provider>
  );
}

export function usePlatformCatalogue(): readonly PlatformDisplay[] {
  return useContext(PlatformCatalogueContext);
}

/** Unknown keys (e.g. outside the provider) still render readably. */
export function usePlatformDisplay(key: string): PlatformDisplay {
  return (
    usePlatformCatalogue().find((platform) => platform.key === key) ?? {
      key,
      label: key.replaceAll("_", " "),
      is_enabled: false,
      colour_slot: 0,
      icon: "platform",
    }
  );
}

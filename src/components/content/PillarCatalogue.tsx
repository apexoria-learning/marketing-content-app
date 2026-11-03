"use client";

import { createContext, useContext, type ReactNode } from "react";
import { pillarDisplayFor, type PillarDisplay } from "@/lib/schemas/pillars";

const PillarCatalogueContext = createContext<readonly PillarDisplay[]>([]);

// Loaded once per request on the server and handed to the client here, so
// chips, filters and labels never hard-code pillars (DESIGN.md §6.2).
export function PillarCatalogueProvider({
  pillars,
  children,
}: {
  pillars: readonly PillarDisplay[];
  children?: ReactNode;
}) {
  return (
    <PillarCatalogueContext.Provider value={pillars}>
      {children}
    </PillarCatalogueContext.Provider>
  );
}

export function usePillarCatalogue(): readonly PillarDisplay[] {
  return useContext(PillarCatalogueContext);
}

/** Unknown keys (e.g. outside the provider) still render readably. */
export function usePillarDisplay(key: string): PillarDisplay {
  return pillarDisplayFor(usePillarCatalogue(), key);
}

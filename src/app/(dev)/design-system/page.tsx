import { notFound } from "next/navigation";
import { Gallery } from "./Gallery";

export const metadata = { title: "Design system", robots: { index: false } };

// Development-only component gallery backing the Phase 1 Playwright + axe
// suite. Never served in production.
export default async function DesignSystemPage({
  searchParams,
}: {
  searchParams: Promise<{ theme?: string; generation?: string }>;
}) {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const { theme, generation } = await searchParams;
  return (
    <Gallery
      theme={theme === "light" ? "light" : "dark"}
      generation={
        generation === "auto"
          ? "auto"
          : generation === "true"
            ? "manual"
            : undefined
      }
    />
  );
}

/** A catalogue key suggested from a display name (DATABASE.md §5.12, §5.14). */
export function suggestCatalogueKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^[^a-z]+|_+$/g, "")
    .slice(0, 30);
}

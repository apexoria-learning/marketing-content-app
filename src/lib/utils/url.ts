/**
 * Parses a URL without throwing. Zod 4 still runs `.refine()` after a failed
 * `z.url()` check, so refinements must tolerate input that is not a URL.
 */
export function tryParseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

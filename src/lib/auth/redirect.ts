export function getSafeRedirectPath(value: string | null | undefined): string {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.startsWith("/\\") ||
    value.includes("\\")
  ) {
    return "/";
  }

  try {
    const destination = new URL(value, "https://app.example");

    if (destination.origin !== "https://app.example") {
      return "/";
    }

    return `${destination.pathname}${destination.search}${destination.hash}`;
  } catch {
    return "/";
  }
}

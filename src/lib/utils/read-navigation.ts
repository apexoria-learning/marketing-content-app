import { z } from "zod";

const TAB_PATHS = ["/", "/calendar", "/create", "/archive"] as const;
const TabScrollsSchema = z.partialRecord(
  z.enum(TAB_PATHS),
  z.number().finite().nonnegative(),
);
const ReadFocusSchema = z.enum([
  "calendar-month-next",
  "calendar-month-previous",
  "archive-scope-control",
  "create-scope-control",
  "calendar-filters-apply",
  "create-filters-apply",
  "archive-filters-apply",
]);
const SCROLL_KEY = "apexoria-tab-scrolls";
const FOCUS_KEY = "apexoria-read-focus";

export function readTabScrolls() {
  try {
    const raw = sessionStorage.getItem(SCROLL_KEY);
    const parsed = TabScrollsSchema.parse(raw ? JSON.parse(raw) : {});
    return new Map<string, number>(Object.entries(parsed));
  } catch {
    console.warn("Saved tab scroll positions could not be restored.");
    return new Map<string, number>();
  }
}

export function saveTabScrolls(positions: Map<string, number>) {
  try {
    sessionStorage.setItem(
      SCROLL_KEY,
      JSON.stringify(
        Object.fromEntries(
          TAB_PATHS.map((path) => [path, positions.get(path) ?? 0]),
        ),
      ),
    );
  } catch {
    console.warn("Tab scroll positions could not be saved.");
  }
}

export function rememberReadFocus(value: unknown) {
  const parsed = ReadFocusSchema.safeParse(value);
  if (!parsed.success) {
    console.warn("Read navigation focus target was invalid.");
    return;
  }
  try {
    sessionStorage.setItem(FOCUS_KEY, parsed.data);
  } catch {
    console.warn("Read navigation focus could not be saved.");
  }
}

export function restoreReadFocus() {
  try {
    const raw = sessionStorage.getItem(FOCUS_KEY);
    if (!raw) return;
    const parsed = ReadFocusSchema.safeParse(raw);
    if (!parsed.success) {
      sessionStorage.removeItem(FOCUS_KEY);
      console.warn("Saved read navigation focus target was invalid.");
      return;
    }
    const target = document.getElementById(parsed.data);
    if (!target) return;
    const control =
      target.querySelector<HTMLElement>('[aria-checked="true"]') ?? target;
    control.closest("details")?.setAttribute("open", "");
    control.focus({ preventScroll: true });
    sessionStorage.removeItem(FOCUS_KEY);
  } catch {
    console.warn("Read navigation focus could not be restored.");
  }
}

export function navigateReadPage(
  path: "/calendar" | "/create" | "/archive",
  search: URLSearchParams,
  focus: z.infer<typeof ReadFocusSchema>,
) {
  rememberReadFocus(focus);
  location.assign(`${path}?${search}`);
}

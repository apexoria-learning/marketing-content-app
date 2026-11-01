import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  navigateReadPage,
  readTabScrolls,
  rememberReadFocus,
  restoreReadFocus,
  saveTabScrolls,
} from "../../src/lib/utils/read-navigation";

let stored: Map<string, string>;
const assign = vi.fn();
const getElementById = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  stored = new Map();
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => stored.set(key, value),
    removeItem: (key: string) => stored.delete(key),
  });
  vi.stubGlobal("location", { assign });
  vi.stubGlobal("document", { getElementById });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("full-document read navigation", () => {
  it("persists tab offsets without saving item paths or content", () => {
    saveTabScrolls(
      new Map([
        ["/", 90],
        ["/create", 500],
        ["/item/private-id", 999],
      ]),
    );
    expect(JSON.parse(stored.get("apexoria-tab-scrolls") ?? "{}")).toEqual({
      "/": 90,
      "/create": 500,
      "/calendar": 0,
      "/archive": 0,
    });
    expect(readTabScrolls().get("/create")).toBe(500);
  });
  it.each(["not-json", '{"private-path":20}', '{"/create":-1}'])(
    "logs malformed saved positions instead of trusting %s",
    (raw) => {
      const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
      stored.set("apexoria-tab-scrolls", raw);
      expect(readTabScrolls().size).toBe(0);
      expect(warning).toHaveBeenCalledOnce();
    },
  );
  it("navigates via a document GET and remembers the initiating control", () => {
    navigateReadPage(
      "/calendar",
      new URLSearchParams({ month: "2026-12", platform: "linkedin" }),
      "calendar-month-next",
    );
    expect(assign).toHaveBeenCalledWith(
      "/calendar?month=2026-12&platform=linkedin",
    );
    expect(stored.get("apexoria-read-focus")).toBe("calendar-month-next");
  });
  it("restores selected segment focus without scrolling and reopens filters", () => {
    const focus = vi.fn();
    const setAttribute = vi.fn();
    const selected = { focus, closest: () => ({ setAttribute }) };
    getElementById.mockReturnValue({ querySelector: () => selected });
    rememberReadFocus("archive-scope-control");
    restoreReadFocus();
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(setAttribute).toHaveBeenCalledWith("open", "");
    expect(stored.has("apexoria-read-focus")).toBe(false);
  });
  it("waits for streamed controls to mount before consuming saved focus", () => {
    rememberReadFocus("calendar-month-next");
    getElementById.mockReturnValue(null);
    restoreReadFocus();
    expect(stored.get("apexoria-read-focus")).toBe("calendar-month-next");
    const focus = vi.fn();
    getElementById.mockReturnValue({
      querySelector: () => null,
      closest: () => null,
      focus,
    });
    restoreReadFocus();
    expect(focus).toHaveBeenCalledOnce();
    expect(stored.has("apexoria-read-focus")).toBe(false);
  });
  it("discards invalid focus targets explicitly", () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    stored.set("apexoria-read-focus", "untrusted-target");
    restoreReadFocus();
    expect(getElementById).not.toHaveBeenCalled();
    expect(warning).toHaveBeenCalledOnce();
    expect(stored.has("apexoria-read-focus")).toBe(false);
  });
});

import { describe, expect, it, vi } from "vitest";
import { triggerHaptic } from "@/lib/utils/haptics";

describe("triggerHaptic", () => {
  it("vibrates with the pattern for the requested kind", () => {
    const vibrate = vi.fn(() => true);

    expect(triggerHaptic("light", { vibrate, reducedMotion: false })).toBe(
      true,
    );
    expect(triggerHaptic("error", { vibrate, reducedMotion: false })).toBe(
      true,
    );
    expect(vibrate).toHaveBeenNthCalledWith(1, 10);
    expect(vibrate).toHaveBeenNthCalledWith(2, [30, 40, 30]);
  });

  it("is disabled entirely under reduced motion", () => {
    const vibrate = vi.fn(() => true);

    expect(triggerHaptic("medium", { vibrate, reducedMotion: true })).toBe(
      false,
    );
    expect(vibrate).not.toHaveBeenCalled();
  });

  it("is silently skipped where unsupported or throwing", () => {
    expect(triggerHaptic("light", { reducedMotion: false })).toBe(false);
    expect(
      triggerHaptic("light", {
        vibrate: () => {
          throw new Error("blocked");
        },
        reducedMotion: false,
      }),
    ).toBe(false);
  });

  it("is a no-op during server rendering", () => {
    expect(triggerHaptic("light")).toBe(false);
  });
});

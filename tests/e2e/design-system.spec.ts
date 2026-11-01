import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Phase 1 behaviour + accessibility suite against the dev-only gallery
// (IMPLEMENTATION-PLAN.md Phase 1 tests).
const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function openGallery(page: Page, theme: "dark" | "light" = "dark") {
  await page.goto(`/design-system?theme=${theme}`);
  await expect(
    page.getByRole("heading", { level: 1, name: "Design system" }),
  ).toBeVisible();
}

async function expectNoAxeViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(WCAG_TAGS)
    .analyze();
  expect(
    violations.map(
      (v) => `${v.id}: ${v.nodes.map((n) => n.target).join(" | ")}`,
    ),
  ).toEqual([]);
}

for (const theme of ["dark", "light"] as const) {
  test(`every primitive passes axe in the ${theme} theme`, async ({ page }) => {
    await openGallery(page, theme);
    await expectNoAxeViolations(page);
  });
}

// The strict CSP blocks inline style attributes, so primitives must render
// none server-side. (The browser console is not checked: in development the
// Next.js dev overlay itself trips the CSP on every route.)
test("primitives render no CSP-blocked inline styles", async ({ request }) => {
  const html = await (await request.get("/design-system")).text();

  expect(html.match(/<[a-z-]+[^>]*\sstyle="[^"]*"/gi) ?? []).toEqual([]);
});

test("all interactive targets are at least 44×44", async ({ page }) => {
  await openGallery(page);

  const undersized = await page
    .locator("main")
    .locator("button, a[href], input, textarea, [role=radio]")
    .evaluateAll((elements) =>
      elements
        .map((element) => {
          const box = element.getBoundingClientRect();
          return {
            name:
              element.getAttribute("aria-label") ??
              element.textContent?.trim() ??
              element.tagName,
            width: box.width,
            height: box.height,
          };
        })
        .filter(({ width, height }) => width < 44 || height < 44),
    );

  expect(undersized).toEqual([]);
});

test("Button loading state is busy, disabled and keeps its width", async ({
  page,
}) => {
  await openGallery(page);
  const loading = page.getByRole("button", { name: "Loading" }).first();

  await expect(loading).toHaveAttribute("aria-busy", "true");
  await expect(loading).toBeDisabled();
  const label = loading.locator("span").first();
  await expect(label).toHaveCSS("opacity", "0");
  const [buttonBox, labelBox] = await Promise.all([
    loading.boundingBox(),
    label.boundingBox(),
  ]);
  expect(buttonBox?.width).toBeGreaterThan(labelBox?.width ?? 0);
});

test("BottomSheet traps focus, closes on Escape and restores focus", async ({
  page,
}) => {
  await openGallery(page);
  const trigger = page.getByRole("button", { name: "Open sheet" });

  await trigger.click();
  const sheet = page.getByRole("dialog", { name: "Regenerate" });
  await expect(sheet).toBeVisible();
  await expectNoAxeViolations(page);

  for (let i = 0; i < 6; i += 1) {
    await page.keyboard.press("Tab");
    expect(
      await sheet.evaluate((dialog) => dialog.contains(document.activeElement)),
    ).toBe(true);
  }

  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("BottomSheet close button is a non-gesture dismiss", async ({ page }) => {
  await openGallery(page);
  await page.getByRole("button", { name: "Open sheet" }).click();
  const sheet = page.getByRole("dialog", { name: "Regenerate" });

  await sheet.getByRole("button", { name: "Close" }).click();
  await expect(sheet).toBeHidden();
});

test("StatusTick is a real checkbox with a descriptive label", async ({
  page,
}) => {
  await openGallery(page);
  const tick = page.getByRole("checkbox", {
    name: "Mark Five resume myths as posted",
  });

  await expect(tick).not.toBeChecked();
  await tick.check();
  await expect(tick).toBeChecked();
  await expect(
    page.getByRole("link", { name: /^13\s*posted of 30 this month/i }),
  ).toBeVisible();
  await page.keyboard.press("Space");
  await expect(tick).not.toBeChecked();
});

test("SegmentedControl is a keyboard-operable radiogroup", async ({ page }) => {
  await openGallery(page);
  const group = page.getByRole("radiogroup", { name: "Archive scope" });

  await group.getByRole("radio", { name: "Month" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(group.getByRole("radio", { name: "Quarter" })).toBeChecked();
  await expect(group.getByRole("radio", { name: "Quarter" })).toBeFocused();
});

test("Toast announces politely, errors assertively, one at a time", async ({
  page,
}) => {
  await openGallery(page);

  await page.getByRole("button", { name: "Show toast" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Marked as posted." }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Show error toast" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "put it back" }),
  ).toBeVisible();
  await expect(page.getByText("Marked as posted.")).toHaveCount(0);

  await page.getByRole("button", { name: "Dismiss" }).last().click();
  await expect(page.getByText("put it back")).toHaveCount(0);
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("no transform animation runs and no functionality is lost", async ({
    page,
  }) => {
    await openGallery(page);

    await expect(page.locator("[data-skeleton]")).toHaveCSS(
      "animation-name",
      "none",
    );

    await page.getByRole("button", { name: "Open sheet" }).click();
    const sheet = page.getByRole("dialog", { name: "Regenerate" });
    const transforms = await sheet.evaluate(async (dialog) => {
      const samples: string[] = [];
      for (let i = 0; i < 10; i += 1) {
        samples.push(getComputedStyle(dialog).transform);
        await new Promise((resolve) => setTimeout(resolve, 16));
      }
      return samples;
    });
    expect(new Set(transforms)).toEqual(new Set(["none"]));
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();

    const tick = page.getByRole("checkbox", {
      name: "Mark Five resume myths as posted",
    });
    await tick.check();
    await expect(tick).toBeChecked();
  });
});

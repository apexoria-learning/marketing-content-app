import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("all planned protected routes redirect before rendering content", async ({
  request,
}) => {
  for (const path of [
    "/",
    "/calendar",
    "/create",
    "/archive",
    "/settings",
    "/item/example",
  ]) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(response.headers().location).toContain("/sign-in?next=");
  }
});

test("missing OAuth code fails safely", async ({ request }) => {
  const response = await request.get("/auth/callback", { maxRedirects: 0 });
  expect(response.status()).toBe(302);
  expect(response.headers().location).toContain("/sign-in?error=exchange");
});

for (const theme of ["dark", "light"]) {
  for (const path of ["/sign-in?error=exchange", "/no-access"]) {
    test(`${path} has accessible feedback in ${theme} theme`, async ({
      page,
    }) => {
      await page.goto(path);
      await page.evaluate((value) => {
        document.documentElement.dataset.theme = value;
      }, theme);
      // Next's development overlay adds a portal absent from production.
      await page.locator("nextjs-portal").evaluateAll((portals) => {
        for (const portal of portals) portal.remove();
      });
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollHeight <= window.innerHeight,
        ),
      ).toBe(true);
    });
  }
}

test("sign-in shows pending state and prevents duplicate submissions", async ({
  page,
}) => {
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/sign-in", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    await gate;
    await route.fulfill({ status: 200, body: "" });
  });
  await page.goto("/sign-in");
  const button = page.getByRole("button", { name: "Continue with Google" });
  try {
    await button.click();
    await expect(button).toBeDisabled();
    await expect(button).toHaveAttribute("aria-busy", "true");
  } finally {
    release();
  }
});

test("invalid repeated search params are ignored, not reflected", async ({
  page,
}) => {
  await page.goto(
    "/sign-in?error=private&next=%2Fcalendar&next=https%3A%2F%2Fevil.test",
  );
  await expect(page.locator('input[name="next"]')).toHaveValue("/");
  await expect(page.locator("main").getByRole("alert")).toHaveCount(0);
});

test("successful sign-out has visible confirmation", async ({ page }) => {
  await page.goto("/sign-in?notice=signed-out");
  await expect(page.locator("main").getByRole("status")).toHaveText(
    "You've signed out.",
  );
});

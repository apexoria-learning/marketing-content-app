import { expect, test } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });
test("a production worker serves the public offline shell without private cached content", async ({
  page,
  context,
}) => {
  await page.goto("/sign-in");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect
    .poll(() =>
      page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
    )
    .toBe(true);
  await context.setOffline(true);
  await page.goto("/calendar");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "You're offline.",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Main navigation" }),
  ).toBeVisible();
  expect(
    await page.evaluate(async () =>
      (await caches.keys()).includes("apexoria-private-v1"),
    ),
  ).toBe(false);
});

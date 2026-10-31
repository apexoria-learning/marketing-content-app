import { expect, test } from "@playwright/test";

test("the base route renders the project landing screen", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Morning Briefing" }),
  ).toBeVisible();
  await expect(page.locator("body")).toHaveCSS(
    "background-image",
    /linear-gradient/,
  );
});

test("the health route exposes liveness only", async ({ request }) => {
  const response = await request.get("/api/health");

  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ status: "ok" });
});

test("the web manifest exposes installable app icons", async ({ request }) => {
  const response = await request.get("/manifest.webmanifest");
  const manifest = await response.json();

  expect(response.status()).toBe(200);
  expect(manifest.display).toBe("standalone");
  expect(manifest.icons).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ sizes: "192x192" }),
      expect.objectContaining({ sizes: "512x512", purpose: "maskable" }),
    ]),
  );
});

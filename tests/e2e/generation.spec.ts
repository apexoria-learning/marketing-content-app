import { expect, test, type Page } from "@playwright/test";

async function mockGeneration(
  page: Page,
  response: unknown,
  options: {
    gate?: Promise<void>;
    transportFailure?: boolean;
  } = {},
) {
  let requests = 0;
  await page.route("**/*", async (route) => {
    if (
      route.request().method() !== "POST" ||
      !route.request().headers()["next-action"]
    ) {
      await route.continue();
      return;
    }
    requests++;
    await options.gate;
    if (options.transportFailure) {
      await route.fulfill({
        status: 503,
        contentType: "text/plain",
        body: "Temporary failure",
      });
      return;
    }
    await route.fulfill({
      contentType: "text/x-component",
      body: `0:{"a":"$1","f":"","b":"development"}\n1:${JSON.stringify(response)}\n`,
    });
  });
  return () => requests;
}

test("automatic hydration starts once, progresses, and confirms an update", async ({
  page,
}) => {
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const requests = await mockGeneration(page, { ok: true, data: {} }, { gate });
  await page.goto("/design-system?generation=auto");
  const section = page.getByRole("region", { name: "Generation examples" });
  try {
    await expect(section.getByText(/Researching/)).toBeVisible();
    await expect(section.getByText(/Writing/)).toBeVisible({ timeout: 10000 });
    expect(requests()).toBe(1);
  } finally {
    release();
  }
  await expect(section.getByText("Updated", { exact: true })).toBeVisible();
  expect(requests()).toBe(1);
});

test("regeneration keeps guidance and generation errors inside the sheet", async ({
  page,
}) => {
  const requests = await mockGeneration(page, {
    ok: false,
    code: "GENERATION_FAILED",
    message: "Generation didn't complete. Nothing was changed.",
  });
  await page.goto("/design-system?generation=true");
  await page
    .getByRole("region", { name: "Generation examples" })
    .getByRole("button", { name: "Regenerate", exact: true })
    .click();
  const sheet = page.getByRole("dialog", { name: "Regenerate content" });
  await sheet.getByRole("button", { name: "Use a practical example" }).click();
  await expect(sheet.getByLabel("What should change? (optional)")).toHaveValue(
    "Use a practical example",
  );
  await sheet.getByRole("button", { name: "Regenerate", exact: true }).click();
  await expect(sheet.getByRole("alert")).toHaveText(
    "Generation didn't complete. Nothing was changed.",
  );
  await expect(sheet.getByLabel("What should change? (optional)")).toHaveValue(
    "Use a practical example",
  );
  expect(requests()).toBe(1);
});

test("quota denial opens the reset-time sheet without a retry loop", async ({
  page,
}) => {
  const requests = await mockGeneration(page, {
    ok: false,
    code: "RATE_LIMITED",
    message: "Today's allowance has been used.",
    retry_after: "2026-11-02T18:30:00.000Z",
  });
  await page.goto("/design-system?generation=true");
  await page
    .getByRole("button", { name: "Generate content", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Today's generation allowance is used" }),
  ).toBeVisible();
  expect(requests()).toBe(1);
});

test("unknown transport outcomes require a reload before another request", async ({
  page,
}) => {
  const requests = await mockGeneration(page, null, { transportFailure: true });
  await page.goto("/design-system?generation=true");
  const button = page.getByRole("button", {
    name: "Generate content",
    exact: true,
  });
  await button.click();
  await expect(
    page
      .getByRole("region", { name: "Generation examples" })
      .getByRole("alert"),
  ).toHaveText("Couldn't confirm generation. Reload before trying again.");
  await expect(button).toBeDisabled();
  expect(requests()).toBe(1);
});

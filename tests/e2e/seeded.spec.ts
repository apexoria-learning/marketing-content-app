import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { z } from "zod";
import { FormatSchema } from "../../src/lib/schemas/content";

const formatFixtures =
  process.env.RUN_SEEDED_E2E === "true"
    ? z
        .array(z.object({ id: z.uuid(), format: FormatSchema }))
        .parse(
          JSON.parse(
            readFileSync("test-results/content-fixtures.json", "utf8"),
          ),
        )
    : [];

test.describe("isolated, genuinely authenticated content journeys", () => {
  test.skip(
    process.env.RUN_SEEDED_E2E !== "true",
    "Requires isolated Supabase CI; never runs against hosted data.",
  );
  for (const fixture of formatFixtures) {
    test(`${fixture.format} detail renders real body data with readable, verbatim text`, async ({
      page,
    }) => {
      await page.goto(`/item/${fixture.id}`);
      const labels = {
        carousel: "All slides",
        reel: /Script ·/,
        post: "Visual concept",
        story: "Story frame",
        meme: "Meme text",
        poll: "Poll",
      };
      const body = page
        .getByRole("region", {
          name: labels[fixture.format],
          exact: fixture.format !== "reel",
        })
        .locator("p")
        .first();
      await expect(body).toBeVisible();
      expect(
        await body.evaluate((element) =>
          Number.parseFloat(getComputedStyle(element).fontSize),
        ),
      ).toBeGreaterThanOrEqual(16);
      await expect(body).toHaveCSS("white-space", "pre-wrap");
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    });
  }

  for (const path of ["/", "/calendar", "/create", "/archive"]) {
    test(`${path} renders real content accessibly at 320px, in both themes`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 320, height: 844 });
      await page.goto(path);
      await expect(
        page.getByRole("navigation", { name: "Main navigation" }),
      ).toBeVisible();
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(
        page.getByRole("navigation").locator('a[aria-current="page"]'),
      ).toHaveCount(1);
      for (const theme of ["dark", "light"]) {
        await page.evaluate((value) => {
          document.documentElement.dataset.theme = value;
        }, theme);
        const { violations } = await new AxeBuilder({ page }).analyze();
        expect(
          violations.map((value) => ({
            id: value.id,
            targets: value.nodes.map((node) => node.target),
          })),
        ).toEqual([]);
      }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.evaluate(() => {
        document.documentElement.style.fontSize = "200%";
      });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    });
  }

  test("Calendar provides a narrow agenda, wider grid, and accessible day sheet", async ({
    page,
  }) => {
    await page.goto("/calendar");
    await expect(
      page.getByRole("list", { name: "Month agenda" }),
    ).toBeVisible();
    await page
      .getByRole("list", { name: "Month agenda" })
      .getByRole("button")
      .first()
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await page.setViewportSize({ width: 400, height: 844 });
    await expect(page.getByLabel("Month grid")).toBeVisible();
    const undersized = await page
      .getByLabel("Month grid")
      .locator("button")
      .evaluateAll(
        (buttons) =>
          buttons.filter((button) => {
            const box = button.getBoundingClientRect();
            return box.width < 44 || box.height < 44;
          }).length,
      );
    expect(undersized).toBe(0);
    await page.getByRole("button", { name: "Next month" }).click();
    await expect(page).toHaveURL(/month=/);
    await expect(
      page.getByRole("button", { name: "Previous month" }),
    ).toBeVisible();
  });

  test("Create puts overdue rows before fixed-order format groups and validates filters", async ({
    page,
  }) => {
    await page.goto("/create");
    const headings = await page.locator("main section > h2").allTextContents();
    expect(headings[0]).toContain("Overdue");
    const order = ["Carousels", "Reels", "Posts", "Stories", "Memes", "Polls"];
    const positions = headings
      .slice(1)
      .map((heading) =>
        order.findIndex((format) => heading.startsWith(format)),
      );
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    await page.goto("/create?format=%3Cscript%3E&platform=invalid");
    await expect(
      page.getByRole("heading", { level: 1, name: "Create" }),
    ).toBeVisible();
    await page.locator("summary", { hasText: "Filters" }).click();
    await expect(page.getByLabel("Format", { exact: true })).toHaveValue("");
  });

  test("Archive all-scope pages contain exactly 30 unique rows and malformed cursors restart", async ({
    page,
  }) => {
    await page.goto("/archive?scope=all&cursor=invalid!");
    await expect(page.locator("main article")).toHaveCount(30);
    const first = await page
      .locator("main article a")
      .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
    await page.getByRole("link", { name: "Next 30 posts" }).click();
    await expect(page.locator("main article")).toHaveCount(30);
    const second = await page
      .locator("main article a")
      .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
    expect(second.some((href) => first.includes(href))).toBe(false);
    await page.getByRole("link", { name: "Next 30 posts" }).click();
    expect(await page.locator("main article").count()).toBeGreaterThan(0);
  });

  test("J1: read, copy, post, progress, reload, history and undo", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/");
    const checkbox = page
      .locator("main article input[type=checkbox]:not([disabled])")
      .first();
    const label = await checkbox.getAttribute("aria-label");
    const card = page
      .locator("main article")
      .filter({ has: page.getByRole("checkbox", { name: label ?? "" }) });
    const href = await card.locator("a").getAttribute("href");
    expect(href).toMatch(/^\/item\//);
    const before = Number(
      await page
        .locator('main a[href="/calendar"] .text-h3')
        .first()
        .textContent(),
    );
    await card.locator("a").click();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page
      .getByRole("button", { name: "Copy Caption", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Copied Caption", exact: true }),
    ).toBeVisible();
    const authored = await page
      .getByRole("region", { name: "Caption", exact: true })
      .locator("p")
      .first()
      .textContent();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      authored,
    );
    await page.getByRole("checkbox").check();
    await expect(page.getByRole("checkbox")).toBeChecked();
    await expect(
      page.getByText("Marked as posted.", { exact: true }),
    ).toBeVisible();
    await page.reload();
    await expect(page.getByRole("checkbox")).toBeChecked();
    await expect(page.getByText(/ready → posted/)).toBeVisible();
    await page.goto("/");
    await expect(
      page.locator('main a[href="/calendar"] .text-h3').first(),
    ).toHaveText(String(before + 1));
    await page.goto(href ?? "/");
    await page.getByRole("checkbox").uncheck();
    await expect(
      page.getByText("Returned to ready.", { exact: true }),
    ).toBeVisible();
    await page.reload();
    await expect(page.getByText(/posted → ready/)).toBeVisible();
  });

  test("unsupported clipboard offers selectable verbatim text", async ({
    page,
  }) => {
    await page.addInitScript(() =>
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: undefined,
      }),
    );
    await page.goto("/create");
    const href = await page
      .locator("main li:has(input:not([disabled])) a")
      .first()
      .getAttribute("href");
    await page.goto(href ?? "/");
    await page
      .getByRole("button", { name: "Select all Caption", exact: true })
      .click();
    const text = await page
      .getByRole("region", { name: "Caption", exact: true })
      .locator("p")
      .first()
      .textContent();
    expect(await page.evaluate(() => getSelection()?.toString())).toBe(text);
  });

  test("optimistic tick and ring roll back after an unconfirmed transport failure", async ({
    page,
  }) => {
    await page.goto("/");
    const ring = page.locator('main a[href="/calendar"] .text-h3').first();
    const before = Number(await ring.textContent());
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/*", async (route) => {
      if (
        route.request().method() === "POST" &&
        route.request().headers()["next-action"]
      ) {
        await gate;
        await route.fulfill({
          status: 503,
          contentType: "text/plain",
          body: "Temporary failure",
        });
      } else await route.continue();
    });
    const tick = page.locator("main article input:not([disabled])").first();
    try {
      await tick.check();
      await expect(ring).toHaveText(String(before + 1));
    } finally {
      release();
    }
    await expect(
      page.getByText("Couldn't confirm the save. Reload before trying again.", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(tick).not.toBeChecked();
    await expect(ring).toHaveText(String(before));
  });

  test("Undo toast reverses a successful save and survives reload", async ({
    page,
  }) => {
    await page.goto("/");
    const tick = page.locator("main article input:not([disabled])").first();
    await tick.check();
    await expect(
      page.getByText("Marked as posted.", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect(
      page.getByText("Returned to ready.", { exact: true }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.locator("main article input:not([disabled])").first(),
    ).not.toBeChecked();
  });

  test("note append and reversible skip remain in history, not the posted-only archive", async ({
    page,
  }) => {
    await page.goto("/create");
    const href = await page
      .locator("main li:has(input:not([disabled])) a")
      .first()
      .getAttribute("href");
    await page.goto(href ?? "/");
    await page.getByRole("button", { name: "Add note", exact: true }).click();
    await page
      .getByRole("textbox", { name: "Note", exact: true })
      .fill("Designer handoff verified");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(
      page.getByText("Designer handoff verified", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Skip item", exact: true }).click();
    await page
      .getByRole("textbox", { name: "Reason (optional)", exact: true })
      .fill("Timing changed");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Skip reason: Timing changed")).toBeVisible();
    await page.reload();
    await expect(
      page.getByText("Designer handoff verified", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Return to ready", exact: true })
      .click();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Skip reason: Timing changed")).toHaveCount(0);
  });

  test("cached HTML works offline, writes are refused, and sign-out removes private reads", async ({
    page,
    context,
  }) => {
    await page.goto("/");
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await expect
      .poll(async () =>
        page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
      )
      .toBe(true);
    await page.reload();
    await expect
      .poll(async () =>
        page.evaluate(async () =>
          Boolean(
            await (
              await caches.open("apexoria-private-v1")
            ).match(location.href),
          ),
        ),
      )
      .toBe(true);
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(
      page.getByText(
        "You're offline. Previously loaded pages are available; changes need a connection.",
      ),
    ).toBeVisible();
    const checkbox = page.locator("main article input:not([disabled])").first();
    if (await checkbox.count()) {
      await checkbox.click();
      await expect(
        page.getByText("You're offline. This needs a connection.", {
          exact: true,
        }),
      ).toBeVisible();
    }
    await context.setOffline(false);
    await page.reload();
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(page).toHaveURL(/\/sign-in/);
    await expect
      .poll(async () =>
        page.evaluate(
          async () => !(await caches.keys()).includes("apexoria-private-v1"),
        ),
      )
      .toBe(true);
    await context.setOffline(true);
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "You're offline.", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Today's content", { exact: false }),
    ).toHaveCount(0);
  });
});

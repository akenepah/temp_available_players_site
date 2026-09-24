import { expect, test, type Page } from "@playwright/test";
import { FIXTURE_SNAPSHOT } from "../fixtures/pool";

// The fixture is served by interception, so these specs never depend on
// whatever snapshot is (or is not yet) committed in public/data/.
async function serveFixture(page: Page) {
  await page.route("**/data/available-players.json", (route) => route.fulfill({ json: FIXTURE_SNAPSHOT }));
}

test.describe("Available Players", () => {
  test("renders publicly at / with no sign-in", async ({ page }) => {
    await serveFixture(page);
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: "Available Players" })).toBeVisible();
    await expect(page.getByRole("table").first()).toBeVisible();
    await expect(page.getByText(/sign in/i)).toHaveCount(0);
  });

  test("/available-players redirects to /", async ({ page }) => {
    await serveFixture(page);
    await page.goto("/available-players");
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("shows the unavailable state, inside the page chrome, when no snapshot is published", async ({ page }) => {
    await page.route("**/data/available-players.json", (route) => route.fulfill({ status: 404, body: "" }));
    await page.goto("/");
    await expect(page.getByRole("alert").filter({ hasText: "Player pool unavailable" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});

test.describe("desktop", () => {
  test.skip(({ isMobile }) => isMobile, "desktop composition");

  test("profile drawer overlays the list without reflowing it", async ({ page }) => {
    await serveFixture(page);
    await page.goto("/");
    const table = page.getByRole("table");
    const before = await table.boundingBox();
    await page.getByRole("row", { name: /Kirill Kaprizov/ }).getByText("The Offensive Otters").click();
    const drawer = page.getByRole("dialog", { name: /Kirill Kaprizov/ });
    await expect(drawer).toBeVisible();
    const box = (await drawer.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(440);
    expect(box.width).toBeLessThanOrEqual(480);
    expect(box.x + box.width).toBeCloseTo(page.viewportSize()!.width, 0);
    expect(await table.boundingBox()).toEqual(before);
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
  });

  test("search field shows a visible keyboard focus state", async ({ page }) => {
    await serveFixture(page);
    await page.goto("/");
    await page.getByRole("button", { name: "Goalies" }).focus();
    await page.keyboard.press("Tab");
    const search = page.getByLabel("Search players");
    await expect(search).toBeFocused();
    const outline = await search.evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(outline).toBe("solid");
  });
});

test.describe("mobile", () => {
  test.skip(({ isMobile }) => !isMobile, "mobile composition");

  test("keeps stats reachable by horizontal scroll with the player column pinned", async ({ page }) => {
    await serveFixture(page);
    await page.goto("/");
    const scroller = page.getByRole("region", { name: /Player statistics/ });
    await expect(scroller).toBeVisible();
    const { scrollWidth, clientWidth } = await scroller.evaluate((el) => ({ scrollWidth: el.scrollWidth, clientWidth: el.clientWidth }));
    expect(scrollWidth).toBeGreaterThan(clientWidth);
    await expect(page.getByRole("columnheader", { name: "BLK" })).toBeAttached();
    // The page itself never scrolls horizontally.
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });

  test("Back from the full-screen profile restores the list and scroll position", async ({ page }) => {
    await serveFixture(page);
    await page.goto("/");
    await page.getByRole("button", { name: /^Next/ }).click();
    const target = page.getByRole("button", { name: "Connor Bedard, open player profile" });
    await target.scrollIntoViewIfNeeded();
    const scrollY = await page.evaluate(() => window.scrollY);
    await target.click();
    const sheet = page.getByRole("dialog", { name: /Connor Bedard/ });
    await expect(sheet).toBeVisible();
    const box = (await sheet.boundingBox())!;
    expect(box.width).toBe(390);
    await sheet.getByRole("button", { name: "‹ Back" }).click();
    await expect(sheet).toBeHidden();
    await expect(page.getByText("Showing 7–12 of 119 skaters")).toBeVisible();
    expect(Math.abs((await page.evaluate(() => window.scrollY)) - scrollY)).toBeLessThan(2);
  });
});

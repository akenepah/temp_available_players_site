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

  test("publishes social share metadata with the approved share image", async ({ page, request }) => {
    await serveFixture(page);
    await page.goto("/");
    const meta = (selector: string) => page.locator(selector).getAttribute("content");
    expect(await page.title()).toBe("Available Players | Farm to Fame");
    expect(await meta('meta[property="og:title"]')).toBe("Available Players | Farm to Fame");
    expect(await meta('meta[property="og:description"]')).toContain("142 returning players");
    expect(await meta('meta[property="og:url"]')).toBe("https://players.farmtofame.com");
    expect(await meta('meta[name="twitter:card"]')).toBe("summary_large_image");
    const image = await meta('meta[property="og:image"]');
    expect(image).toBe("https://players.farmtofame.com/brand/og-available-players.jpg");
    expect(await page.locator('link[rel="canonical"]').getAttribute("href")).toBe("https://players.farmtofame.com");
    const asset = await request.get("/brand/og-available-players.jpg");
    expect(asset.status()).toBe(200);
    expect(asset.headers()["content-type"]).toContain("image/jpeg");
  });

  test("tiles the paper texture behind the entire page and uses the mountain hero artwork", async ({ page }) => {
    await serveFixture(page);
    await page.goto("/");
    const background = await page.evaluate(() => {
      const style = getComputedStyle(document.documentElement);
      return { image: style.backgroundImage, repeat: style.backgroundRepeat, body: getComputedStyle(document.body).backgroundColor };
    });
    expect(background.image).toContain("/brand/paper-texture.webp");
    expect(background.repeat).toBe("repeat");
    expect(background.body).toBe("rgba(0, 0, 0, 0)");
    await expect(page.locator(".hero__mountains")).toBeVisible();
    await expect(page.locator(".hero__collage")).toHaveCount(0);
    const mountains = await page.locator(".hero__mountains").evaluate((el) => getComputedStyle(el).backgroundImage);
    expect(mountains).toContain("/brand/mountain-engraving.webp");
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

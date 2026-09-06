import { expect, type Locator } from "@playwright/test";

export async function expectFunctionalTitles(titles: Locator) {
  await expect(titles.first()).toBeVisible();
  await titles.first().evaluate(async () => { await document.fonts.ready; });
  for (const title of await titles.all()) {
    await expect(title).toHaveCSS("font-family", /^"Noto Sans SC Variable",/);
    await expect(title).toHaveCSS("font-weight", "600");
  }
}

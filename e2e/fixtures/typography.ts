import { expect, test as base, type Locator } from "@playwright/test";

export async function expectFunctionalTitles(titles: Locator) {
  await expect(titles.first()).toBeVisible();
  await titles.first().evaluate(async () => { await document.fonts.ready; });
  for (const title of await titles.all()) {
    await expect(title).toHaveCSS("font-family", "system-ui, sans-serif");
    await expect(title).toHaveCSS("font-weight", "600");
  }
}

/** 在代表性页面全程监听；同时拒绝改名后的界面字体下载。 */
export const test = base.extend<{ systemFontGuard: void }>({
  systemFontGuard: [async ({ page }, use) => {
    const requests: string[] = [];
    page.on("request", (request) => {
      const url = new URL(request.url());
      const name = decodeURIComponent(url.pathname).split("/").pop() ?? "";
      if (/noto|lxgw|wenkai|nunito|fonts\.css/i.test(url.pathname)
        || ((request.resourceType() === "font" || /\.(woff2?|ttf|otf|eot)$/i.test(name))
          && !/^(KaTeX_[\w-]+|Material(?:Icons|Symbols)[\w-]*)(\.[\w-]+)?\.(woff2?|ttf|otf|eot)$/i.test(name))) requests.push(url.origin + url.pathname);
    });
    await use();
    await expect(page.locator("body")).toHaveCSS("font-family", "system-ui, sans-serif");
    const utility = page.locator(".font-utility").first();
    if (await utility.count()) {
      await expect(utility).toHaveCSS("font-family", "system-ui, sans-serif");
      await expect(utility).toHaveCSS("font-variant-numeric", "tabular-nums");
    }
    expect(requests, "页面不得请求已移除的界面字体或 fonts.css").toEqual([]);
  }, { auto: true }],
});

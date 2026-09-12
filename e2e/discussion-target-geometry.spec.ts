import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import ts from "typescript";

// 在真实浏览器中执行同一生产定位函数，独立验证几何而非只检查调用参数。
const source = readFileSync("src/lib/discussion-target-reveal.ts", "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
async function locate(page: Page) {
  await page.addScriptTag({ content: `(() => { const exports = {}; ${compiled}; exports.startDiscussionTargetReveal("target"); })();` });
}
async function fixture(page: Page, height: number, tail: number, before = 1400, bar = false) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.setContent(`<style>body{margin:0}#target{scroll-margin-top:24px;height:${height}px;background:#eee}#before{height:${before}px}#tail{height:${tail}px}</style>
    <div id="before"></div>${bar ? '<div data-slot="thread-reading-bar-anchor" style="position:sticky;top:8px;height:0"><nav data-slot="thread-reading-bar" style="height:56px;background:white">阅读导航</nav></div>' : ''}
    <section id="target"><div>作者头像 · 楼层号</div><p>正文开头</p></section><div id="tail"></div>`);
  await locate(page);
}
for (const height of [80, 900, 3600]) {
  for (const tail of [0, 1500]) {
    for (const bar of [false, true]) {
      test(`开头、自然末尾与吸顶：高度 ${height}，后续 ${tail}，阅读栏 ${bar}`, async ({ page }) => {
        await fixture(page, height, tail, 1400, bar);
        const ideal = bar ? 88 : 24;
        const expected = Math.max(ideal, 900 - height - tail);
        await expect.poll(() => page.locator("#target").evaluate((element) => element.getBoundingClientRect().top)).toBeCloseTo(expected, 0);
        await expect(page.getByText("作者头像 · 楼层号")).toBeInViewport();
      });
    }
  }
}
test("整页不足一屏维持自然排版", async ({ page }) => {
  await fixture(page, 80, 0, 80);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  expect(await page.locator("#target").evaluate((element) => element.getBoundingClientRect().top)).toBe(80);
});
test("图片撑高、分页前插、阅读栏迟到和缩放后仍对齐，拖动后释放", async ({ page }) => {
  await fixture(page, 1800, 1500);
  const top = () => page.locator("#target").evaluate((element) => element.getBoundingClientRect().top);
  await expect.poll(top).toBe(24);
  await page.locator("#before").evaluate((element) => { (element as HTMLElement).style.height = "2200px"; });
  await expect.poll(top).toBe(24);
  await page.locator("#target").evaluate((element) => {
    const before = document.createElement("div"); before.style.height = "900px"; element.before(before);
    const anchor = document.createElement("div"); anchor.dataset.slot = "thread-reading-bar-anchor";
    anchor.style.cssText = "position:sticky;top:8px;height:0";
    anchor.innerHTML = '<nav data-slot="thread-reading-bar" style="height:56px">阅读导航</nav>';
    element.before(anchor);
  });
  await expect.poll(top).toBe(88);
  await page.setViewportSize({ width: 1024, height: 700 });
  await expect.poll(top).toBe(88);
  await page.mouse.wheel(0, 200);
  await expect.poll(top).toBeLessThan(0);
  const offset = await page.evaluate(() => window.scrollY);
  await page.locator("#target").evaluate((element) => { (element as HTMLElement).style.height = "2400px"; });
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => window.scrollY)).toBe(offset);
});

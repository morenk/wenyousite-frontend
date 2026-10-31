import { mkdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { expect } from "@playwright/test";
import { test } from "./fixtures/isolation";
import { evidenceSource } from "../scripts/source-evidence.mjs";

test("共用进度使用真实数值并减少布局，保留减少动画、明暗画面与帧数据", async ({ page, browserName }) => {
  await page.goto("/login");
  await expect(page.getByRole("button", { name: "登录", exact: true })).toBeVisible();
  // Playwright 会把 TSX 转成自己的组件标记；使用原生 React SSR 渲染真实组件。
  const markup = execFileSync(process.execPath, ["--import", "tsx", "e2e/fixtures/motion-progress-markup.ts"], {
    encoding: "utf8", env: { PATH: process.env.PATH, NODE_ENV: "production" },
  });
  // 仅合成组件，无账号、正文或网络写入；CSS 来自真实候选。
  await page.evaluate((html) => { document.body.innerHTML = html; }, markup);
  const root = page.getByRole("progressbar", { name: "正在上传图片" });
  const indicator = root.locator('[data-slot="progress-indicator"]');
  await expect(root).toHaveAttribute("aria-valuenow", "25");
  const styles = await indicator.evaluate((node) => ({ transition: getComputedStyle(node).transitionProperty, width: (node as HTMLElement).style.width }));
  expect(styles.width).toBe("100%");
  const properties = styles.transition.split(/,\s*/u);
  expect(properties).toContain("transform");
  expect(properties.every((property) => ["transform", "translate", "scale", "rotate"].includes(property))).toBe(true);
  const directory = join(process.cwd(), ".e2e-results", `motion-${process.env.E2E_RUN_ID}`);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  for (const theme of ["light", "dark"]) {
    for (const width of [1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate((theme) => { document.documentElement.classList.toggle("dark", theme === "dark"); document.documentElement.dataset.theme = theme; }, theme);
      await page.screenshot({ path: join(directory, `${theme}-${width}.png`) });
    }
  }
  if (browserName === "chromium") {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Performance.enable");
    const metrics = async () => Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map(({ name, value }) => [name, value]));
    const samples = [];
    for (const mode of ["width", "transform"]) {
      await indicator.evaluate((node, mode) => {
        const style = (node as HTMLElement).style;
        style.transitionProperty = mode;
        style.width = "100%"; style.transform = "none";
      }, mode);
      const before = await metrics();
      const frames = await indicator.evaluate(async (node, mode) => {
        const frames: number[] = [];
        let last = performance.now();
        for (let i = 1; i <= 40; i++) {
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
          const now = performance.now(); frames.push(now - last); last = now;
          const style = (node as HTMLElement).style;
          if (mode === "width") style.width = `${i * 2.5}%`;
          else style.transform = `scaleX(${i / 40})`;
        }
        return frames;
      }, mode);
      const after = await metrics();
      samples.push({ mode, layouts: after.LayoutCount - before.LayoutCount, framesMs: frames });
    }
    writeFileSync(join(directory, "progress-metrics.json"), JSON.stringify({
      ...evidenceSource(), runId: process.env.E2E_RUN_ID, candidateId: process.env.WENYOU_E2E_CANDIDATE_ID,
      buildSha256: process.env.E2E_FONT_WEB_BUILD_SHA256, browser: page.context().browser()?.version(),
      viewport: { width: 1440, height: 900 }, samples,
    }, null, 2));
    expect(samples[1].layouts).toBeLessThan(samples[0].layouts);
    await cdp.detach();
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(await indicator.evaluate((node) => parseFloat(getComputedStyle(node).transitionDuration))).toBeLessThan(0.001);
  await expect(page.getByRole("progressbar", { name: "正在处理图片" })).not.toHaveAttribute("aria-valuenow");
});

/** 匿名、本地纯 UI 验证；业务 API 一律拦截，不能代替隔离写入 E2E。 */
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
const base = new URL(process.env.TOOLBOX_BASE_URL ?? "http://127.0.0.1:3137");
if (!["127.0.0.1", "localhost"].includes(base.hostname)) throw new Error("仅允许本任务 loopback 开发页");
const output = resolve(".artifacts/text-toolbox");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const theme of ["light", "dark"]) {
    for (const [size, viewport] of Object.entries({ desktop: { width: 1280, height: 960 }, narrow: { width: 390, height: 844 } })) {
      const context = await browser.newContext({ viewport, colorScheme: theme });
      const business = [];
      await context.route("**/api/**", async (route) => {
        business.push({ method: route.request().method(), path: new URL(route.request().url()).pathname });
        await route.fulfill({ status: 401, contentType: "application/json", body: '{"code":401,"message":"匿名工具验证禁止业务请求"}' });
      });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      const documentRequests = [];
      page.on("request", (request) => { if (request.isNavigationRequest()) documentRequests.push(request.url()); });
      await page.goto(`${base.origin}/tools/embed?theme=${theme}`, { waitUntil: "networkidle" });
      assert.equal(await page.locator("html").getAttribute("data-theme"), theme);
      assert.equal(await page.getByRole("navigation").count(), 0);
      await page.screenshot({ path: `${output}/${size}-${theme}-index.png`, fullPage: true });
      await page.getByRole("link", { name: /文字竖排/ }).click();
      await page.waitForURL(`**/tools/embed/vertical?theme=${theme}`);
      assert(documentRequests.some((url) => url.endsWith(`/tools/embed/vertical?theme=${theme}`)), "嵌入页必须主文档导航");
      for (const tool of ["vertical", "morse", "fancy", "names"]) {
        await page.goto(`${base.origin}/tools/embed/${tool}?theme=${theme}`, { waitUntil: "networkidle" });
        if (tool === "names") {
          await page.getByLabel("固定姓氏（可选）").fill("林");
          await page.getByRole("button", { name: "生成名字" }).click();
          await page.waitForFunction(() => document.querySelector('textarea[aria-label="生成结果"]')?.value.length > 0);
          assert((await page.getByLabel("生成结果").inputValue()).split("\n").every((name) => name.startsWith("林")));
        } else {
          await page.getByLabel(tool === "morse" ? "文字或摩斯码" : "输入文字").fill(tool === "vertical" ? "山海有信，温油相逢。\n为故事留一盏灯。" : tool === "morse" ? "SOS 2026" : "Wenyou, write your story.");
          await page.getByRole("button", { name: "生成文字" }).click();
          await page.waitForFunction(() => document.querySelector('textarea[aria-label="生成结果"]')?.value.length > 0);
          if (tool === "morse") assert.equal(await page.getByLabel("生成结果").inputValue(), "... --- ... / ..--- ----- ..--- -....");
        }
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${size}/${tool} 横向溢出`);
        await page.screenshot({ path: `${output}/${size}-${theme}-${tool}.png`, fullPage: true });
      }
      await page.getByRole("link", { name: "全部工具" }).click();
      await page.waitForURL(`**/tools/embed?theme=${theme}`);
      assert(documentRequests.filter((url) => url.endsWith(`/tools/embed?theme=${theme}`)).length >= 2, "目录返回必须主文档导航");
      assert.deepEqual(business, [], "嵌入页零业务请求");
      assert.deepEqual(errors, [], "页面无未处理错误");
      results.push({ theme, size, viewport, embeddedBusinessRequests: business.length, fullDocumentNavigation: true });
      await context.close();
    }
  }
  const interactionContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const attemptedApis = [];
  await interactionContext.route("**/api/**", async (route) => { attemptedApis.push(route.request().url()); await route.abort(); });
  const interaction = await interactionContext.newPage();
  const choose = async (label, option) => {
    await interaction.getByRole("combobox", { name: label, exact: true }).click();
    await interaction.getByRole("option", { name: option, exact: true }).click();
  };
  await interaction.goto(`${base.origin}/tools/embed/names?theme=dark`, { waitUntil: "networkidle" });
  await interaction.getByLabel("生成数量").fill("3");
  for (const country of ["中国", "日本", "英国", "德国", "法国", "俄国", "美国", "意大利", "西班牙", "韩国", "巴西"]) {
    await choose("国家", country);
    await interaction.getByRole("button", { name: "生成名字" }).click();
    await interaction.waitForFunction(() => document.querySelector('textarea[aria-label="生成结果"]')?.value.split("\n").length === 3);
    assert(!(await interaction.getByLabel("生成结果").inputValue()).includes("undefined"));
  }
  await choose("国家", "中国");
  await choose("名字性别倾向", "女性");
  await choose("起名风格", "幻想角色名（中文）");
  await interaction.getByLabel("固定姓氏（可选）").fill("林");
  await interaction.getByRole("button", { name: "生成名字" }).click();
  await interaction.waitForFunction(() => document.querySelector('textarea[aria-label="生成结果"]')?.value.startsWith("林"));
  await choose("国家", "日本");
  assert((await interaction.getByRole("combobox", { name: "起名风格" }).textContent()).includes("常见人名"));
  await interaction.goto(`${base.origin}/tools/embed/morse?theme=dark`, { waitUntil: "networkidle" });
  await choose("转换方向", "摩斯码 → 文字");
  await interaction.getByLabel("文字或摩斯码").fill("... --- ...");
  await interaction.getByRole("button", { name: "生成文字" }).click();
  await interaction.waitForFunction(() => document.querySelector('textarea[aria-label="生成结果"]')?.value === "SOS");
  await interaction.evaluate(() => {
    window.__toolCopyCalls = 0;
    const original = document.execCommand.bind(document);
    document.execCommand = (...args) => { if (args[0] === "copy") window.__toolCopyCalls++; return original(...args); };
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async () => { throw new Error("test denied"); } } });
  });
  await interaction.getByRole("button", { name: "复制全部" }).click();
  await interaction.waitForFunction(() => window.__toolCopyCalls === 1);
  assert(await interaction.getByRole("status").filter({ hasText: /已复制|复制未成功/ }).count() === 1);
  await interaction.getByLabel("文字或摩斯码").fill("constructor");
  await interaction.getByRole("button", { name: "生成文字" }).click();
  await interaction.getByText(/无法识别码组/).waitFor();
  assert.equal(await interaction.getByLabel("生成结果").inputValue(), "");
  const missing = await interaction.goto(`${base.origin}/tools/embed/unknown?theme=dark`, { waitUntil: "networkidle" });
  assert([200, 404].includes(missing.status()));
  await interaction.getByText(/404|页面不存在|This page could not be found/i).first().waitFor();
  assert.deepEqual(attemptedApis, []);
  results.push({ nameCountriesExercised: 11, characterStyle: true, foreignCountryResetsStyle: true, morseDecode: true, clipboardFallbackAttempted: true, invalidCodeRejected: true, unknownToolMissingView: true, unknownToolHttpStatus: missing.status(), embeddedBusinessRequests: 0 });
  await interactionContext.close();
  const context = await browser.newContext({ viewport: { width: 1280, height: 960 } });
  const blocked = [];
  await context.route("**/api/**", async (route) => { blocked.push(new URL(route.request().url()).pathname); await route.fulfill({ status: 401, contentType: "application/json", body: '{"code":401,"message":"匿名"}' }); });
  const page = await context.newPage();
  await page.goto(`${base.origin}/tools`, { waitUntil: "networkidle" });
  assert(await page.getByRole("navigation", { name: "主要页面" }).isVisible());
  await page.screenshot({ path: `${output}/desktop-web-index.png`, fullPage: true });
  results.push({ normalWebRoute: true, businessRequestsInterceptedBeforeNetwork: blocked });
  await context.close();
  await writeFile(`${output}/browser-report.json`, JSON.stringify({ status: "passed", base: base.origin, backendConfigured: "https://wenyou.site", dataBoundary: "全新匿名context；全部业务API在浏览器网络层拦截，未触达真实后端；嵌入页请求数为0", results }, null, 2));
  console.log(JSON.stringify({ status: "passed", output, scenarios: results.length }));
} finally { await browser.close(); }

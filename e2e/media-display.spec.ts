import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { insertTestEditorImage } from "./fixtures/media";
import { test, expect } from "@playwright/test";
import { mediaDisplayFixture } from "./helpers/media-display";
import { centerPixel } from "./helpers/png-pixel";

test("正文、楼层和灯箱使用完整WebP并实际解码帧，不请求GIF", async ({ page, baseURL }) => {
  const fixture = await mediaDisplayFixture(page, baseURL!);
  await page.goto("/threads/display-thread");
  const body = page.getByAltText("正文动画");
  await expect(body).toHaveAttribute("src", fixture.images[0].display.url);
  await expect(page.getByAltText("楼层动画")).toHaveAttribute("src", fixture.images[1].display.url);
  await expect(page.getByAltText("回复动画")).toHaveAttribute("src", fixture.images[2].display.url);
  // 对24×16编码器素材仅放大CSS命中/采样区域；资源字节和自然尺寸保持不变。
  await page.addStyleTag({ content: 'img[alt="正文动画"] { width: 240px !important; height: 160px !important; }' });
  await body.scrollIntoViewIfNeeded();
  const colors = new Set<string>();
  await expect.poll(async () => { const rgb = centerPixel(await body.screenshot({ animations: "allow" })); colors.add(rgb.join(",")); return rgb[2] > 220 && rgb[0] < 30 && rgb[1] < 30; }, { timeout: 12000 }).toBe(true);
  await body.click();
  const enlarged = page.getByRole("dialog").getByAltText("正文动画");
  await expect(enlarged).toHaveAttribute("src", fixture.images[0].display.url);
  const samples: { elapsedMs: number; rgb: number[] }[] = [], started = Date.now();
  while (Date.now() - started < 3700) {
    const png = await enlarged.screenshot({ animations: "allow" });
    const rgb = centerPixel(png);
    samples.push({ elapsedMs: Date.now() - started, rgb });
    if (samples.length === 1) {
      const file = test.info().outputPath("display-first-sample.png"); writeFileSync(file, png);
      await test.info().attach("display-first-sample", { path: file, contentType: "image/png" });
    }
    await page.waitForTimeout(150);
  }
  const timeline = test.info().outputPath("display-pixel-timeline.json"); writeFileSync(timeline, JSON.stringify(samples, null, 2));
  await test.info().attach("display-pixel-timeline", { path: timeline, contentType: "application/json" });
  expect(samples.some(({ rgb }) => rgb[0] > 220 && rgb[2] < 30)).toBe(true);
  expect(samples.some(({ rgb }) => rgb[2] > 220 && rgb[0] < 30)).toBe(true);
  expect(samples.filter(({ elapsedMs }) => elapsedMs > 3200).every(({ rgb }) => rgb[2] > 220 && rgb[0] < 30)).toBe(true);
  writeFileSync(test.info().outputPath("media-requests.json"), JSON.stringify(fixture.requests, null, 2));
  for (const media of fixture.images) expect(fixture.requests).not.toContain(media.url);
});

test("私聊图片与大图采用display，查看大图不重新下载GIF", async ({ page, baseURL }) => {
  const fixture = await mediaDisplayFixture(page, baseURL!);
  await page.goto("/messages/display-dm");
  await expect(page.getByAltText("私聊图片")).toHaveAttribute("src", fixture.images[3].display.url);
  await page.getByAltText("私聊图片").click();
  await expect(page.getByRole("dialog").getByAltText("私聊图片原图")).toHaveAttribute("src", fixture.images[3].display.url);
  writeFileSync(test.info().outputPath("media-requests.json"), JSON.stringify(fixture.requests, null, 2));
  for (const media of fixture.images) expect(fixture.requests).not.toContain(media.url);
});

test("动态列表仍静止，详情和全屏使用完整display", async ({ page, baseURL }) => {
  const fixture = await mediaDisplayFixture(page, baseURL!);
  await page.goto("/moments");
  await expect(page.locator('img[src="' + fixture.images[4].thumbnailUrl + '"]').first()).toBeVisible();
  expect(fixture.requests).not.toContain(fixture.images[4].display.url);
  await page.goto("/moments/display-moment");
  const image = page.getByAltText("完整动态图，第 1 张图片");
  await expect(image).toHaveAttribute("src", fixture.images[4].display.url);
  await image.click();
  await expect(page.locator('.yarl__root img[src="' + fixture.images[4].display.url + '"]')).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByAltText("评论图片", { exact: true }).scrollIntoViewIfNeeded();
  await expect(page.getByAltText("评论图片", { exact: true })).toHaveAttribute("src", fixture.images[2].display.url);
  await page.getByRole("button", { name: "查看评论图片", exact: true }).click();
  await expect(page.locator('.yarl__root img[src="' + fixture.images[2].display.url + '"]')).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByAltText("评论表情包", { exact: true }).scrollIntoViewIfNeeded();
  await expect(page.getByAltText("评论表情包", { exact: true })).toHaveAttribute("src", fixture.images[5].display.url);
  writeFileSync(test.info().outputPath("media-requests.json"), JSON.stringify(fixture.requests, null, 2));
  for (const media of fixture.images) expect(fixture.requests).not.toContain(media.url);
});

test("编辑已有正文展示WebP，保存与复制保留来源引用", async ({ page, baseURL, context }) => {
  const fixture = await mediaDisplayFixture(page, baseURL!); fixture.setPublished(false);
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/threads/display-thread/edit");
  const editor = page.locator(".ProseMirror");
  await expect(editor.locator("img")).toHaveAttribute("src", fixture.images[0].display.url);
  await editor.click(); await editor.press("ControlOrMeta+a"); await editor.press("ControlOrMeta+c");
  const clipboard = await page.evaluate(async () => { const items = await navigator.clipboard.read(); const item = items.find((entry) => entry.types.includes("text/html")); return item ? (await item.getType("text/html")).text() : ""; });
  expect(clipboard).toContain(fixture.images[0].url); expect(clipboard).not.toContain(fixture.images[0].display.url);
  await editor.press("End"); await editor.press("ArrowRight"); await editor.pressSequentially("验收");
  await page.getByRole("button", { name: "保存草稿", exact: true }).click();
  await expect.poll(() => fixture.writes.length).toBeGreaterThan(0);
  expect(fixture.getContent()).toContain(fixture.images[0].url);
  expect(fixture.getContent()).not.toContain(fixture.images[0].display.url);
  writeFileSync(test.info().outputPath("media-requests.json"), JSON.stringify(fixture.requests, null, 2));
  for (const media of fixture.images) expect(fixture.requests).not.toContain(media.url);
});

test("新GIF完成上传后编辑器立即使用display且不改写保存身份", async ({ page, baseURL }) => {
  const fixture = await mediaDisplayFixture(page, baseURL!); fixture.setPublished(false);
  await page.goto("/threads/display-thread/edit");
  const media = fixture.images[2];
  await insertTestEditorImage(page, { name: "new.gif", mimeType: "image/gif", buffer: readFileSync("e2e/fixtures/media-display/duplicate-frames.gif") }, { ...media, display: { ...media.display, contentType: "image/webp" } });
  await expect(page.locator('.ProseMirror img[src="' + media.display.url + '"]')).toBeVisible();
  await page.getByRole("button", { name: "保存草稿", exact: true }).click();
  await expect.poll(() => fixture.writes.length).toBeGreaterThan(0);
  expect(fixture.getContent()).toContain(media.url);
  expect(fixture.getContent()).not.toContain(media.display.url);
  writeFileSync(test.info().outputPath("media-requests.json"), JSON.stringify(fixture.requests, null, 2));
  for (const media of fixture.images) expect(fixture.requests).not.toContain(media.url);
});

test("完整display灯箱失败重试保持打开且只重试WebP", async ({ page, baseURL }) => {
  const fixture = await mediaDisplayFixture(page, baseURL!);
  let rejectFirst!: () => void;
  const failedResponse = new Promise<void>((resolve) => { rejectFirst = resolve; });
  let attempts = 0;
  await page.route(fixture.images[0].display.url, async (route) => {
    attempts++;
    if (attempts === 1) { await failedResponse; await route.fulfill({ status: 503, body: "临时不可用" }); }
    else await route.fulfill({ contentType: "image/webp", body: readFileSync("e2e/fixtures/media-display/duplicate-frames.webp") });
  });
  await page.goto("/threads/display-thread", { waitUntil: "domcontentloaded" });
  const body = page.getByAltText("正文动画");
  // 加载前原生img无自然尺寸；只为测试慢响应点击提供命中尺寸。
  await page.addStyleTag({ content: 'img[alt="正文动画"] { width: 240px !important; height: 160px !important; }' });
  await body.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  rejectFirst();
  await dialog.getByRole("button", { name: "重试图片" }).click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByAltText("正文动画")).toHaveAttribute("src", fixture.images[0].display.url);
  await expect.poll(() => dialog.getByAltText("正文动画").evaluate((element) => (element as HTMLImageElement).naturalWidth)).toBe(24);
  expect(attempts).toBe(2);
  writeFileSync(test.info().outputPath("media-requests.json"), JSON.stringify(fixture.requests, null, 2));
  for (const media of fixture.images) expect(fixture.requests).not.toContain(media.url);
});

test("真实编码器重复帧样本字节与固定契约manifest一致", () => {
  const root = "e2e/fixtures/media-display/";
  const manifest = JSON.parse(readFileSync(root + "manifest.json", "utf8"));
  for (const descriptor of [manifest.source, manifest.display]) {
    const bytes = readFileSync(root + descriptor.file);
    expect(bytes.length).toBe(descriptor.bytes);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(descriptor.sha256);
  }
  expect(manifest.expected.frameDelaysMs).toEqual([300, 600, 600]);
  expect(manifest.display.loopCount).toBe(2);
});

test("正文规范表情与编辑器表情用display，保存仍是原资产引用", async ({ page, baseURL }) => {
  const fixture = await mediaDisplayFixture(page, baseURL!);
  fixture.setContent(`前 ![表情](${fixture.images[5].url} "wenyousite-sticker:v1:sticker") 后`);
  await page.goto("/threads/display-thread");
  await expect(page.getByAltText("表情", { exact: true })).toHaveAttribute("src", fixture.images[5].display.url);
  fixture.setPublished(false);
  await page.goto("/threads/display-thread/edit");
  const sticker = page.locator(".ProseMirror img.sticker-inline");
  await expect(sticker).toHaveAttribute("src", fixture.images[5].display.url);
  await page.getByRole("button", { name: "保存草稿", exact: true }).click();
  await expect.poll(() => fixture.writes.length).toBeGreaterThan(0);
  expect(fixture.getContent()).toContain(fixture.images[5].url);
  expect(fixture.getContent()).not.toContain(fixture.images[5].display.url);
  writeFileSync(test.info().outputPath("media-requests.json"), JSON.stringify(fixture.requests, null, 2));
  for (const media of fixture.images) expect(fixture.requests).not.toContain(media.url);
});

test("全局正文草稿恢复携带display，复制与再保存不丢来源", async ({ page, baseURL }) => {
  const fixture = await mediaDisplayFixture(page, baseURL!); fixture.setPublished(false);
  await page.goto("/threads/display-thread/edit");
  await expect(page.locator(".ProseMirror img")).toHaveAttribute("src", fixture.images[0].display.url);
  fixture.setContent(`恢复 ![草稿动画](${fixture.images[2].url})`);
  await page.getByRole("button", { name: "正文草稿", exact: true }).click();
  await page.getByRole("region", { name: "正文草稿", exact: true }).getByRole("button", { name: "恢复", exact: true }).click();
  await page.getByRole("button", { name: "覆盖并恢复", exact: true }).click();
  await expect(page.locator(".ProseMirror img[src]")).toHaveAttribute("src", fixture.images[2].display.url);
  await page.getByRole("button", { name: "保存草稿", exact: true }).click();
  await expect.poll(() => fixture.writes.length).toBeGreaterThan(0);
  expect(fixture.getContent()).toContain(fixture.images[2].url);
  expect(fixture.getContent()).not.toContain(fixture.images[2].display.url);
  writeFileSync(test.info().outputPath("media-requests.json"), JSON.stringify(fixture.requests, null, 2));
  for (const media of fixture.images) expect(fixture.requests).not.toContain(media.url);
});

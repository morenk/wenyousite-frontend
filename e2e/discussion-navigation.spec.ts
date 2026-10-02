import { writeFileSync } from "node:fs";
import { expect, type Page } from "@playwright/test";
import { test } from "./fixtures/isolation";
import { loginAsE2eUser } from "./fixtures/auth";
import { readDiscussionFixtures, requireIsolationRunner } from "../scripts/e2e-isolation-gate.mjs";

type Scenario = { size: number; threadId: string; subthreadId: string; rootPostId: string; pinnedPostId: string; editableFloorId: string; editableReplyId: string; otherAuthorFloorId: string; otherAuthorReplyId: string };
type Subject = "楼层" | "回复";
async function scenarios(): Promise<Scenario[]> {
  return readDiscussionFixtures(await requireIsolationRunner()).scenarios;
}
function href(item: Scenario, subject: Subject) {
  return subject === "楼层" ? `/threads/${item.threadId}` : `/threads/${item.threadId}/posts/${item.rootPostId}/replies`;
}
async function jump(page: Page, subject: Subject, number: number) {
  await page.getByRole("button", { name: `跳转到${subject}`, exact: true }).first().click();
  await page.getByRole("textbox", { name: `${subject}编号` }).fill(String(number));
  const response = page.waitForResponse((response) => new URL(response.url()).pathname.endsWith("/window") && new URL(response.url()).searchParams.get("number") === String(number) && response.status() === 200);
  await page.getByRole("button", { name: "前往", exact: true }).click();
  const value = (await (await response).json()).data;
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const target = page.locator(`#post-${value.target.id}`);
  await expect(target).toBeVisible();
  await expect.poll(() => target.evaluate((element) => {
    let top = 24;
    for (const name of ["thread-reading", "discussion-position"]) {
      const bar = document.querySelector<HTMLElement>(`[data-slot="${name}-bar"]`);
      const anchor = document.querySelector<HTMLElement>(`[data-slot="${name}-anchor"]`) ?? document.querySelector<HTMLElement>(`[data-slot="${name}-bar-anchor"]`);
      if (bar && anchor) top = Math.max(top, parseFloat(getComputedStyle(anchor).top) + bar.offsetHeight + 24);
    }
    return Math.abs(element.getBoundingClientRect().top - top);
  })).toBeLessThan(3);
  return value.target.id as string;
}
async function rendered(page: Page) {
  return page.locator('[data-slot="discussion-virtual-list"] [data-discussion-item]').count();
}
function captureErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error" && /flushSync|Maximum update|hydration/i.test(message.text())) errors.push(message.text()); });
  return errors;
}

test.describe("真实隔离长讨论窗口", () => {
  test.skip(!process.env.E2E_DISCUSSION_FIXTURES, "由 --discussion-fixtures 官方入口提供同轮合成样本");
  for (const size of [1000, 5000, 10000]) for (const subject of ["楼层", "回复"] as const) {
    test(`${size} 条${subject}：中段、末尾、反向续读与渲染有界`, async ({ page }) => {
      test.setTimeout(120_000);
      const item = (await scenarios()).find((item) => item.size === size)!;
      const errors = captureErrors(page);
      const requests: string[] = [];
      const shifts: number[] = [];
      const measurements: unknown[] = [];
      let stage = "start";
      let measuring = 0;
      await page.route("**/window?**", async (route) => {
        if (route.request().method() !== "GET" || !new URL(route.request().url()).searchParams.has("cursor")) return route.continue();
        measuring++;
        try {
          // 保持浏览器原始 GET 经过隔离代理；APIRequestContext 会尝试被门禁拒绝的 CONNECT。
          await page.waitForTimeout(180);
          const anchor = await page.locator("[data-discussion-item]").evaluateAll((nodes) => {
            const node = nodes.find((node) => node.getBoundingClientRect().bottom > 90 && node.getBoundingClientRect().top < innerHeight);
            return node ? { id: node.getAttribute("data-discussion-item"), top: node.getBoundingClientRect().top, y: scrollY,
              controls: Array.from(document.querySelectorAll('[data-slot="discussion-position-bar"],[data-slot="thread-reading-bar"]')).map((bar) => ({ height: (bar as HTMLElement).offsetHeight, top: bar.getBoundingClientRect().top })),
              listTop: document.querySelector('[data-slot="discussion-virtual-list"]')?.getBoundingClientRect().top,
            } : null;
          });
          const incoming = page.waitForResponse((response) => response.url() === route.request().url() && response.request().method() === "GET");
          await route.continue();
          const response = await incoming;
          expect(response.status(), "浏览器真实游标请求").toBe(200);
          const payload = await response.json();
          await page.waitForTimeout(100);
          if (anchor) {
            const after = await page.locator(`[data-discussion-item="${anchor.id}"]`).evaluateAll((nodes) => { const rect = nodes[0]?.getBoundingClientRect(); return rect ? { y: rect.y, height: rect.height } : null; });
            if (!after) throw new Error(`双向续读裁剪了可见锚点 stage=${stage} anchor=${JSON.stringify(anchor)}`);
            shifts.push(Math.abs(after.y - anchor.top));
            measurements.push({ stage, anchor, after, response: { status: response.status(), code: payload.code, message: payload.message, count: payload.data?.items?.length }, layout: await page.evaluate(() => ({ y: scrollY, height: document.documentElement.scrollHeight,
              controls: Array.from(document.querySelectorAll('[data-slot="discussion-position-bar"],[data-slot="thread-reading-bar"]')).map((bar) => ({ height: (bar as HTMLElement).offsetHeight, top: bar.getBoundingClientRect().top })), listTop: document.querySelector('[data-slot="discussion-virtual-list"]')?.getBoundingClientRect().top })) });
          }
        } finally { measuring--; }
      });
      page.on("request", (request) => { const url = new URL(request.url()); if (url.pathname.endsWith("/window")) requests.push(url.search); });
      await page.goto(href(item, subject));
      await expect(page.getByRole("button", { name: `跳转到${subject}`, exact: true }).first()).toBeEnabled();
      const before = requests.length;
      const id = await jump(page, subject, size / 2);
      expect(requests.filter((query) => query.includes(`number=${size / 2}&`))).toHaveLength(1);
      expect(requests.length - before).toBeLessThanOrEqual(2);
      expect(await rendered(page)).toBeLessThanOrEqual(24);
      if (subject === "楼层") await expect(page.locator('[data-testid="pinned-floors"]')).toHaveCount(0);
      stage = "wheel-after-middle";
      await page.mouse.wheel(0, 1000);
      await page.waitForTimeout(300);
      const top = await page.locator(`#post-${id}`).evaluate((node) => node.getBoundingClientRect().top).catch(() => -1000);
      expect(top).toBeLessThan(0);
      const y = await page.evaluate(() => window.scrollY);
      await page.waitForTimeout(400);
      expect(Math.abs(await page.evaluate(() => window.scrollY) - y)).toBeLessThan(3);
      stage = "jump-end";
      await jump(page, subject, size);
      expect(requests.filter((query) => query.includes(`number=${size}&`))).toHaveLength(1);
      // 向前跨多页，检查不会扫描全串或把已激活的末尾重新吸回。
      for (let index = 0; index < 32; index++) { stage = `before-${index}`; await page.mouse.wheel(0, -1000); await page.waitForTimeout(120); await expect.poll(() => measuring).toBe(0); expect(await rendered(page)).toBeLessThanOrEqual(26); }
      expect(requests.length).toBeLessThan(25);
      expect(requests.filter((query) => query.includes("cursor=")).length, JSON.stringify(measurements)).toBeGreaterThanOrEqual(6);
      expect(shifts.length).toBeGreaterThan(0);
      expect(Math.max(...shifts), JSON.stringify(measurements)).toBeLessThan(4);
      expect(errors).toEqual([]);
    });
  }

  for (const subject of ["楼层", "回复"] as const) {
    test(`${subject}窗口的编辑、目标删除、已删返回与编号空洞`, async ({ page, context }) => {
      test.setTimeout(150_000);
      const item = (await scenarios()).find((item) => item.size === 1000)!;
      await loginAsE2eUser(page);
      await page.goto(href(item, subject));
      const id = await jump(page, subject, 3);
      const card = page.locator(`#post-${id}`);
      await card.getByRole("button", { name: `更多${subject}操作` }).click();
      await page.getByRole("menuitem", { name: "编辑", exact: true }).click();
      const editor = page.locator(".milkdown-editor .ProseMirror");
      await expect(editor).toBeVisible();
      await editor.fill(`窗口编辑回归 ${subject}`);
      await page.getByRole("button", { name: "保存修改", exact: true }).click();
      await expect(card).toContainText(`窗口编辑回归 ${subject}`);
      await expect(editor).toHaveCount(0);
      await jump(page, subject, 3);
      await expect(page.getByRole("button", { name: `跳转到${subject}`, exact: true }).first()).toContainText("#3");
      await jump(page, subject, 500);
      const beforeReturn = await page.locator("[data-discussion-item]").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-discussion-item")));
      const second = await context.newPage();
      try {
        await second.goto(href(item, subject));
        await jump(second, subject, 3);
        await second.locator(`#post-${id}`).getByRole("button", { name: `更多${subject}操作` }).click();
        await second.getByRole("menuitem", { name: "删除", exact: true }).click();
        await second.getByRole("button", { name: "删除", exact: true }).click();
        await expect(second.locator(`#post-${id}`)).toHaveCount(0);
        await expect(second.getByText("加载失败", { exact: true })).toHaveCount(0);
        expect(await rendered(second)).toBeGreaterThan(0);
      } finally { await second.close(); }
      const returnResponses: unknown[] = [];
      page.on("response", (response) => { const url = new URL(response.url()); if (url.pathname.endsWith("/window")) returnResponses.push({ query: url.search, status: response.status() }); });
      const unavailableReturn = page.waitForResponse((response) => new URL(response.url()).pathname.endsWith("/window") && new URL(response.url()).searchParams.get("postId") === id && response.status() === 404, { timeout: 15_000 });
      await page.getByRole("button", { name: "回到刚才", exact: true }).first().click();
      await unavailableReturn.catch((error) => { throw new Error(`${error.message}; 返回请求 ${JSON.stringify(returnResponses)}`); });
      await expect.poll(() => page.locator("[data-discussion-item]").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-discussion-item")))).toEqual(beforeReturn);
      await page.getByRole("button", { name: `跳转到${subject}`, exact: true }).first().click();
      await page.getByRole("textbox", { name: `${subject}编号` }).fill("3");
      await page.getByRole("button", { name: "前往", exact: true }).click();
      await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.getByRole("textbox", { name: `${subject}编号` }).fill("4");
      await page.getByRole("button", { name: "前往", exact: true }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(page.locator('[data-discussion-item]').filter({ hasText: "#4" }).first()).toBeVisible();
    });
  }
  test("首屏裁剪后置顶楼层的编辑、回复计数与取消置顶仍刷新", async ({ page }) => {
    test.setTimeout(150_000);
    const item = (await scenarios()).find((item) => item.size === 5000)!;
    await loginAsE2eUser(page);
    let cursors = 0;
    let phase = "reading";
    const evidence: unknown[] = [];
    const directions = new Map<string, string>();
    const sample = () => page.evaluate((id) => {
      const pin = document.getElementById(`post-${id}`)?.getBoundingClientRect();
      const first = document.querySelector<HTMLElement>('[data-slot="discussion-virtual-list"] [data-discussion-number]');
      const bar = document.querySelector<HTMLElement>('[data-slot="thread-reading-bar"]');
      const anchor = bar?.closest<HTMLElement>('[data-slot="thread-reading-bar-anchor"]');
      const readingTop = bar && anchor ? (Number.parseFloat(getComputedStyle(anchor).top) || 0) + bar.offsetHeight + 24 : 24;
      const visible = [...document.querySelectorAll<HTMLElement>('[data-slot="discussion-virtual-list"] [data-discussion-number]')].flatMap(node => { const rect = node.getBoundingClientRect(); return rect.bottom > readingTop && rect.top < innerHeight ? [{ id: node.dataset.discussionItem!, number: node.dataset.discussionNumber, top: rect.top, bottom: rect.bottom }] : []; });
      return { visible, y: scrollY, pin: pin ? { top: pin.top, bottom: pin.bottom } : null, first: first ? { number: first.dataset.discussionNumber, top: first.getBoundingClientRect().top } : null, editor: !!document.querySelector(".milkdown-editor .ProseMirror"), bars: [...document.querySelectorAll('[data-slot="thread-reading-bar"]')].map(node => ({ top: node.getBoundingClientRect().top, height: node.getBoundingClientRect().height })) };
    }, item.pinnedPostId);
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (phase !== "reading" && url.pathname.endsWith("/posts/window")) {
        const at = phase;
        void sample().then(layout => evidence.push({ event: "request", phase: at, direction: directions.get(url.searchParams.get("cursor") ?? "") ?? "default", layout })).catch(() => {});
      }
    });
    page.on("response", async (response) => {
      const url = new URL(response.url());
      if (!url.pathname.endsWith("/posts/window") || response.status() !== 200) return;
      if (url.searchParams.has("cursor")) cursors++;
      try {
        const data = (await response.json()).data;
        if (data.beforeCursor) directions.set(data.beforeCursor, "before");
        if (data.afterCursor) directions.set(data.afterCursor, "after");
        if (phase !== "reading") evidence.push({ event: "response", phase, first: data.items[0]?.floorNumber, last: data.items.at(-1)?.floorNumber, layout: await sample() });
      } catch { /* 已关闭的页面不会参与阅读证据。 */ }
    });
    await page.goto(href(item, "楼层"));
    await expect(page.locator(`#post-${item.pinnedPostId}`)).toBeVisible();
    for (let index = 0; index < 36; index++) { await page.mouse.wheel(0, 1000); await page.waitForTimeout(200); }
    expect(cursors).toBeGreaterThanOrEqual(6);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    const pin = page.locator(`#post-${item.pinnedPostId}`);
    await expect(pin).toBeVisible();
    const first = await page.locator('[data-slot="discussion-virtual-list"] [data-discussion-number]').first().getAttribute("data-discussion-number");
    expect(Number(first)).toBeGreaterThan(20);
    phase = "edit";
    evidence.push({ event: "before-edit", layout: await sample() });
    await pin.getByRole("button", { name: "更多楼层操作" }).click();
    await page.getByRole("menuitem", { name: "编辑", exact: true }).click();
    const editor = page.locator(".milkdown-editor .ProseMirror");
    await editor.fill("裁剪后的置顶编辑正文");
    const beforeSave = await sample();
    evidence.push({ event: "before-save", layout: beforeSave });
    const savedFirst = beforeSave.first!.number;
    expect(Number(savedFirst)).toBeGreaterThan(20);
    phase = "save";
    await page.getByRole("button", { name: "保存修改", exact: true }).click();
    await expect(pin).toContainText("裁剪后的置顶编辑正文");
    await expect(editor).toHaveCount(0);
    evidence.push({ event: "after-save", layout: await sample() });
    await expect(page.locator('[data-slot="discussion-virtual-list"] [data-discussion-number]').first(), JSON.stringify(evidence)).toHaveAttribute("data-discussion-number", savedFirst!);
    await expect(pin).toBeInViewport();
    phase = "reply";
    await pin.getByRole("button", { name: "回复", exact: true }).click();
    await editor.fill("裁剪后的置顶回复预览");
    const replyFirst = (await sample()).first!.number;
    // 本卡的第一个“回复”为打开入口，最后一个是当前统一编辑器的提交按钮。
    await pin.getByRole("button", { name: "回复", exact: true }).last().click({ timeout: 10_000 });
    await expect(editor).toHaveCount(0);
    await expect(pin).toContainText("裁剪后的置顶回复预览");
    await expect(pin.getByRole("link", { name: "展开楼中楼（1 条）" })).toBeVisible();
    await expect(page.locator('[data-slot="discussion-virtual-list"] [data-discussion-number]').first()).toHaveAttribute("data-discussion-number", replyFirst!);
    phase = "unpin";
    let unpinAnchor: { id: string; top: number } | undefined;
    await page.route(`**/posts/${item.pinnedPostId}/pin`, async (route) => {
      if (route.request().method() === "DELETE") {
        const layout = await sample();
        unpinAnchor = layout.visible[0];
        evidence.push({ event: "unpin-submit", layout });
      }
      await route.continue();
    });
    evidence.push({ event: "before-unpin", layout: await sample() });
    await pin.getByRole("button", { name: "更多楼层操作" }).click();
    await page.getByRole("menuitem", { name: "取消置顶", exact: true }).click();
    await expect(page.getByTestId("pinned-floors")).toHaveCount(0);
    // 取消置顶后阅读区少一张卡，可在边缘合法续读；原有自然条目必须仍在，不能换回首页。
    evidence.push({ event: "after-unpin", layout: await sample() });
    expect(unpinAnchor, JSON.stringify(evidence)).toBeDefined();
    const readingNode = page.locator(`[data-discussion-item="${unpinAnchor!.id}"]`);
    await expect(readingNode).toBeInViewport();
    await expect.poll(async () => Math.abs((await readingNode.boundingBox())!.y - unpinAnchor!.top), { message: JSON.stringify(evidence) }).toBeLessThan(4);
    await page.waitForTimeout(350);
    const after = await sample();
    expect(Math.abs((await readingNode.boundingBox())!.y - unpinAnchor!.top), JSON.stringify(evidence)).toBeLessThan(4);
    expect(Number(after.first?.number)).toBeGreaterThan(20);
    writeFileSync(test.info().outputPath("pin-position.json"), JSON.stringify({ runId: process.env.E2E_RUN_ID, anchor: unpinAnchor, after, evidence }, null, 2));
  });

});

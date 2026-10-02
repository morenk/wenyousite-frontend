
import { expect, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "./fixtures/isolation";

/** 合成正文与响应只用于已核验隔离候选；报告仅保留时序，不保存账号、正文或请求。 */
const thread = {
  id: "t-dice-e2e",
  title: "未命名草稿",
  ownerId: "u-dice-e2e",
  category: "DEDUCTION",
  categoryInfo: { slug: "DEDUCTION", name: "演绎", isActive: true },
  status: "RECRUITING",
  visibility: "PUBLIC",
  published: false,
  publishedAt: null,
  pinned: false,
  pinnedAt: null,
  viewCount: 0,
  version: 1,
  likeCount: 0,
  defaultSubthreadId: "s-dice-e2e",
  createdAt: "2026-08-06T00:00:00.000Z",
  updatedAt: "2026-08-06T00:00:00.000Z",
  deletedAt: null,
  owner: { id: "u-dice-e2e", username: "骰子测试", avatar: null },
  subthreads: [
    {
      id: "s-dice-e2e",
      threadId: "t-dice-e2e",
      title: "主帖",
      sortOrder: 0,
      postingPolicy: "PARTICIPANTS",
      version: 1,
      lastPostAt: null,
      deletedAt: null,
      createdAt: "2026-08-06T00:00:00.000Z",
      bodyPost: null,
      _count: { posts: 0 },
      tags: [],
    },
  ],
  topicTags: [],
  _count: { members: 1, players: 1, posts: 0 },
};


function contentFor(size: number, mixed: boolean) {
  const paragraph = "温油站编辑器输入性能样本，文字应当及时出现，光标移动保持稳定。".repeat(4);
  let text = Array.from({ length: Math.ceil(size / paragraph.length) }, () => paragraph).join("\n\n").slice(0, size);
  if (mixed) text = "**混排正文**\n\n[@样例用户](/users/u-perf)\n\n> 引用段落\n\n[[dice:v1:550e8400-e29b-41d4-a716-446655440000:1d20+2]]\n\n![表情](/editor-perf-image.svg \"wenyousite-sticker:v1:cm1234567890123456789012\")\n\n![图片](/editor-perf-image.svg)\n\n---\n\n" + text;
  return text;
}

async function prepare(page: Page, content: string, autosave: boolean) {
  await page.route("**/editor-perf-image.svg", (route) => route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="#a7bca0"/></svg>' }));
  let version = 0;
  let saved = "";
  const body = { ...thread, defaultSubthreadId: "s-dice-e2e", subthreads: [
    { ...thread.subthreads[0], bodyPost: { id: "p-perf-body", content, diceRolls: [], mediaDisplays: [] } },
  ] };
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname.slice("/api/v1".length);
    let data: unknown = [];
    if (path === "/auth/refresh") data = { accessToken: "e2e-memory-token", user: { id: "u-dice-e2e", username: "性能样例", email: "perf@example.invalid", avatar: null, role: "USER" } };
    else if (path.endsWith("/posts/window")) data = { items: [], pinnedItems: [], total: 0, maxNumber: null, target: null, beforeCursor: null, afterCursor: null, hasBefore: false, hasAfter: false };
    else if (path === "/meta") data = { markdownContractVersion: 5 };
    else if (path === "/threads/draft") data = [];
    else if (path === "/threads/t-dice-e2e" || path === "/threads") data = route.request().method() === "POST" ? body : path === "/threads" ? [] : body;
    else if (path === "/thread-categories") data = [{ id: "category-perf", slug: "DEDUCTION", name: "演绎", isActive: true, sortOrder: 0, createdAt: body.createdAt, updatedAt: body.updatedAt }];
    else if (path === "/drafts/state") data = { drafts: version ? [{ id: "perf-draft", slot: 1, version, content: saved, createdAt: body.createdAt, updatedAt: body.updatedAt }] : [], usedSlots: version ? 1 : 0, maxSlots: 5, slots: version ? [1] : [] };
    else if ((path === "/drafts" || path === "/drafts/perf-draft") && ["POST", "PATCH"].includes(route.request().method())) {
      saved = (route.request().postDataJSON() as { content: string }).content;
      data = { id: "perf-draft", slot: 1, version: ++version, content: saved, createdAt: body.createdAt, updatedAt: body.updatedAt };
    } else if (path === "/notifications/unread") data = { unreadCount: 0 };
    else if (path === "/direct-conversations/unread") data = { unreadMessageCount: 0, pendingRequestCount: 0, total: 0 };
    else if (path === "/wallet") data = { balance: "0", receivedTipTotal: "0", receivedTipCount: 0 };
    else if (path === "/wallet/check-in") data = { claimedNow: false, rewardAmount: "0", balance: "0", progression: { level: 1, experience: 0, currentLevelExperience: 0, nextLevelExperience: 50 } };
    else if (path === "/users/mention-candidates") data = { users: [], canMentionAllPlayers: false };
    else if (!["GET", "HEAD"].includes(route.request().method())) throw new Error("基准未声明的写入 " + path);
    await route.fulfill({ json: { code: 0, message: "ok", data, meta: { cursor: null, hasMore: false } } });
  });
  await page.goto("/threads/create");
  await page.getByRole("button", { name: "新建主题帖" }).first().click();
  const editor = page.locator(".milkdown-editor .ProseMirror").first();
  await expect(editor).toBeVisible();
  await expect(editor).toContainText("温油站");
  if (autosave) {
    await page.getByRole("toolbar").getByRole("button", { name: "正文草稿", exact: true }).click();
    await page.getByRole("switch", { name: "自动保存到草稿 1" }).click();
    await expect(page.getByRole("switch", { name: "自动保存到草稿 1" })).toHaveAttribute("aria-checked", "true");
    await page.getByRole("button", { name: "收起正文草稿" }).click();
  }
  await editor.click();
  await page.keyboard.press("Control+End");
  await page.waitForTimeout(1_000);
  return editor;
}

for (const [size, mixed] of [[200, false], [2_000, false], [9_000, false], [8_000, true]] as const) {
  for (const autosave of [false, true]) for (const cpu of [1, 4]) {
    test("编辑器输入性能 " + size + "字 " + (mixed ? "混排" : "纯文") + " 自动保存" + (autosave ? "开" : "关") + " CPU" + cpu, async ({ page, browserName }) => {
      test.skip(browserName !== "chromium", "事件计时和CPU降速基准固定Chromium；功能另跑跨浏览器矩阵");
      test.setTimeout(180_000);
      const session = await page.context().newCDPSession(page);
      await page.setViewportSize({ width: 1440, height: 1000 });
      await session.send("Emulation.setCPUThrottlingRate", { rate: cpu });
      const samples = [];
      try {
        for (let round = 0; round < 3; round++) {
          await page.unrouteAll({ behavior: "wait" });
          const editor = await prepare(page, contentFor(size, mixed), autosave);
          await page.evaluate(() => {
            const state = { frames: [] as number[], events: [] as number[], keyToFrame: [] as number[], handlers: [] as number[], longTasks: [] as number[], running: true, last: performance.now(), active: 0 };
            const target = window as unknown as { __editorInputSample: typeof state };
            target.__editorInputSample = state;
            const observe = (type: string, sink: number[]) => {
              try { new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) if (type !== "event" || entry.name === "keydown") sink.push(entry.duration);
              }).observe(type === "event" ? { type, buffered: false, durationThreshold: 16 } as PerformanceObserverInit : { type, buffered: false }); } catch {}
            };
            observe("longtask", state.longTasks); observe("event", state.events);
            const el = document.querySelector(".milkdown-editor .ProseMirror")!;
            el.addEventListener("keydown", () => {
              state.active = performance.now();
              const started = state.active;
              requestAnimationFrame(() => { if (state.running) state.keyToFrame.push(performance.now() - started); });
            }, true);
            el.addEventListener("input", () => { if (state.running && state.active) state.handlers.push(performance.now() - state.active); });
            const frame = (now: number) => { if (!state.running) return; state.frames.push(now - state.last); state.last = now; requestAnimationFrame(frame); };
            requestAnimationFrame(frame);
          });
          await page.keyboard.type("abcdefghijklmnopqrstuvwxyz".repeat(3), { delay: 20 });
          await page.waitForTimeout(1_000);
          await expect(editor).toContainText("abcdefghijklmnopqrstuvwxyz");
          const sample = await page.evaluate(() => {
            const state = (window as unknown as { __editorInputSample: { running: boolean; frames: number[]; events: number[]; keyToFrame: number[]; handlers: number[]; longTasks: number[] } }).__editorInputSample;
            state.running = false;
            const describe = (values: number[]) => { const sorted = [...values].sort((a,b) => a-b); return { count: values.length, p95Ms: sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)] ?? 0, maxMs: sorted.at(-1) ?? 0 }; };
            return { frames: describe(state.frames), eventTiming: describe(state.events), keyToNextRaf: describe(state.keyToFrame), keyToInput: describe(state.handlers), longTasks: describe(state.longTasks) };
          });
          samples.push({ round, size, mixed, autosave, cpu, ...sample });
        }
      } finally { await session.send("Emulation.setCPUThrottlingRate", { rate: 1 }); await session.detach(); }
      const output = join(process.cwd(), ".e2e-results", "editor-input-performance", process.env.E2E_RUN_ID!);
      mkdirSync(output, { recursive: true, mode: 0o700 });
      writeFileSync(join(output, [size, mixed, autosave, cpu].join("-") + ".json"), JSON.stringify({ browser: await page.context().browser()!.version(), viewport: { width: 1440, height: 1000 }, note: "keydown到rAF是绘制前代理指标；EventTiming仅含≥16ms样本，不能把缺失事件当0ms。", samples }, null, 2), { mode: 0o600 });
      expect(samples).toHaveLength(3);
    });
  }
}


test("延后同步时最后一字立即保存，正文来自当前编辑器", async ({ page }) => {
  const editor = await prepare(page, contentFor(200, false), false);
  const submissions: string[] = [];
  await page.route("**/api/v1/threads/t-dice-e2e/aggregate", async (route) => {
    submissions.push((route.request().postDataJSON() as { content: string }).content);
    await route.fulfill({ json: { code: 0, message: "ok", data: thread } });
  });
  await editor.focus();
  await page.keyboard.insertText("最后一字");
  await page.getByRole("button", { name: "保存草稿", exact: true }).evaluate((button) => (button as HTMLButtonElement).click());
  await expect.poll(() => submissions.length).toBe(1);
  expect(submissions[0]).toContain("最后一字");
});

test("中文组词中的显式保存被阻止，选词结束后保存最终文字", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "CDP组词行为补充；原生输入法仍须人工验收");
  const editor = await prepare(page, contentFor(200, false), false);
  const submissions: string[] = [];
  await page.route("**/api/v1/threads/t-dice-e2e/aggregate", async (route) => {
    submissions.push((route.request().postDataJSON() as { content: string }).content);
    await route.fulfill({ json: { code: 0, message: "ok", data: thread } });
  });
  const session = await page.context().newCDPSession(page);
  try {
    await session.send("Input.imeSetComposition", { text: "pinyin", selectionStart: 6, selectionEnd: 6 });
    await page.getByRole("button", { name: "保存草稿", exact: true }).evaluate((button) => (button as HTMLButtonElement).click());
    await page.waitForTimeout(250);
    expect(submissions).toHaveLength(0);
    await session.send("Input.insertText", { text: "拼音确认" });
    await expect(editor).toContainText("拼音确认");
    await page.getByRole("button", { name: "保存草稿", exact: true }).click();
    await expect.poll(() => submissions.length).toBe(1);
    expect(submissions[0]).toContain("拼音确认");
    expect(submissions[0]).not.toContain("pinyin");
  } finally { await session.detach(); }
});

import { expect, test } from "@playwright/test";
import { openFreshThreadDraft } from "./fixtures/auth";

const thread = {
  id: "t-dice-e2e",
  title: "未命名草稿",
  ownerId: "u-dice-e2e",
  category: "DEDUCTION",
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

test("编辑器格式、窄栏、骰子与正文草稿工具在真实浏览器中正常工作", async ({ page }) => {
  let submittedBody = "";
  await page.route("**/api/v1/auth/refresh", (route) =>
    route.fulfill({
      json: {
        code: 0,
        message: "ok",
        data: {
          accessToken: "e2e-memory-token",
          user: {
            id: "u-dice-e2e",
            email: "dice-e2e@example.invalid",
            username: "骰子测试",
            avatar: null,
            role: "USER",
            emailVerified: true,
          },
        },
      },
    }),
  );

  await page.route("**/api/v1/threads/draft", (route) =>
    route.fulfill({ json: { code: 0, message: "ok", data: [] } }),
  );
  await page.route("**/api/v1/thread-categories", (route) =>
    route.fulfill({
      json: {
        code: 0,
        message: "ok",
        data: [{
          id: "category-dice-e2e",
          slug: "MYSTERY",
          name: "悬疑推理",
          description: null,
          color: "#7C3AED",
          icon: "search",
          sortOrder: 0,
          isActive: true,
          createdAt: "2026-08-08T00:00:00.000Z",
          updatedAt: "2026-08-08T00:00:00.000Z",
        }],
      },
    }),
  );
  await page.route("**/api/v1/drafts/slots", (route) =>
    route.fulfill({
      json: {
        code: 0,
        message: "ok",
        data: { usedSlots: 1, maxSlots: 5, slots: [1] },
      },
    }),
  );
  await page.route("**/api/v1/drafts", (route) =>
    route.fulfill({
      json: {
        code: 0,
        message: "ok",
        data: [{
          id: "draft-editor-e2e",
          userId: "u-dice-e2e",
          slot: 1,
          content: "浏览器内的正文草稿",
          version: 1,
          createdAt: "2026-08-08T00:00:00.000Z",
          updatedAt: "2026-08-08T00:00:00.000Z",
        }],
      },
    }),
  );
  await page.route("**/api/v1/notifications/unread", (route) =>
    route.fulfill({
      json: { code: 0, message: "ok", data: { unreadCount: 0 } },
    }),
  );
  await page.route("**/api/v1/direct-conversations/unread", (route) =>
    route.fulfill({
      json: {
        code: 0,
        message: "ok",
        data: { unreadMessageCount: 0, pendingRequestCount: 0, total: 0 },
      },
    }),
  );
  await page.route("**/api/v1/wallet", (route) =>
    route.fulfill({
      json: {
        code: 0,
        message: "ok",
        data: { balance: "0", receivedTipTotal: "0", receivedTipCount: 0 },
      },
    }),
  );
  await page.route("**/api/v1/wallet/check-in", (route) =>
    route.fulfill({
      json: {
        code: 0,
        message: "ok",
        data: {
          claimedNow: false,
          date: "2026-08-08",
          rewardAmount: "3",
          experienceAwarded: 0,
          balance: "0",
          progression: {
            level: 1,
            experience: 0,
            currentLevelExperience: 0,
            nextLevelExperience: 50,
          },
        },
      },
    }),
  );
  await page.route("**/api/v1/threads", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    await route.fulfill({ json: { code: 0, message: "ok", data: thread } });
  });
  await page.route("**/api/v1/threads/t-dice-e2e", (route) =>
    route.fulfill({ json: { code: 0, message: "ok", data: thread } }),
  );
  await page.route("**/api/v1/threads/t-dice-e2e/aggregate", async (route) => {
    submittedBody = (route.request().postDataJSON() as { content: string }).content;
    await route.fulfill({
      json: {
        code: 0,
        message: "ok",
        data: { ...thread, title: "骰子发布载荷测试", published: true },
      },
    });
  });

  await openFreshThreadDraft(page);

  const toolbar = page.getByRole("toolbar", { name: "正文格式工具栏" });
  await expect(toolbar.getByRole("button", { name: "删除线" })).toBeVisible();
  await expect(toolbar.getByRole("button", { name: "无序列表" })).toHaveCount(0);
  const diceIcon = toolbar.getByRole("button", { name: "骰子" });
  await expect(diceIcon.locator("rect[rx='4']")).toHaveCount(1);
  await expect(diceIcon.locator("circle")).toHaveCount(5);

  const host = page.locator(".milkdown-editor").first();
  await host.evaluate((element) => {
    element.style.width = "360px";
  });
  const narrowMetrics = await toolbar.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    itemTops: [
      ...element.querySelectorAll<HTMLElement>(
        ".top-bar-heading-button, .top-bar-item",
      ),
    ].map((item) => item.offsetTop),
  }));
  expect(
    Math.max(...narrowMetrics.itemTops) - Math.min(...narrowMetrics.itemTops),
  ).toBeLessThanOrEqual(4);
  expect(narrowMetrics.scrollWidth).toBeGreaterThan(narrowMetrics.clientWidth);
  const headingButton = toolbar.locator(".top-bar-heading-button");
  await headingButton.click();
  const headingMenu = toolbar.locator(".top-bar-heading-dropdown");
  await expect(headingMenu).toBeVisible();
  await expect(headingMenu).toHaveCSS("position", "fixed");
  const menuBox = await headingMenu.boundingBox();
  expect(menuBox).not.toBeNull();
  expect(menuBox!.x).toBeGreaterThanOrEqual(8);
  expect(menuBox!.x + menuBox!.width).toBeLessThanOrEqual(
    (await page.evaluate(() => window.innerWidth)) - 8,
  );
  await headingButton.click();
  await expect(headingMenu).toHaveCount(0);
  await host.evaluate((element) => {
    element.style.width = "";
  });

  const diceButton = page.getByRole("button", { name: "骰子" });
  await expect(diceButton).toBeVisible();
  const editor = page.locator(".milkdown .ProseMirror");
  await editor.fill("需要删除的文字");
  await editor.selectText();
  const strikethroughButton = toolbar.getByRole("button", { name: "删除线" });
  await strikethroughButton.click();
  await expect(editor.locator("del")).toHaveText("需要删除的文字");
  await strikethroughButton.click();
  await expect(editor.locator("del")).toHaveCount(0);

  await editor.click();
  await editor.fill("玛利亚发财的概率：");
  await diceButton.click();

  const popover = page.getByRole("dialog", { name: "插入骰子" });
  await expect(popover).toBeVisible();
  await popover.getByRole("button", { name: "d100" }).click();
  await expect(page.getByRole("note", { name: "骰子 1d100，待掷" })).toHaveText(
    "1d100 = ?",
  );

  await page.getByRole("button", { name: "正文草稿" }).click();
  const draftPanel = page.getByRole("region", { name: "正文草稿" });
  await expect(draftPanel).toBeVisible();
  await expect(draftPanel).toContainText("浏览器内的正文草稿");
  await draftPanel.scrollIntoViewIfNeeded();
  expect(await draftPanel.evaluate((element) => getComputedStyle(element).position)).not.toBe("fixed");
  await expect(page.getByRole("dialog", { name: "正文草稿" })).toHaveCount(0);
  await page.getByRole("button", { name: "收起正文草稿" }).click();
  await expect(draftPanel).toHaveCount(0);
  await expect(editor).toBeVisible();

  await page.getByLabel("主题帖标题").fill("骰子发布载荷测试");
  await page.getByRole("button", { name: "发布", exact: true }).click();
  await expect.poll(() => submittedBody).toMatch(
    /^玛利亚发财的概率：\[\[dice:v1:[0-9a-f-]{36}:1d100\]\]$/u,
  );
  expect(submittedBody).not.toContain("\\[\\[dice:v1:");
});

import { expect, test } from "@playwright/test";

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

test("编辑器骰子按钮在真实浏览器中打开可见弹窗", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("accessToken", "e2e-local-token");
    localStorage.setItem(
      "user",
      JSON.stringify({
        id: "u-dice-e2e",
        email: "dice-e2e@example.invalid",
        username: "骰子测试",
        avatar: null,
        role: "USER",
        emailVerified: true,
      }),
    );
  });

  await page.route("**/api/v1/threads/draft", (route) =>
    route.fulfill({ json: { code: 0, message: "ok", data: [] } }),
  );
  await page.route("**/api/v1/threads", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    await route.fulfill({ json: { code: 0, message: "ok", data: thread } });
  });
  await page.route("**/api/v1/threads/t-dice-e2e", (route) =>
    route.fulfill({ json: { code: 0, message: "ok", data: thread } }),
  );

  await page.goto("/threads/create");
  await page.getByRole("button", { name: "新建主题帖" }).click();

  const diceButton = page.getByRole("button", { name: "骰子" });
  await expect(diceButton).toBeVisible();
  await diceButton.click();

  const popover = page.getByRole("dialog", { name: "插入骰子" });
  await expect(popover).toBeVisible();
  await expect(popover.getByRole("button", { name: "d20" })).toBeVisible();
});

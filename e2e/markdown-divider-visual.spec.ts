import { expect, test, type Page, type Route } from "@playwright/test";

import { THEME_STORAGE_KEY } from "../src/lib/theme";

const fixedNow = new Date("2026-08-28T12:00:00.000Z");
const threadId = "divider-visual-thread";
const subthreadId = "divider-visual-main";

const owner = {
  id: "divider-visual-owner",
  username: "潮汐记录员",
  avatar: null,
  level: 6,
};

const subthread = {
  id: subthreadId,
  threadId,
  title: "主帖",
  sortOrder: 0,
  postingPolicy: "PARTICIPANTS",
  version: 1,
  lastPostAt: "2026-08-28T10:00:00.000Z",
  deletedAt: null,
  createdAt: "2026-08-20T08:00:00.000Z",
  bodyPost: {
    id: "divider-visual-body",
    content: "这里记录灯塔、潮位与夜航船只的变化。",
    version: 1,
    diceRolls: [],
  },
  _count: { posts: 2 },
};

const thread = {
  id: threadId,
  title: "雾港夜航记录",
  ownerId: owner.id,
  category: "DEDUCTION",
  categoryInfo: { slug: "DEDUCTION", name: "演绎", isActive: true },
  status: "RECRUITING",
  visibility: "PUBLIC",
  published: true,
  publishedAt: "2026-08-20T08:30:00.000Z",
  pinned: false,
  pinnedAt: null,
  viewCount: 42,
  version: 1,
  likeCount: 3,
  tipTotal: "12",
  defaultSubthreadId: subthreadId,
  createdAt: "2026-08-20T08:00:00.000Z",
  updatedAt: "2026-08-28T10:00:00.000Z",
  deletedAt: null,
  owner,
  subthreads: [subthread],
  topicTags: [],
  _count: { members: 4, players: 3, posts: 2 },
  isBookmarked: false,
  bookmarkId: null,
  isLiked: false,
  currentMembership: null,
  capabilities: {
    isOwner: false,
    canManageThread: false,
    canManageMembers: false,
    canPost: false,
  },
};

const floors = [
  {
    id: "divider-floor-1",
    threadId,
    subthreadId,
    authorId: owner.id,
    kind: "FLOOR",
    floorNumber: 1,
    parentPostId: null,
    replyToPostId: null,
    clientRequestId: null,
    content: "第一段记录潮水退去前的灯号。\n\n---\n\n第二段记录短暂熄灭后的回航信号。",
    version: 1,
    createdAt: "2026-08-28T09:00:00.000Z",
    updatedAt: "2026-08-28T09:00:00.000Z",
    deletedAt: null,
    author: owner,
    _count: { replies: 0 },
    replies: [],
    diceRolls: [],
  },
  {
    id: "divider-floor-2",
    threadId,
    subthreadId,
    authorId: "divider-visual-witness",
    kind: "FLOOR",
    floorNumber: 2,
    parentPostId: null,
    replyToPostId: null,
    clientRequestId: null,
    content: "我在第二层补充一条目击记录，楼层边界仍保持完整宽度。",
    version: 1,
    createdAt: "2026-08-28T10:00:00.000Z",
    updatedAt: "2026-08-28T10:00:00.000Z",
    deletedAt: null,
    author: {
      id: "divider-visual-witness",
      username: "北堤守夜人",
      avatar: null,
      level: 3,
    },
    _count: { replies: 0 },
    replies: [],
    diceRolls: [],
  },
];

async function fulfill(route: Route, data: unknown, meta?: Record<string, unknown>) {
  await route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ code: 0, message: "ok", data, ...(meta ? { meta } : {}) }),
  });
}

async function mockThread(page: Page) {
  await page.clock.setFixedTime(fixedNow);
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await page.route("**/api/v1/**", async (route) => {
    const { pathname } = new URL(route.request().url());

    if (pathname.endsWith("/auth/refresh")) {
      return route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ code: 1001, message: "unauthorized" }),
      });
    }
    if (pathname.endsWith(`/threads/${threadId}`)) {
      return fulfill(route, thread);
    }
    if (pathname.endsWith(`/subthreads/${subthreadId}/posts/authors`)) {
      return fulfill(route, [owner]);
    }
    if (pathname.endsWith(`/subthreads/${subthreadId}/posts`)) {
      return fulfill(route, floors, { cursor: null, hasMore: false });
    }
    if (pathname.endsWith("/thread-categories")) {
      return fulfill(route, []);
    }
    return fulfill(route, null);
  });
}

for (const theme of ["light", "dark"] as const) {
  test(`正文分隔线与楼层边界保持区分（${theme}）`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.addInitScript(
      ([storageKey, value]) => localStorage.setItem(storageKey, value),
      [THEME_STORAGE_KEY, theme],
    );
    await mockThread(page);
    await page.goto(`/threads/${threadId}`);
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });

    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await expect(page.getByRole("heading", { name: thread.title })).toBeVisible();
    await expect(page.getByText("第二段记录短暂熄灭后的回航信号。")).toBeVisible();
    await expect(page.getByText("我在第二层补充一条目击记录")).toBeVisible();

    const firstFloor = page.locator("#post-divider-floor-1");
    const divider = firstFloor.locator('[data-slot="markdown-content"] hr');
    await expect(divider).toHaveCount(1);
    await expect(divider).toHaveRole("separator");

    const geometry = await divider.evaluate((element) => {
      const style = getComputedStyle(element);
      const before = getComputedStyle(element, "::before");
      const after = getComputedStyle(element, "::after");
      const resolveColor = (token: string) => {
        const probe = document.createElement("span");
        probe.style.backgroundColor = `var(${token})`;
        document.body.append(probe);
        const color = getComputedStyle(probe).backgroundColor;
        probe.remove();
        return color;
      };
      return {
        width: Number.parseFloat(style.width),
        fontSize: Number.parseFloat(style.fontSize),
        height: Number.parseFloat(style.height),
        marginTop: Number.parseFloat(style.marginTop),
        lineThickness: Number.parseFloat(before.height),
        lineColor: before.backgroundColor,
        expectedLineColor: resolveColor("--element-divider-color"),
        markerWidth: Number.parseFloat(after.width),
        markerHeight: Number.parseFloat(after.height),
        markerColor: after.backgroundColor,
        expectedMarkerColor: resolveColor("--element-divider-marker"),
      };
    });
    const floorBox = await firstFloor.boundingBox();
    const proseBox = await firstFloor
      .locator('[data-slot="markdown-content"]')
      .boundingBox();
    const dividerBox = await divider.boundingBox();

    expect(floorBox).not.toBeNull();
    expect(proseBox).not.toBeNull();
    expect(dividerBox).not.toBeNull();
    expect(geometry.width / proseBox!.width).toBeCloseTo(0.5, 2);
    expect(geometry.height).toBe(5);
    expect(geometry.marginTop).toBeCloseTo(geometry.fontSize * 1.75, 3);
    expect(geometry.lineThickness).toBe(1);
    expect(geometry.lineColor).toBe(geometry.expectedLineColor);
    expect(geometry.markerWidth).toBe(5);
    expect(geometry.markerHeight).toBe(5);
    expect(geometry.markerColor).toBe(geometry.expectedMarkerColor);
    expect(dividerBox!.width / floorBox!.width).toBeGreaterThan(0.4);
    expect(dividerBox!.width / floorBox!.width).toBeLessThan(0.55);
    expect(
      Math.abs(
        dividerBox!.x + dividerBox!.width / 2 -
        (proseBox!.x + proseBox!.width / 2),
      ),
    ).toBeLessThanOrEqual(1);

    await page.evaluate(() => document.fonts.ready);
    await expect(page.getByRole("region", { name: "帖子回复" })).toHaveScreenshot(
      `markdown-divider-${theme}-1440.png`,
      { animations: "disabled" },
    );
  });
}

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const owner = {
  id: "management-owner",
  email: "management-owner@example.test",
  username: "雾港记录员",
  avatar: null,
  role: "USER",
  emailVerified: true,
};

const defaultSubthread = {
  id: "management-main",
  threadId: "management-visual-thread",
  title: "雾港夜航调查录",
  sortOrder: 0,
  postingPolicy: "PARTICIPANTS",
  version: 3,
  lastPostAt: "2026-08-11T20:00:00.000Z",
  deletedAt: null,
  createdAt: "2026-08-01T08:00:00.000Z",
  bodyPost: {
    id: "management-main-body",
    content: "港口连续七夜出现没有船籍的灯号。请记录目击时间、潮位与当晚在场人员。",
    version: 4,
    diceRolls: [],
  },
  _count: { posts: 18 },
};

const subthreads = [
  defaultSubthread,
  {
    ...defaultSubthread,
    id: "management-setting",
    title: "航线与港区设定",
    sortOrder: 1,
    postingPolicy: "COLLABORATORS",
    version: 2,
    bodyPost: {
      id: "management-setting-body",
      content: "北堤封锁，旧灯塔仅在退潮后可以抵达。",
      version: 2,
      diceRolls: [],
    },
    _count: { posts: 7 },
  },
  {
    ...defaultSubthread,
    id: "management-clues",
    title: "线索归档",
    sortOrder: 2,
    postingPolicy: "PLAYERS",
    version: 1,
    bodyPost: {
      id: "management-clues-body",
      content: "按发现顺序整理证词、航海日志和失物。",
      version: 1,
      diceRolls: [],
    },
    _count: { posts: 11 },
  },
];

const thread = {
  id: "management-visual-thread",
  title: "雾港夜航调查录",
  ownerId: owner.id,
  category: "DEDUCTION",
  status: "RECRUITING",
  visibility: "PRIVATE",
  published: true,
  publishedAt: "2026-08-01T08:30:00.000Z",
  pinned: false,
  pinnedAt: null,
  viewCount: 126,
  version: 8,
  likeCount: 9,
  tipTotal: "36",
  defaultSubthreadId: defaultSubthread.id,
  createdAt: "2026-08-01T08:00:00.000Z",
  updatedAt: "2026-08-11T20:00:00.000Z",
  deletedAt: null,
  owner: { ...owner, level: 6 },
  subthreads,
  topicTags: [
    {
      id: "management-tag-relation-1",
      threadId: "management-visual-thread",
      tagId: "management-tag-1",
      tag: {
        id: "management-tag-1",
        name: "都市奇谈",
        color: null,
        description: null,
        sortOrder: 10,
        isActive: true,
      },
    },
    {
      id: "management-tag-relation-2",
      threadId: "management-visual-thread",
      tagId: "management-tag-2",
      tag: {
        id: "management-tag-2",
        name: "长期调查",
        color: null,
        description: null,
        sortOrder: 20,
        isActive: true,
      },
    },
  ],
  _count: { members: 12, players: 6, posts: 36 },
  isBookmarked: false,
  bookmarkId: null,
  isLiked: false,
  currentMembership: {
    id: "management-owner-membership",
    userId: owner.id,
    role: "OWNER",
    playerMarked: true,
  },
  capabilities: {
    isOwner: true,
    canManageThread: true,
    canManageMembers: true,
    canPost: true,
  },
};

const categories = [
  {
    id: "management-category-deduction",
    slug: "DEDUCTION",
    name: "演绎",
    description: "共同推演事件与线索",
    color: null,
    icon: null,
    sortOrder: 10,
    isActive: true,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
  },
];

async function mockManagementWorkspace(page: Page) {
  await page.clock.setFixedTime(new Date("2026-08-12T12:00:00.000Z"));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/v1/**", (route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());
    const response = (data: unknown, meta?: Record<string, unknown>) => route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ code: 0, message: "ok", data, ...(meta ? { meta } : {}) }),
    });

    if (pathname.endsWith("/auth/refresh")) {
      return response({ accessToken: "management-visual-token", user: owner });
    }
    if (pathname.endsWith("/wallet/check-in")) {
      return response({ claimedNow: false, rewardAmount: "0", balance: "120" });
    }
    if (pathname.endsWith("/notifications/unread")) {
      return response({ unreadCount: 0 });
    }
    if (pathname.endsWith("/direct-conversations/unread")) {
      return response({ unreadMessageCount: 0, pendingRequestCount: 0, total: 0 });
    }
    if (pathname.endsWith("/thread-categories")) {
      return response(categories);
    }
    if (pathname.endsWith("/threads/management-visual-thread/members")) {
      return response([]);
    }
    if (pathname.endsWith("/threads/management-visual-thread")) {
      return response(thread);
    }
    return response(null);
  });
}

async function openManagementWorkspace(page: Page, query = "") {
  await mockManagementWorkspace(page);
  await page.goto(`/threads/management-visual-thread/edit${query}`);
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  await expect(page.getByRole("heading", { name: thread.title })).toBeVisible();
}

test.describe("帖子共同创作管理台", () => {
  test("1440px 设置页视觉基线", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await openManagementWorkspace(page);

    await expect(page.getByRole("tab", { name: "帖子设置" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.getByRole("heading", { name: "标题与主帖正文" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "发布设置" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "危险操作" })).toBeVisible();
    await expect(page.getByRole("toolbar", { name: "正文格式工具栏" })).toBeVisible();
    await expect(page).toHaveScreenshot("management-settings-1440.png", {
      animations: "disabled",
    });
  });

  test("1024px 子贴深链接无横向溢出", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 900 });
    await openManagementWorkspace(
      page,
      "?view=subthreads&subthread=management-setting",
    );

    await expect(page.getByRole("tab", { name: /子贴内容 2/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.getByLabel("子贴标题")).toHaveValue("航线与港区设定");
    await expect(page.getByText("01")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(1024);
  });

  test("管理台无 WCAG A/AA 自动检测违规", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await openManagementWorkspace(page, "?view=subthreads&subthread=management-clues");

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  });
});

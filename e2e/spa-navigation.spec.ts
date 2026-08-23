import { expect, test, type Page, type Route } from "@playwright/test";

const fixedNow = new Date("2026-08-08T12:00:00Z");

function makeThread(index: number) {
  const id = `spa-thread-${index}`;
  return {
    id,
    title: `漫游记录 ${String(index).padStart(2, "0")}`,
    category: index % 2 === 0 ? "RPG" : "NATION",
    status: "RECRUITING",
    visibility: "PUBLIC",
    published: true,
    pinned: false,
    createdAt: "2026-08-07T08:00:00Z",
    updatedAt: "2026-08-08T11:30:00Z",
    deletedAt: null,
    tipTotal: String(index),
    owner: {
      id: `spa-user-${index}`,
      username: `旅人 ${index}`,
      avatar: null,
      level: (index % 9) + 1,
    },
    defaultSubthread: {
      id: `spa-subthread-${index}`,
      title: "主帖",
      lastPostAt: null,
    },
    topicTags: [],
    _count: { members: 4, players: 3, posts: index },
    preview: `这是第 ${index} 条用于验证列表返回位置的公开主题帖摘要。`,
    coverImages: [],
  };
}

function makeThreadDetail(index: number) {
  const listItem = makeThread(index);
  return {
    id: listItem.id,
    title: listItem.title,
    ownerId: listItem.owner.id,
    category: listItem.category,
    status: listItem.status,
    visibility: listItem.visibility,
    published: true,
    publishedAt: listItem.createdAt,
    pinned: false,
    pinnedAt: null,
    viewCount: 18,
    version: 1,
    likeCount: 2,
    tipTotal: listItem.tipTotal,
    defaultSubthreadId: listItem.defaultSubthread.id,
    createdAt: listItem.createdAt,
    updatedAt: listItem.updatedAt,
    deletedAt: null,
    owner: listItem.owner,
    subthreads: [
      {
        id: listItem.defaultSubthread.id,
        threadId: listItem.id,
        title: "主帖",
        sortOrder: 0,
        postingPolicy: "PARTICIPANTS",
        version: 1,
        lastPostAt: null,
        deletedAt: null,
        createdAt: listItem.createdAt,
        bodyPost: null,
        _count: { posts: 0 },
      },
    ],
    topicTags: [],
    _count: { members: 4, players: 3, posts: index },
  };
}

function makeMultiSubthreadDetail(index: number) {
  const detail = makeThreadDetail(index);
  const makeSubthread = (id: string, title: string, sortOrder: number) => ({
    ...detail.subthreads[0],
    id,
    title,
    sortOrder,
    bodyPost: {
      id: `body-${id}`,
      content: `${title}正文`,
      version: 1,
      diceRolls: [],
    },
  });
  return {
    ...detail,
    subthreads: [
      makeSubthread(detail.defaultSubthreadId, "主帖", 0),
      makeSubthread(`${detail.defaultSubthreadId}-setting`, "设定区", 1),
      makeSubthread(`${detail.defaultSubthreadId}-plot`, "剧情区", 2),
      makeSubthread(`${detail.defaultSubthreadId}-chat`, "闲聊区", 3),
    ],
  };
}

async function fulfill(route: Route, data: unknown, meta?: Record<string, unknown>) {
  await route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ code: 0, message: "ok", data, ...(meta ? { meta } : {}) }),
  });
}

async function mockPublicBrowsing(
  page: Page,
  detailDelayMs = 0,
  detailFactory: (index: number) => unknown = makeThreadDetail,
) {
  const threads = Array.from({ length: 40 }, (_, index) => makeThread(index + 1));
  await page.clock.setFixedTime(fixedNow);
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const { pathname } = url;

    if (pathname.endsWith("/auth/refresh")) {
      return route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ code: 1001, message: "unauthorized" }),
      });
    }
    if (pathname.endsWith("/thread-categories")) {
      return fulfill(route, [
        {
          id: "spa-category-rpg",
          slug: "RPG",
          name: "角色扮演",
          description: null,
          color: null,
          icon: null,
          sortOrder: 0,
          isActive: true,
          createdAt: "2026-08-01T00:00:00Z",
          updatedAt: "2026-08-01T00:00:00Z",
        },
        {
          id: "spa-category-nation",
          slug: "NATION",
          name: "国策",
          description: null,
          color: null,
          icon: null,
          sortOrder: 1,
          isActive: true,
          createdAt: "2026-08-01T00:00:00Z",
          updatedAt: "2026-08-01T00:00:00Z",
        },
      ]);
    }
    if (pathname.endsWith("/threads")) {
      const secondPage = url.searchParams.get("cursor") === "spa-page-2";
      return fulfill(
        route,
        secondPage ? threads.slice(20) : threads.slice(0, 20),
        secondPage
          ? { cursor: null, hasMore: false }
          : { cursor: "spa-page-2", hasMore: true },
      );
    }

    const detailMatch = pathname.match(/\/threads\/spa-thread-(\d+)$/);
    if (detailMatch) {
      if (detailDelayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, detailDelayMs));
      }
      return fulfill(route, detailFactory(Number(detailMatch[1])));
    }

    const floorAuthorMatch = pathname.match(/\/subthreads\/spa-subthread-(\d+)[^/]*\/posts\/authors$/);
    if (floorAuthorMatch) {
      const index = Number(floorAuthorMatch[1]);
      return fulfill(route, [
        {
          id: `spa-user-${index}`,
          username: `旅人 ${index}`,
          avatar: null,
          level: (index % 9) + 1,
          role: "OWNER",
          playerMarked: false,
        },
      ]);
    }

    if (/\/subthreads\/spa-subthread-[^/]+\/posts$/.test(pathname)) {
      return fulfill(route, [], { cursor: null, hasMore: false });
    }

    return fulfill(route, null);
  });
}

test.describe("公开浏览的单页式导航体验", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  test("加载多页后进入帖子，后退恢复筛选、内容和滚动位置", async ({ page }) => {
    await mockPublicBrowsing(page);
    await page.goto("/?sort=active");

    await expect(page.getByRole("heading", { name: "发现主题帖" })).toBeVisible();
    await page.getByRole("link", { name: "查看主题帖：漫游记录 20" }).scrollIntoViewIfNeeded();
    await expect(page.getByRole("link", { name: "查看主题帖：漫游记录 25" })).toBeVisible();

    const returnTarget = page.getByRole("link", { name: "查看主题帖：漫游记录 25" });
    await returnTarget.evaluate((element) => element.scrollIntoView({ block: "center" }));
    const scrollBefore = await page.evaluate(() => window.scrollY);

    await returnTarget.click();
    await expect(page).toHaveURL(/\/threads\/spa-thread-25$/);
    await expect(page.getByRole("heading", { name: "漫游记录 25" })).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL(/\/?sort=active$/);
    await expect(returnTarget).toBeVisible();
    await expect
      .poll(async () => Math.abs((await page.evaluate(() => window.scrollY)) - scrollBefore))
      .toBeLessThanOrEqual(16);
  });

  test("详情响应较慢时保留应用壳，并显示骨架和延迟进度线", async ({ page }) => {
    await mockPublicBrowsing(page, 3000);
    await page.goto("/");
    await expect(page.getByRole("link", { name: "查看主题帖：漫游记录 01" })).toBeVisible();

    await page
      .getByRole("link", { name: "查看主题帖：漫游记录 01" })
      .click({ noWaitAfter: true });
    await expect(page).toHaveURL(/\/threads\/spa-thread-1$/);
    await expect(page.getByRole("complementary", { name: "全局导航" })).toBeVisible();
    await expect(page.getByRole("status", { name: "页面加载中" })).toBeVisible();

    await page.waitForTimeout(180);
    const progressOpacity = await page
      .locator('[data-slot="navigation-progress"]')
      .first()
      .evaluate((element) => Number.parseFloat(getComputedStyle(element).opacity));
    expect(progressOpacity).toBeGreaterThan(0);

    await expect(page.getByRole("heading", { name: "漫游记录 01" })).toBeVisible();
    await expect(page.getByRole("status", { name: "页面加载中" })).toHaveCount(0);
  });

  test("子贴使用浅层 URL 切换，并复用预取的楼层缓存", async ({ page }) => {
    const rscRequests: string[] = [];
    const floorRequests: string[] = [];
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (
        url.pathname === "/threads/spa-thread-1" &&
        url.searchParams.has("_rsc")
      ) {
        rscRequests.push(request.url());
      }
      if (url.pathname.startsWith("/api/v1/subthreads/") && url.pathname.endsWith("/posts")) {
        floorRequests.push(url.pathname);
      }
    });

    await mockPublicBrowsing(page, 0, makeMultiSubthreadDetail);
    await page.goto(
      "/threads/spa-thread-1?subthread=spa-subthread-1&order=NEWEST",
    );
    await expect(page.getByRole("heading", { name: "漫游记录 01" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "主帖", exact: true })).toBeVisible();
    await expect(page).toHaveURL(
      /\/threads\/spa-thread-1\?order=NEWEST$/,
    );
    await expect.poll(() => floorRequests.length).toBeGreaterThanOrEqual(3);

    rscRequests.length = 0;
    const plotFloorPath = "/api/v1/subthreads/spa-subthread-1-plot/posts";
    const switchTo = async (label: string) => {
      await page.getByRole("combobox", { name: /切换子贴/ }).first().click();
      await page.getByRole("option", { name: new RegExp(`^${label}`) }).click();
    };

    await switchTo("剧情区");
    await expect(page).toHaveURL((url) =>
      url.pathname === "/threads/spa-thread-1" &&
      url.searchParams.get("subthread") === "spa-subthread-1-plot" &&
      url.searchParams.get("order") === "NEWEST",
    );
    await expect(page.getByRole("heading", { name: "剧情区", exact: true })).toBeVisible();
    await expect.poll(() => floorRequests.filter((path) => path === plotFloorPath).length).toBe(1);
    expect(rscRequests).toHaveLength(0);

    await switchTo("主帖");
    await expect(page).toHaveURL(
      /\/threads\/spa-thread-1\?order=NEWEST$/,
    );
    await expect(page.getByRole("heading", { name: "主帖", exact: true })).toBeVisible();

    await switchTo("剧情区");
    await expect(page.getByRole("heading", { name: "剧情区", exact: true })).toBeVisible();
    await page.waitForTimeout(50);
    expect(floorRequests.filter((path) => path === plotFloorPath)).toHaveLength(1);
    expect(rscRequests).toHaveLength(0);
  });

  test("主楼层直接切换时间顺序，并从当前子贴候选只看某人", async ({ page }) => {
    const filteredRequests: string[] = [];
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (url.searchParams.get("authorId")) filteredRequests.push(url.href);
    });
    await mockPublicBrowsing(page);
    await page.goto("/threads/spa-thread-1");

    const sortToggle = page.getByRole("button", { name: "楼层排序" });
    await expect(sortToggle).toContainText("最早在前");
    await sortToggle.click();
    await expect(page).toHaveURL(/\/threads\/spa-thread-1\?order=NEWEST$/);
    await expect(sortToggle).toContainText("最新在前");

    await page.getByRole("combobox", { name: "只看某人的楼层" }).click();
    await page.getByRole("option", { name: "旅人 1 楼主" }).click();
    await expect.poll(() => filteredRequests.length).toBe(1);
    expect(new URL(filteredRequests[0]).searchParams.get("authorId")).toBe("spa-user-1");
    await expect(page).toHaveURL(/\/threads\/spa-thread-1\?order=NEWEST$/);
  });
});

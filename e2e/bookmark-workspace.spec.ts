import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function mockBookmarks(page: Page, folderCount = 100) {
  const user = { id: "bookmark-workspace-user", username: "温油读者", email: "bookmark-workspace@example.test", role: "USER", avatar: null, profileCover: null, level: 3 };
  const folders = Array.from({ length: folderCount }, (_, i) => ({ id: `folder-${i}`, name: i ? `跑团资料与人物设定 ${i}` : "默认收藏夹", isDefault: i === 0, createdAt: "2026-09-01T00:00:00Z" }));
  let bookmarks = Array.from({ length: 12 }, (_, i) => ({ id: `ux-thread-${i}`, title: `雾海来信：人物设定与世界观 ${i}`, category: "RPG", categoryInfo: { id: "rpg", slug: "RPG", name: "角色扮演" }, owner: user, createdAt: "2026-09-01T00:00:00Z", bookmarkId: `bookmark-${i}`, bookmarkFolderId: "folder-0" }));
  let momentRequests = 0;
  const writes: { method: string; path: string; body: Record<string, string> | null }[] = [];
  await page.route("**/api/v1/**", async (route) => {
    const { pathname, searchParams } = new URL(route.request().url());
    const method = route.request().method();
    const body = route.request().postDataJSON() as Record<string, string> | null;
    let data: unknown = [];
    let meta = { cursor: null as string | null, hasMore: false };
    if (method !== "GET" && !pathname.endsWith("/auth/refresh")) writes.push({ method, path: pathname, body });
    if (pathname.endsWith("/auth/refresh")) data = { accessToken: "mock-bookmark-workspace-token", user };
    else if (pathname.endsWith("/users/me")) data = user;
    else if (pathname.endsWith("/notifications/unread")) data = { unreadCount: 0 };
    else if (pathname.endsWith("/direct-conversations/unread")) data = { total: 0 };
    else if (pathname.endsWith("/moments/bookmark-folders")) data = [{ ...folders[0], id: "moment-folder", momentBookmarkCount: 0 }];
    else if (pathname.endsWith("/moments/bookmarks")) { momentRequests++; data = []; }
    else if (pathname.endsWith("/bookmarks/folders")) {
      if (method === "POST") {
        const folder = { id: "folder-new", name: body!.name, isDefault: false, createdAt: "2026-09-01T00:00:00Z" };
        folders.push(folder);
        data = { ...folder, bookmarkCount: 0 };
      } else data = folders.map((folder) => ({ ...folder, bookmarkCount: bookmarks.filter((item) => item.bookmarkFolderId === folder.id).length }));
    } else if (/\/bookmarks\/bookmark-/.test(pathname)) {
      const id = pathname.split("/").at(-1);
      if (method === "PATCH") bookmarks = bookmarks.map((item) => item.bookmarkId === id ? { ...item, bookmarkFolderId: body!.folderId } : item);
      else bookmarks = bookmarks.filter((item) => item.bookmarkId !== id);
      data = {};
    } else if (pathname.endsWith("/bookmarks")) {
      if (method === "POST") {
        bookmarks.push({ id: body!.threadId, title: "雾海来信：人物设定与世界观 0", category: "RPG", categoryInfo: { id: "rpg", slug: "RPG", name: "角色扮演" }, owner: user, createdAt: "2026-09-01T00:00:00Z", bookmarkId: "bookmark-restored", bookmarkFolderId: body!.folderId });
        data = {};
      } else {
        const filtered = bookmarks.filter((item) => !searchParams.has("folderId") || item.bookmarkFolderId === searchParams.get("folderId"));
        const start = Number(searchParams.get("cursor") ?? 0);
        data = filtered.slice(start, start + 10);
        meta = { cursor: start + 10 < filtered.length ? String(start + 10) : null, hasMore: start + 10 < filtered.length };
      }
    }
    await route.fulfill({ json: { code: 0, message: "ok", data, meta } });
  });
  return { writes, momentRequests: () => momentRequests };
}

for (const colorScheme of ["light", "dark"] as const) {
  test(`${colorScheme} 下大量目录可定位，桌面布局与键盘菜单可用`, async ({ page }, testInfo) => {
    await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
    await mockBookmarks(page);
    await page.goto("/bookmarks");
    await expect(page.getByRole("button", { name: /跑团资料与人物设定 99/ })).toBeAttached();
    for (const width of [1024, 1280, 1440, 1920]) {
      await page.setViewportSize({ width, height: 1000 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      const navigation = page.getByRole("complementary", { name: "收藏目录" });
      const content = page.getByRole("region", { name: "收藏内容" });
      expect((await navigation.boundingBox())!.x + (await navigation.boundingBox())!.width).toBeLessThan((await content.boundingBox())!.x);
      await expect(page.getByRole("button", { name: "新建主题帖收藏夹" })).toBeInViewport();
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({ path: testInfo.outputPath(`bookmarks-${colorScheme}.png`), fullPage: true });
    await page.getByRole("searchbox").fill("设定 99");
    await page.getByRole("button", { name: /跑团资料与人物设定 99/ }).click();
    await expect(page).toHaveURL(/folder=folder-99/);
    await expect(page.getByRole("heading", { name: "跑团资料与人物设定 99" })).toBeVisible();
    await expect(page.getByText("这个收藏夹还是空的")).toBeVisible();
    const accessibility = await new AxeBuilder({ page }).include("main").analyze();
    expect(accessibility.violations).toEqual([]);
  });
}

test("目录 URL、分页、移动、撤销和新建构成完整旅程", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const mock = await mockBookmarks(page, 30);
  await page.goto("/bookmarks?folder=folder-0");
  await expect(page.getByRole("heading", { name: "默认收藏夹" })).toBeVisible();
  expect(mock.momentRequests()).toBe(0);
  await page.getByRole("button", { name: "更多收藏操作：雾海来信：人物设定与世界观 0", exact: true }).focus();
  await page.keyboard.press("Enter");
  await page.getByRole("menuitem", { name: "移动到收藏夹" }).click();
  const dialog = page.getByRole("dialog", { name: "移动到收藏夹" });
  await dialog.getByRole("searchbox").fill("设定 29");
  await dialog.getByText("跑团资料与人物设定 29", { exact: true }).click();
  await dialog.getByRole("button", { name: "移动", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("link", { name: "雾海来信：人物设定与世界观 0", exact: true })).not.toBeVisible();
  await page.getByRole("searchbox").fill("设定 29");
  await page.getByRole("button", { name: /设定 29/ }).click();
  await page.reload();
  await expect(page.getByRole("heading", { name: "跑团资料与人物设定 29" })).toBeVisible();
  await page.getByRole("button", { name: /更多收藏操作/ }).click();
  await page.getByRole("menuitem", { name: "取消收藏" }).click();
  await expect(page.getByText("这个收藏夹还是空的")).toBeVisible();
  await page.getByRole("button", { name: "撤销", exact: true }).click();
  await expect(page.getByRole("link", { name: "雾海来信：人物设定与世界观 0", exact: true })).toBeVisible();
  expect(mock.writes.at(-1)?.body).toEqual({ threadId: "ux-thread-0", folderId: "folder-29" });
  await page.getByRole("tab", { name: "动态", exact: true }).click();
  await expect(page.getByText("还没有收藏动态")).toBeVisible();
  await page.getByRole("tab", { name: "主题帖", exact: true }).click();
  await expect(page.getByRole("heading", { name: "跑团资料与人物设定 29" })).toBeVisible();
  await page.getByRole("searchbox").fill("不存在");
  await page.getByRole("button", { name: "新建主题帖收藏夹" }).click();
  await page.getByLabel("收藏夹名称").fill("以后参加的团");
  await page.getByRole("button", { name: "新建", exact: true }).click();
  await expect(page.getByRole("heading", { name: "以后参加的团" })).toBeVisible();
  await expect(page.getByRole("searchbox")).toHaveValue("");
  await page.goBack();
  await expect(page.getByRole("heading", { name: "跑团资料与人物设定 29" })).toBeVisible();
  await page.getByRole("button", { name: /全部收藏/ }).click();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(page.getByText("没有更多了")).toBeVisible();
});

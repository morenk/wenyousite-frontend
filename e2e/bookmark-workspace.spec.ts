import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function mockBookmarks(page: Page, folderCount = 100) {
  const user = { id: "bookmark-workspace-user", username: "温油读者", email: "bookmark-workspace@example.test", role: "USER", avatar: null, profileCover: null, level: 3 };
  const folders = Array.from({ length: folderCount }, (_, i) => ({ id: `folder-${i}`, name: i ? `跑团资料与人物设定 ${i}` : "默认收藏夹", isDefault: i === 0, createdAt: "2026-09-01T00:00:00Z" }));
  let bookmarks = Array.from({ length: 12 }, (_, i) => ({ id: `ux-thread-${i}`, title: `雾海来信：人物设定与世界观 ${i}`, category: "RPG", categoryInfo: { id: "rpg", slug: "RPG", name: "角色扮演" }, owner: user, createdAt: "2026-09-01T00:00:00Z", bookmarkId: `bookmark-${i}`, bookmarkFolderId: "folder-0" }));
  const momentFolders = [{ ...folders[0], id: "moment-folder", momentBookmarkCount: 0 }];
  let folderFailure = false;
  let createFailure = false;
  let momentRequests = 0;
  const writes: { method: string; path: string; body: Record<string, string> | null }[] = [];
  await page.route("**/api/v1/**", async (route) => {
    const { pathname, searchParams } = new URL(route.request().url());
    const method = route.request().method();
    const body = route.request().postDataJSON() as Record<string, string> | null;
    let data: unknown = [];
    let meta = { cursor: null as string | null, hasMore: false };
    const isFolderPath = pathname.endsWith("/bookmarks/folders") || pathname.endsWith("/moments/bookmark-folders");
    if (isFolderPath && ((method === "GET" && folderFailure) || (method === "POST" && createFailure))) {
      await route.fulfill({ status: 500, json: { code: 50000, message: "测试收藏夹请求失败" } });
      return;
    }
    if (method !== "GET" && !pathname.endsWith("/auth/refresh")) writes.push({ method, path: pathname, body });
    if (pathname.endsWith("/auth/refresh")) data = { accessToken: "mock-bookmark-workspace-token", user };
    else if (pathname.endsWith("/users/me")) data = user;
    else if (pathname.endsWith("/wallet")) data = { balance: "0" };
    else if (pathname.endsWith("/notifications/unread")) data = { unreadCount: 0 };
    else if (pathname.endsWith("/direct-conversations/unread")) data = { total: 0 };
    else if (pathname === `/api/v1/users/${user.id}`) data = {
      ...user, bio: null, receivedTipTotal: "0", receivedTipCount: 0, showBookmarks: true,
      showRecentReplies: true, showPlayerBadges: true, accountStatus: "ACTIVE",
      createdAt: "2026-09-01T00:00:00Z", _count: { following: 0, followers: 0 },
    };
    else if (pathname.startsWith(`/api/v1/users/${user.id}/`)) data = [];
    else if (pathname.endsWith("/moments/bookmark-folders")) {
      if (method === "POST") {
        const folder = { ...momentFolders[0], id: "moment-folder-new", name: body!.name, isDefault: false };
        momentFolders.push(folder);
        data = folder;
      } else data = momentFolders;
    }
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
  return { writes, momentRequests: () => momentRequests, setFolderFailure: (value: boolean) => { folderFailure = value; }, setCreateFailure: (value: boolean) => { createFailure = value; } };
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

for (const kind of ["threads", "moments"] as const) {
  test(`本人资料页 ${kind} 可进入目录，新建空夹后刷新与返回仍可定位`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1280, height: 1000 });
    const mock = await mockBookmarks(page, 2);
    const profilePath = "/users/bookmark-workspace-user/bookmarks";
    await page.goto(profilePath);
    if (kind === "moments") await page.getByRole("tab", { name: "动态", exact: true }).click();
    const entry = page.getByRole("link", { name: "我的收藏夹", exact: true });
    await expect(entry).toHaveAttribute("href", `/bookmarks?type=${kind}`);
    await page.screenshot({ path: testInfo.outputPath(`profile-folder-entry-${kind}.png`), fullPage: true });
    await entry.click();
    await expect(page.getByRole("complementary", { name: "收藏目录" })).toBeVisible();
    await expect(page.getByRole("button", { name: /默认收藏夹/ })).toBeVisible();
    if (kind === "threads") await expect(page.getByRole("button", { name: /跑团资料与人物设定 1/ })).toBeVisible();
    // 返回资料页保留管理页缓存，覆盖新建后旧缓存误判目录无效的路径。
    await page.goBack();
    if (kind === "moments") await page.getByRole("tab", { name: "动态", exact: true }).click();
    await page.getByRole("button", { name: kind === "threads" ? "新建主题帖收藏夹" : "新建动态收藏夹" }).click();
    await page.getByLabel("收藏夹名称").fill("资料页新建的空夹");
    mock.setCreateFailure(true);
    await page.getByRole("button", { name: "新建", exact: true }).click();
    await expect(page.getByText("测试收藏夹请求失败", { exact: true })).toBeVisible();
    await expect(page.getByLabel("收藏夹名称")).toHaveValue("资料页新建的空夹");
    await expect(page).toHaveURL(new RegExp(`${profilePath}$`));
    mock.setCreateFailure(false);
    await page.getByRole("button", { name: "新建", exact: true }).click();
    const folderId = kind === "threads" ? "folder-new" : "moment-folder-new";
    await expect(page).toHaveURL(new RegExp(`type=${kind}&folder=${folderId}$`));
    await expect(page.getByRole("heading", { name: "资料页新建的空夹" })).toBeVisible();
    await expect(page.getByRole("button", { name: /资料页新建的空夹/ })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText(kind === "threads" ? "这个收藏夹还是空的" : "这个收藏夹还没有动态")).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: "资料页新建的空夹" })).toBeVisible();
    await page.getByRole("tab", { name: kind === "threads" ? "动态" : "主题帖", exact: true }).click();
    await page.getByRole("tab", { name: kind === "threads" ? "主题帖" : "动态", exact: true }).click();
    await expect(page.getByRole("heading", { name: "资料页新建的空夹" })).toBeVisible();
    await page.getByRole("button", { name: /全部收藏/ }).click();
    await page.goBack();
    await expect(page.getByRole("heading", { name: "资料页新建的空夹" })).toBeVisible();
    mock.setFolderFailure(true);
    await page.reload();
    await expect(page.getByText("收藏夹加载失败", { exact: true })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`folder=${folderId}$`));
    mock.setFolderFailure(false);
    await page.getByRole("button", { name: "重试", exact: true }).click();
    await expect(page.getByRole("heading", { name: "资料页新建的空夹" })).toBeVisible();
  });
}

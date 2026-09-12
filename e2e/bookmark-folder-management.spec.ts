import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

for (const kind of ["threads", "moments"] as const) {
  test(`${kind} 自定义夹重命名和删除保留收藏，失败保留位置，成功替换历史`, async ({ page }, testInfo) => {
    const user = { id: "folder-management-user", username: "收藏读者", email: "folder-management@example.test", role: "USER", avatar: null, profileCover: null, level: 3 };
    const base = kind === "threads" ? "/api/v1/bookmarks/folders" : "/api/v1/moments/bookmark-folders";
    const listPath = kind === "threads" ? "/api/v1/bookmarks" : "/api/v1/moments/bookmarks";
    let folders = [{ id: "default", name: "默认收藏夹", isDefault: true, bookmarkCount: 0, momentBookmarkCount: 0, createdAt: "2026-09-01" },
      { id: "custom", name: "待整理", isDefault: false, bookmarkCount: 1, momentBookmarkCount: 1, createdAt: "2026-09-01" }];
    let folderId = "custom";
    let fail = true;
    let release: (() => void) | undefined;
    let hold = false;
    const writes: { method: string; path: string; body: unknown }[] = [];
    await page.route("**/api/v1/**", async (route) => {
      const request = route.request();
      const { pathname, searchParams } = new URL(request.url());
      const method = request.method();
      let data: unknown = [];
      if (pathname === `${base}/custom`) {
        writes.push({ method, path: pathname, body: request.postDataJSON() });
        if (hold) await new Promise<void>((resolve) => { release = resolve; });
        if (fail) { await route.fulfill({ status: 409, json: { code: 40900, message: "测试写入失败" } }); return; }
        if (method === "PATCH") {
          folders[1].name = request.postDataJSON().name;
          data = folders[1];
        } else {
          folders = [{ ...folders[0], bookmarkCount: 1, momentBookmarkCount: 1 }];
          folderId = "default";
          data = { deletedFolderId: "custom", destinationFolderId: "default" };
        }
      } else if (pathname === base) data = folders;
      else if (pathname === listPath) {
        data = !searchParams.has("folderId") || searchParams.get("folderId") === folderId ? [{
          id: "saved-content", title: "需要保留的收藏", owner: user, author: user, authorId: user.id, category: "RPG", categoryInfo: { name: "角色扮演" },
          bookmarkId: "saved-bookmark", bookmarkFolderId: folderId, createdAt: "2026-09-01", updatedAt: "2026-09-01",
          contentExcerpt: "收藏内容不会删除", coverType: "TEXT", textCoverTheme: "MINT", coverMedia: null,
          imageCount: 0, likeCount: 0, commentCount: 0, bookmarkCount: 1, tipTotal: "0", viewerLiked: false, viewerBookmarked: true,
        }] : [];
      } else if (pathname.endsWith("/auth/refresh")) data = { accessToken: "mock-folder-management-token", user };
      else if (pathname.endsWith("/users/me")) data = user;
      else if (pathname.endsWith("/wallet")) data = { balance: "0" };
      else if (pathname.endsWith("/notifications/unread")) data = { unreadCount: 0 };
      else if (pathname.endsWith("/direct-conversations/unread")) data = { total: 0 };
      await route.fulfill({ json: { code: 0, message: "ok", data, meta: { cursor: null, hasMore: false } } });
    });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/bookmarks?type=${kind}`);
    const navigation = page.getByRole("complementary", { name: "收藏目录" });
    const more = page.getByRole("button", { name: /更多收藏夹操作/ });
    const contentLink = page.locator(`a[href="/${kind === "threads" ? "threads" : "moments"}/saved-content"]`);
    await expect(page.getByRole("heading", { name: "全部收藏", exact: true })).toBeVisible();
    await expect(more).toHaveCount(0);
    await navigation.getByRole("button", { name: /默认收藏夹/ }).click();
    await expect(more).toHaveCount(0);
    await navigation.getByRole("button", { name: /待整理/ }).click();
    await expect(more).toHaveCount(1);
    await expect(navigation.getByRole("button", { name: /更多/ })).toHaveCount(0);
    await expect(contentLink).toBeVisible();
    await page.getByRole("searchbox").fill("待整理");
    await more.focus();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("menuitem", { name: "重命名" })).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("menuitem", { name: "删除收藏夹" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(more).toBeFocused();
    await more.click();
    await page.getByRole("menuitem", { name: "重命名" }).click();
    const input = page.getByRole("textbox", { name: "收藏夹名称" });
    await expect(input).toBeFocused();
    expect(await input.evaluate((node: HTMLInputElement) => [node.selectionStart, node.selectionEnd])).toEqual([0, 3]);
    await page.keyboard.press("Escape");
    await expect(more).toBeFocused();
    await more.click();
    await page.getByRole("menuitem", { name: "重命名" }).click();
    await input.fill("  重命名后的长收藏夹名称用于检查布局  ");
    await input.press("Enter");
    await expect(page.getByRole("alert")).toHaveText("测试写入失败");
    await expect(input).toHaveValue("  重命名后的长收藏夹名称用于检查布局  ");
    await expect(page).toHaveURL(/folder=custom/);
    fail = false; hold = true;
    await input.press("Enter");
    await expect(page.getByRole("button", { name: "保存中" })).toBeDisabled();
    await expect(input).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(contentLink).toBeAttached();
    await expect.poll(() => !!release).toBe(true);
    release!(); hold = false;
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(more).toBeFocused();
    await expect(page.getByRole("heading", { name: "重命名后的长收藏夹名称用于检查布局", exact: true })).toBeVisible();
    await expect(page.getByRole("searchbox")).toHaveValue("");
    await expect(navigation.getByRole("button", { name: /重命名后的长收藏夹名称/ })).toHaveAttribute("aria-pressed", "true");
    await expect(page).toHaveURL(/folder=custom/);
    expect(writes.at(-1)?.body).toEqual({ name: "重命名后的长收藏夹名称用于检查布局" });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1280);
    await page.screenshot({ path: testInfo.outputPath(`folder-renamed-${kind}.png`), fullPage: true });
    await more.click();
    await page.getByRole("menuitem", { name: "删除收藏夹" }).click();
    await expect(page.getByRole("button", { name: "取消", exact: true })).toBeFocused();
    await expect(page.getByText("收藏夹内的收藏会移到默认收藏夹，收藏内容不会删除。", { exact: true })).toBeVisible();
    expect((await new AxeBuilder({ page }).include('[role="dialog"]').analyze()).violations).toEqual([]);
    fail = true;
    await page.getByRole("button", { name: "删除收藏夹", exact: true }).click();
    await expect(page.getByRole("alert")).toHaveText("测试写入失败");
    await expect(page).toHaveURL(/folder=custom/);
    fail = false; hold = true; release = undefined;
    await page.getByRole("button", { name: "删除收藏夹", exact: true }).click();
    await expect(page.getByRole("button", { name: "删除中" })).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect.poll(() => !!release).toBe(true);
    release!();
    await expect(page).toHaveURL(/folder=default/);
    await expect(page.getByRole("heading", { name: "默认收藏夹", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "默认收藏夹", exact: true })).toBeFocused();
    await expect(contentLink).toBeVisible();
    await expect(more).toHaveCount(0);
    await expect(page.getByText("收藏夹已删除，收藏已移到默认收藏夹", { exact: true })).toHaveCount(1);
    await page.goBack();
    await expect(page).toHaveURL(/folder=default/);
    expect(writes.map((item) => item.method)).toEqual(["PATCH", "PATCH", "DELETE", "DELETE"]);
    expect(writes.every((item) => item.path === `${base}/custom`)).toBe(true);
  });
}

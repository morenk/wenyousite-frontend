import { expect, type Page } from "@playwright/test";
import { test } from "./fixtures/isolation";
import AxeBuilder from "@axe-core/playwright";
import { join } from "node:path";
import { writeFileSync } from "node:fs";
import { requireIsolationRunner } from "../scripts/e2e-isolation-gate.mjs";

async function setupRelations(page: Page, theme: "light" | "dark") {
    const run = await requireIsolationRunner();
    writeFileSync(join(process.cwd(), ".e2e-results", "relations-isolation.json"), JSON.stringify({
      runId: run.manifest.runId, backendURL: run.manifest.backendURL, frontendURL: process.env.E2E_BASE_URL,
      postgres: run.manifest.postgres, redis: run.manifest.redis, uploadPath: run.manifest.uploadPath,
    }, null, 2), { mode: 0o600 });
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    const owner = {
      id: "relation-owner", username: "温油读者", email: "relations@example.test", role: "USER",
      avatar: null, profileCover: null, bio: null, level: 3, receivedTipTotal: "0", receivedTipCount: 0,
      showRecentReplies: true, showPlayerBadges: true, showBookmarks: true,
      accountStatus: "ACTIVE", createdAt: "2026-01-01T00:00:00Z",
    };
    const people = Array.from({ length: 20 }, (_, i) => ({
      id: "relation-" + i, username: i === 0 ? "在温柔宇宙漫游的旅人与一段很长的名字" : ["听风的人", "微光", "海边的猫", "向晚"][i % 4] + i,
      avatar: null, level: i % 7 + 1,
      viewerIsFollowing: i !== 1, viewerIsFollowedBy: true,
    }));
    const writes: string[] = [];
    const blocked = new Set<string>();
    let messages = true;
    let hold = false;
    let release: (() => void) | undefined;
    await page.route("**/api/v1/**", async (route) => {
      const req = route.request();
      const path = new URL(req.url()).pathname;
      let data: unknown = [];
      if (path.endsWith("/meta")) data = { capabilities: { directMessages: messages } };
      else if (path.endsWith("/auth/refresh")) data = { accessToken: "mock-relation-token", user: owner };
      else if (path === "/api/v1/users/me" || path === "/api/v1/users/" + owner.id || path === "/api/v1/users/other") {
        data = { ...owner, id: path.endsWith("/other") ? "other" : owner.id,
          _count: { following: people.filter((person) => person.viewerIsFollowing).length, followers: people.filter((person) => person.viewerIsFollowedBy).length } };
      } else if (/\/(following|followers)$/.test(path)) {
        const kind = path.endsWith("/following") ? "following" : "follower";
        data = people.filter((person) => !blocked.has(person.id) && (kind === "following" ? person.viewerIsFollowing : person.viewerIsFollowedBy))
          .map((person) => ({ [kind]: person, viewerIsFollowing: person.viewerIsFollowing, viewerIsFollowedBy: person.viewerIsFollowedBy }));
      } else if (path.includes("/users/follow/") || path.includes("/users/me/followers/") || path.includes("/users/me/block/")) {
        writes.push(req.method() + " " + path);
        if (hold) await new Promise<void>((resolve) => { release = resolve; });
        const person = people.find((value) => path.endsWith("/" + value.id))!;
        if (path.includes("/me/block/")) blocked.add(person.id);
        else if (path.includes("/me/followers/")) person.viewerIsFollowedBy = false;
        else person.viewerIsFollowing = req.method() === "POST";
        data = { message: "ok" };
      } else if (path.endsWith("/wallet/check-in")) data = { balance: "0", awarded: false };
      else if (path.endsWith("/wallet")) data = { balance: "0" };
      else if (path.endsWith("/notifications/unread")) data = { unreadCount: 0 };
      else if (path.endsWith("/direct-conversations/unread")) data = { total: 0 };
      await route.fulfill({ json: { code: 0, message: "ok", data, meta: { cursor: null, hasMore: false } } });
    });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/users/" + owner.id + "/followers");
    return { people, writes, blocked, setHold: (value: boolean) => { hold = value; },
      canRelease: () => !!release, release: () => release?.(), setMessages: (value: boolean) => { messages = value; } };
}

for (const theme of ["light", "dark"] as const) {
  test("本人关系管理：" + theme + "、页签防重、确认与方向", async ({ page }) => {
    const { people, writes, setHold, canRelease, release } = await setupRelations(page, theme);
    const name = people[0].username;
    const row = page.getByRole("listitem").filter({ has: page.getByRole("link", { name: new RegExp(name) }) });
    const status = row.getByRole("button", { name: "互相关注：" + name });
    await expect(status).toBeVisible();
    for (const button of await row.getByRole("button").all()) {
      const box = await button.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(48);
      expect(box?.width).toBeGreaterThanOrEqual(48);
    }
    await expect(page.getByRole("button", { name: "回关：" + people[1].username })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await page.screenshot({ path: join(process.cwd(), ".e2e-results", "relations-followers-" + theme + ".png") });
    expect((await new AxeBuilder({ page }).include('section[aria-label="粉丝列表"]').analyze()).violations).toEqual([]);
    await status.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("menuitem")).toHaveText(["私聊", "取消关注", "移除粉丝", "拉黑", "举报"]);
    await page.screenshot({ path: join(process.cwd(), ".e2e-results", "relations-menu-" + theme + ".png") });
    await page.keyboard.press("End");
    await expect(page.getByRole("menuitem", { name: "举报" })).toBeFocused();
    await page.keyboard.press("Home");
    await expect(page.getByRole("menuitem", { name: "私聊" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(status).toBeFocused();

    await page.getByRole("tab", { name: /^关注/ }).click();
    await expect(page).toHaveURL(/\/following$/);
    await page.screenshot({ path: join(process.cwd(), ".e2e-results", "relations-following-" + theme + ".png") });
    setHold(true);
    await page.getByRole("button", { name: "更多操作：" + name }).click();
    await page.getByRole("menuitem", { name: "取消关注" }).click();
    await expect.poll(() => canRelease()).toBe(true);
    await page.getByRole("tab", { name: /^粉丝/ }).click();
    await expect(page.getByRole("button", { name: "互相关注：" + name })).toBeDisabled();
    await expect(page.getByRole("button", { name: "更多操作：" + name })).toBeDisabled();
    setHold(false); release();
    await expect(row.getByRole("button", { name: "回关：" + name })).toBeEnabled();
    expect(writes).toHaveLength(1);
    await row.getByRole("button", { name: "回关：" + name }).click();
    await expect(status).toBeVisible();
    // 在保留粉丝行的取消关注中，状态替换后键盘焦点仍留在该行。
    await status.click();
    await page.getByRole("menuitem", { name: "取消关注" }).click();
    await expect(row.getByRole("button", { name: "回关：" + name })).toBeFocused();
    await row.getByRole("button", { name: "回关：" + name }).click();
    await expect(status).toBeVisible();

    const trigger = row.getByRole("button", { name: "更多操作：" + name });
    await trigger.click();
    await page.getByRole("menuitem", { name: "移除粉丝" }).click();
    const dialog = page.getByRole("dialog");
    await expect(page.getByRole("menu")).toHaveCount(0);
    await expect(dialog.getByRole("button", { name: "取消" })).toBeFocused();
    await page.screenshot({ path: join(process.cwd(), ".e2e-results", "relations-confirm-" + theme + ".png") });
    expect((await new AxeBuilder({ page }).include('[role="dialog"]').analyze()).violations).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
    await trigger.click();
    await page.getByRole("menuitem", { name: "移除粉丝" }).click();
    await dialog.getByRole("button", { name: "移除粉丝", exact: true }).click();
    await expect(row).toHaveCount(0);
    expect(people[0].viewerIsFollowing).toBe(true);
    await expect(page.getByRole("tab", { name: "粉丝 19" })).toBeVisible();

    await page.setViewportSize({ width: 1000, height: 900 });
    await page.screenshot({ path: join(process.cwd(), ".e2e-results", "relations-narrow-" + theme + ".png") });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1000);
    await page.evaluate(() => window.scrollTo(0, 500));
    await page.getByRole("tab", { name: /^关注/ }).click();
    await expect(page).toHaveURL(/\/following$/);
    await expect(page.getByRole("tab", { name: /^关注/ })).toHaveAttribute("aria-selected", "true");
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    await page.evaluate(() => window.scrollTo(0, 250));
    await page.getByRole("tab", { name: /^粉丝/ }).click();
    await expect(page).toHaveURL(/\/followers$/);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(500);
    await page.goto("/users/other/followers");
    await expect(page.getByRole("tab")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /已关注：|互相关注：|更多操作：|回关：/ })).toHaveCount(0);
  });
  test("关系菜单：" + theme + "、跨方向移除、拉黑与能力", async ({ page }) => {
    const { people, blocked, setMessages } = await setupRelations(page, theme);
    await page.setViewportSize({ width: 1000, height: 900 });
    // 慢路由期间两个列表都有同名按钮；旧页上的菜单会随路由提交卸载。
    // 用可控 RSC 延迟重现旧 locator 的竞态，目标动作只在目标列表内定位。
    let releaseNavigation = () => {};
    let navigationHeld = false;
    const navigationReady = new Promise<void>((resolve) => { releaseNavigation = resolve; });
    await page.route("**/users/relation-owner/following?*", async (route) => {
      if (route.request().headers().rsc === "1") { navigationHeld = true; await navigationReady; }
      await route.continue();
    });
    try {
      await page.getByRole("tab", { name: /^关注/ }).click();
      await expect.poll(() => navigationHeld).toBe(true);
      const oldList = page.getByRole("region", { name: "粉丝列表", exact: true });
      await expect(oldList).toBeVisible();
      const oldTrigger = page.getByRole("button", { name: "更多操作：" + people[2].username });
      const oldElement = await oldTrigger.elementHandle();
      expect(oldElement).not.toBeNull();
      expect(await oldElement!.evaluate((element) => element.closest("section")?.getAttribute("aria-label"))).toBe("粉丝列表");
      await oldTrigger.click();
      await expect(page.getByRole("menuitem", { name: "移除粉丝" })).toBeVisible();
      releaseNavigation();
      await expect(page).toHaveURL(/\/following$/);
      const followingList = page.getByRole("region", { name: "关注列表", exact: true });
      await expect(followingList).toBeVisible();
      await expect.poll(() => oldElement!.evaluate((element) => element.isConnected)).toBe(false);
      await expect(page.getByRole("menu")).toHaveCount(0);
      writeFileSync(join(process.cwd(), ".e2e-results", "relations-navigation-" + theme + ".json"), JSON.stringify({
        oldList: "粉丝列表", oldMenuVisibleBeforeCommit: true, oldRowConnectedAfterCommit: false, destination: "关注列表",
      }), { mode: 0o600 });
      // 关注页互关用户同样提供移除粉丝，完成后保留我的关注。
      await followingList.getByRole("button", { name: "更多操作：" + people[2].username }).click();
    } finally { releaseNavigation(); }
    await page.getByRole("menuitem", { name: "移除粉丝" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "移除粉丝", exact: true }).click();
    await expect(page.getByRole("button", { name: "已关注：" + people[2].username })).toBeVisible();
    expect(people[2].viewerIsFollowing).toBe(true);
    // 拉黑取消不写入；确认后按服务端过滤重读，关系数据不被客户端修改。
    await page.getByRole("button", { name: "更多操作：" + people[3].username }).click();
    await page.getByRole("menuitem", { name: "拉黑" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "取消", exact: true }).click();
    expect(blocked.size).toBe(0);
    await page.getByRole("button", { name: "更多操作：" + people[3].username }).click();
    await page.getByRole("menuitem", { name: "拉黑" }).click();
    await page.screenshot({ path: join(process.cwd(), ".e2e-results", "relations-block-" + theme + ".png") });
    await page.getByRole("dialog").getByRole("button", { name: "拉黑", exact: true }).click();
    await expect(page.getByRole("button", { name: "更多操作：" + people[3].username })).toHaveCount(0);
    expect(people[3].viewerIsFollowing && people[3].viewerIsFollowedBy).toBe(true);
    setMessages(false);
    await page.reload();
    await page.getByRole("button", { name: "更多操作：" + people[4].username }).click();
    await expect(page.getByRole("menuitem", { name: "私聊" })).toHaveCount(0);
    await page.screenshot({ path: join(process.cwd(), ".e2e-results", "relations-menu-narrow-" + theme + ".png") });
    await page.getByRole("menuitem", { name: "举报" }).click();
    await expect(page).toHaveURL(/\/report\?targetType=USER&targetId=relation-4$/);
  });
}

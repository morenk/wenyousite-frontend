import { expect } from "@playwright/test";
import { test } from "./fixtures/isolation";
import AxeBuilder from "@axe-core/playwright";
import { join } from "node:path";
import { writeFileSync } from "node:fs";
import { requireIsolationRunner } from "../scripts/e2e-isolation-gate.mjs";

for (const theme of ["light", "dark"] as const) {
  test("本人关系管理：" + theme + "、页签防重、确认与方向", async ({ page }) => {
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
    let hold = false;
    let release: (() => void) | undefined;
    await page.route("**/api/v1/**", async (route) => {
      const req = route.request();
      const path = new URL(req.url()).pathname;
      let data: unknown = [];
      if (path.endsWith("/auth/refresh")) data = { accessToken: "mock-relation-token", user: owner };
      else if (path === "/api/v1/users/me" || path === "/api/v1/users/" + owner.id || path === "/api/v1/users/other") {
        data = { ...owner, id: path.endsWith("/other") ? "other" : owner.id,
          _count: { following: people.filter((person) => person.viewerIsFollowing).length, followers: people.filter((person) => person.viewerIsFollowedBy).length } };
      } else if (/\/(following|followers)$/.test(path)) {
        const kind = path.endsWith("/following") ? "following" : "follower";
        data = people.filter((person) => kind === "following" ? person.viewerIsFollowing : person.viewerIsFollowedBy)
          .map((person) => ({ [kind]: person, viewerIsFollowing: person.viewerIsFollowing, viewerIsFollowedBy: person.viewerIsFollowedBy }));
      } else if (path.includes("/users/follow/") || path.includes("/users/me/followers/")) {
        writes.push(req.method() + " " + path);
        if (hold) await new Promise<void>((resolve) => { release = resolve; });
        const person = people.find((value) => path.endsWith("/" + value.id))!;
        if (path.includes("/me/followers/")) person.viewerIsFollowedBy = false;
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
    const name = people[0].username;
    const row = page.getByRole("listitem").filter({ has: page.getByRole("link", { name: new RegExp(name) }) });
    await expect(row.getByText("互相关注")).toBeVisible();
    await expect(page.getByRole("button", { name: "回关：" + people[1].username })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await page.screenshot({ path: join(process.cwd(), ".e2e-results", "relations-followers-" + theme + ".png") });
    expect((await new AxeBuilder({ page }).include('section[aria-label="粉丝列表"]').analyze()).violations).toEqual([]);

    await page.getByRole("tab", { name: /^关注/ }).click();
    await expect(page).toHaveURL(/\/following$/);
    await page.screenshot({ path: join(process.cwd(), ".e2e-results", "relations-following-" + theme + ".png") });
    hold = true;
    await page.getByRole("button", { name: "取消关注：" + name }).click();
    await expect.poll(() => !!release).toBe(true);
    await page.getByRole("tab", { name: /^粉丝/ }).click();
    await expect(page.getByRole("button", { name: "取消关注：" + name })).toBeDisabled();
    await expect(page.getByRole("button", { name: "移除粉丝：" + name })).toBeDisabled();
    hold = false; release!();
    await expect(row.getByRole("button", { name: "回关：" + name })).toBeEnabled();
    expect(writes).toHaveLength(1);
    await row.getByRole("button", { name: "回关：" + name }).click();
    await expect(row.getByText("互相关注")).toBeVisible();

    const trigger = row.getByRole("button", { name: "移除粉丝：" + name });
    await trigger.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("button", { name: "取消" })).toBeFocused();
    await page.screenshot({ path: join(process.cwd(), ".e2e-results", "relations-confirm-" + theme + ".png") });
    expect((await new AxeBuilder({ page }).include('[role="dialog"]').analyze()).violations).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
    await trigger.click();
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
    await expect(page.getByRole("button", { name: /取消关注：|移除粉丝：|回关：/ })).toHaveCount(0);
  });
}

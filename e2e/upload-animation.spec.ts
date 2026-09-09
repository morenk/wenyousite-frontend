import { readFileSync } from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";
import { openFreshThreadDraft } from "./fixtures/auth";
import { insertTestEditorImage } from "./fixtures/media";

const fixture = (name: string) => readFileSync(path.join(process.cwd(), "src/lib/__tests__/fixtures/images", name));

test.beforeEach(async ({ page }) => {
  // 所有 API 都在浏览器内拦截，本测试不登录真实账号或创建后端数据。
  await page.route("**/api/v1/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    const user = { id: "upload-test-owner", username: "上传测试", email: "upload-test@example.invalid", avatar: null, role: "USER" };
    const subthread = {
      id: "upload-test-main", threadId: "upload-test-thread", title: "主帖", sortOrder: 0,
      postingPolicy: "PARTICIPANTS", version: 1, tags: [], _count: { posts: 0 },
      bodyPost: { id: "upload-test-body", content: "", version: 1, diceRolls: [] },
    };
    let data: unknown = null;
    if (pathname.endsWith("/auth/refresh")) data = { accessToken: "upload-test-memory-token", user };
    else if (pathname.endsWith("/meta")) data = { markdownContractVersion: 4 };
    else if (pathname.endsWith("/thread-categories")) data = [{ id: "upload-test-category", slug: "DEDUCTION", name: "演绎", isActive: true, sortOrder: 0 }];
    else if (pathname.endsWith("/threads/draft")) data = [];
    else if ((pathname.endsWith("/threads") && route.request().method() === "POST") || pathname.includes("/threads/upload-test-thread")) data = {
      id: "upload-test-thread", title: "图片容器验收草稿", ownerId: user.id, owner: user, category: "DEDUCTION",
      categoryInfo: { slug: "DEDUCTION", name: "演绎", isActive: true },
      status: "RECRUITING", visibility: "PUBLIC", published: false, version: 1,
      defaultSubthreadId: subthread.id, defaultSubthread: subthread, subthreads: [subthread],
      topicTags: [], _count: { members: 1, players: 1, posts: 0 },
      capabilities: { isOwner: true, canManageThread: true, canPost: true },
    };
    else if (pathname.endsWith("/drafts/state")) data = { drafts: [], usedSlots: 0, maxSlots: 5, slots: [] };
    else if (pathname.endsWith("/stickers")) data = { version: 1, limit: 100, items: [], recent: [], pendingImports: [] };
    else if (pathname.endsWith("/notifications/unread")) data = { unreadCount: 0 };
    else if (pathname.endsWith("/direct-conversations/unread")) data = { unreadMessageCount: 0, pendingRequestCount: 0, total: 0 };
    await route.fulfill({ json: { code: 0, message: "ok", data } });
  });
  await openFreshThreadDraft(page);
});

for (const kind of ["png", "webp"]) {
  test(`正文拒绝真实动态 ${kind}，不请求签名或静态化`, async ({ page }) => {
    let reservations = 0;
    page.on("request", (request) => {
      if (request.url().endsWith("/api/v1/media/upload-url")) reservations++;
    });
    await insertTestEditorImage(page, { name: `animated.${kind}`, mimeType: `image/${kind}`, buffer: fixture(`animated.${kind}`) });
    await expect(page.getByText("暂不支持此格式的动图，请使用 GIF 或静态图片").first()).toBeVisible();
    expect(reservations).toBe(0);
    await expect(page.locator(".ProseMirror img")).toHaveCount(0);
  });
}

test("正文 GIF 对象存储请求保留原字节", async ({ page }) => {
  const original = fixture("animated.gif");
  const uploaded = page.waitForRequest((request) => request.url().endsWith("/e2e-object-upload") && request.method() === "PUT");
  await insertTestEditorImage(page, { name: "animated.gif", mimeType: "image/gif", buffer: original });
  const request = await uploaded;
  expect(request.headers()["content-type"]).toBe("image/gif");
  expect(request.postDataBuffer()).toEqual(original);
  await expect(page.locator(".ProseMirror img")).toBeVisible();
});

test("JPEG 尾随数据由浏览器解码后继续规范化上传", async ({ page }) => {
  const original = Buffer.concat([fixture("static.jpeg"), Buffer.from("QQ trailing metadata")]);
  const uploaded = page.waitForRequest((request) => request.url().endsWith("/e2e-object-upload") && request.method() === "PUT");
  await insertTestEditorImage(page, { name: "qq.jpg", mimeType: "image/jpeg", buffer: original });
  const request = await uploaded;
  expect(request.headers()["content-type"]).toBe("image/webp");
  expect(request.postDataBuffer()).not.toEqual(original);
  await expect(page.locator(".ProseMirror img")).toBeVisible();
});

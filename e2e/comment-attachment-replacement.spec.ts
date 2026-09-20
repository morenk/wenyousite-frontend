import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const image = {
  name: "same.png", mimeType: "image/png",
  buffer: readFileSync("src/lib/__tests__/fixtures/images/static.png"),
};

test("评论单图替换、选择器取消、同图重选与发送失败重试", async ({ page }) => {
  const comments: Array<Record<string, unknown>> = [];
  let uploads = 0;
  const user = { id: "attachment-user", email: "attachment@example.test", username: "附件测试", avatar: null, role: "USER" };
  const media = { id: "attachment-media", status: "COMPLETED", url: "/fixture.png", thumbnailUrl: null, feedUrl: null, mediumUrl: null, width: 1, height: 1, contentType: "image/webp", animated: false };
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const response = (data: unknown) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ code: 0, message: "ok", data, meta: { cursor: null, hasMore: false } }) });
    if (path.endsWith("/auth/refresh")) return response({ user, accessToken: "isolated-attachment-token" });
    if (path.endsWith("/wallet/check-in")) return response({ claimedNow: false, rewardAmount: "0", balance: "0" });
    if (path.endsWith("/notifications/unread")) return response({ unreadCount: 0 });
    if (path.endsWith("/direct-conversations/unread")) return response({ unreadMessageCount: 0, pendingRequestCount: 0, total: 0 });
    if (path === "/api/v1/moments/attachment-moment") return response({
      id: "attachment-moment", authorId: user.id, author: user, title: "评论附件验证", content: "验证单图替换", contentExcerpt: "验证单图替换",
      coverType: "TEXT", textCoverTheme: "ROSE", coverMedia: null, imageCount: 0, images: [], version: 1,
      canInteract: true, canEdit: false, canDelete: false, likeCount: 0, commentCount: 0, bookmarkCount: 0, tipTotal: "0",
      viewerLiked: false, viewerBookmarked: false, createdAt: "2026-09-20T00:00:00Z", updatedAt: "2026-09-20T00:00:00Z",
    });
    if (path === "/api/v1/moments/attachment-moment/comments") {
      if (request.method() === "GET") return response([]);
      comments.push(request.postDataJSON());
      if (comments.length === 1) return route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ code: 50000, message: "评论服务暂时不可用" }) });
      return response({ id: "attachment-comment" });
    }
    if (path.endsWith("/media/upload-url")) {
      uploads++;
      return response({ mediaId: media.id, uploadUrl: new URL("/test-upload/attachment", request.url()).toString() });
    }
    if (path.endsWith("/media/upload-done")) return response({ media });
    if (path.endsWith("/media/attachment-media")) return response(media);
    return response(null);
  });
  await page.route("**/test-upload/attachment", (route) => route.fulfill({ status: 200, body: "" }));
  await page.goto("/moments/attachment-moment");
  await page.getByRole("button", { name: "发表评论…" }).click();
  const editor = page.getByRole("textbox", { name: "评论内容" });
  await editor.fill("失败仍保留正文");
  const input = page.getByLabel("上传评论图片");
  await input.setInputFiles(image);
  await expect(page.getByRole("button", { name: "更换图片" })).toBeEnabled();
  const preview = page.getByAltText("待发送评论图片");
  const firstPreview = await preview.getAttribute("src");
  expect(uploads).toBe(0);

  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "更换图片" }).click();
  await chooserPromise;
  await expect(page.getByRole("button", { name: "更换图片" })).toBeDisabled();
  // Playwright不能操作操作系统选择框的取消按钮；验证浏览器原生cancel事件的实际监听路径。
  await input.dispatchEvent("cancel");
  await expect(page.getByRole("button", { name: "更换图片" })).toBeEnabled();
  await expect(preview).toHaveAttribute("src", firstPreview!);
  await input.setInputFiles(image);
  await expect(preview).not.toHaveAttribute("src", firstPreview!);
  expect(await input.inputValue()).toBe("");
  await input.setInputFiles({ name: "bad.txt", mimeType: "text/plain", buffer: Buffer.from("bad") });
  await expect(preview).toBeVisible();
  expect(uploads).toBe(0);

  await page.getByRole("button", { name: "发送", exact: true }).click();
  await expect(page.getByText("评论服务暂时不可用")).toBeVisible();
  await expect(editor).toHaveText("失败仍保留正文");
  await expect(preview).toBeVisible();
  await page.getByRole("button", { name: "发送", exact: true }).click();
  await expect(page.getByRole("button", { name: "发表评论…" })).toBeVisible();
  expect(uploads).toBe(1);
  expect(comments).toHaveLength(2);
  expect(comments[0]).toMatchObject({ mediaId: media.id, content: "失败仍保留正文" });
  expect(comments[1]).toEqual(comments[0]);
});

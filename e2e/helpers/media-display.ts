import { readFileSync } from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";

/** 真实应用路由，所有业务和媒体响应均为本地受控素材；不访问真实账号。 */
export async function mediaDisplayFixture(page: Page, baseURL: string) {
  const requests: string[] = [], writes: unknown[] = [];
  const image = (id: string) => {
    const sourceUrl = `${baseURL}/media/display-fixture/${id}${id === "sticker" ? "-source.webp" : ".gif"}`;
    const display = { url: `${baseURL}/media/display-fixture/${id}-full.webp`, contentType: "image/webp", width: 24, height: 16, bytes: 316, animated: true, frameCount: 3, durationMs: 1500, loopCount: 2 };
    return { id, url: sourceUrl, thumbnailUrl: `${baseURL}/media/display-fixture/still.webp`, mediumUrl: null, feedUrl: null, contentType: "image/gif", width: 24, height: 16, animated: true, display };
  };
  const images = [image("body"), image("floor"), image("reply"), image("dm"), image("moment"), image("sticker")];
  const user = { id: "display-owner", username: "展示验收", email: "display@example.invalid", avatar: images[5].url, avatarDisplay: images[5].display, role: "USER", level: 1 };
  const mediaDisplays = images.map((media) => ({ sourceUrl: media.url, display: media.display }));
  let content = `![正文动画](${images[0].url})`, published = true;
  const now = "2026-09-12T00:00:00Z";
  const post = (index: number) => ({ id: `display-post-${index}`, threadId: "display-thread", subthreadId: "display-main", authorId: user.id, author: user, kind: "FLOOR", floorNumber: index, parentPostId: null, replyToPostId: null, content: `![${index === 1 ? "楼层" : "回复"}动画](${images[index].url})`, mediaDisplays, diceRolls: [], version: 1, createdAt: now, updatedAt: now, deletedAt: null, pinnedAt: null, _count: { replies: 0 }, replies: [] });
  const thread = () => {
    const subthread = { id: "display-main", threadId: "display-thread", title: "主帖", sortOrder: 0, postingPolicy: "PARTICIPANTS", version: 1, tags: [], _count: { posts: 1 }, bodyPost: { id: "display-body", content, mediaDisplays, version: 1, diceRolls: [] } };
    return { id: "display-thread", title: "完整展示验收", ownerId: user.id, owner: user, category: "DEDUCTION", categoryInfo: { slug: "DEDUCTION", name: "演绎", isActive: true }, status: "RECRUITING", visibility: "PUBLIC", published, pinned: false, version: 1, viewCount: 0, likeCount: 0, tipTotal: "0", createdAt: now, updatedAt: now, defaultSubthreadId: subthread.id, subthreads: [subthread], defaultSubthread: subthread, topicTags: [], _count: { members: 1, players: 1, posts: 1 }, currentMembership: { id: "member", userId: user.id, threadId: "display-thread", role: "OWNER", playerMarked: false }, capabilities: { isOwner: true, canManageThread: true, canManageMembers: true, canPost: true } };
  };
  const conversation = { id: "display-dm", status: "ACCEPTED", requestDirection: "NONE", otherUser: { ...user, id: "other", isDeactivated: false }, lastMessage: null, unreadCount: 0, archivedAt: null, lastMessageAt: now, createdAt: now, canSend: true, canAccept: false, canDecline: false, isBlocked: false };
  const moment = { id: "display-moment", authorId: user.id, author: user, title: "完整动态图", content: "正文", contentExcerpt: "正文", coverType: "IMAGE", textCoverTheme: "ROSE", coverMedia: images[4], images: [images[4]], imageCount: 1, version: 1, canEdit: false, canDelete: false, canInteract: true, likeCount: 0, commentCount: 0, bookmarkCount: 0, tipTotal: "0", viewerLiked: false, viewerBookmarked: false, createdAt: now, updatedAt: now };
  await page.route("**/media/display-fixture/**", (route) => {
    const url = route.request().url(); requests.push(url);
    const name = url.endsWith("still.webp") ? "cover-playback/poster.webp" : url.endsWith(".gif") ? "media-display/duplicate-frames.gif" : "media-display/duplicate-frames.webp";
    return route.fulfill({ contentType: name.endsWith(".gif") ? "image/gif" : "image/webp", body: readFileSync(path.join(process.cwd(), "e2e/fixtures", name)) });
  });
  await page.route("**/api/v1/**", async (route) => {
    const req = route.request(), pathname = new URL(req.url()).pathname;
    let data: unknown = null;
    if (pathname.endsWith("/auth/refresh")) data = { accessToken: "local-display-test-token", user };
    else if (pathname.endsWith("/meta")) data = { markdownContractVersion: 5 };
    else if (pathname.endsWith("/thread-categories")) data = [{ id: "category", slug: "DEDUCTION", name: "演绎", isActive: true, sortOrder: 0 }];
    else if (pathname.endsWith("/notifications/unread")) data = { unreadCount: 0 };
    else if (pathname.endsWith("/direct-conversations/unread")) data = { unreadMessageCount: 0, pendingRequestCount: 0, total: 0 };
    else if (pathname.endsWith("/threads/draft")) data = published ? [] : [thread()];
    else if (pathname.endsWith("/threads") && req.method() === "POST") { published = false; data = thread(); }
    else if (pathname.endsWith("/threads/display-thread/aggregate")) { const body = req.postDataJSON(); writes.push(body); if (typeof body.content === "string") content = body.content; data = thread(); }
    else if (pathname.endsWith("/threads/display-thread")) data = thread();
    else if (pathname.endsWith("/subthreads/display-main/posts/authors")) data = [];
    else if (pathname.endsWith("/subthreads/display-main/posts")) data = [{ ...post(1), _count: { replies: 1 }, replies: [{ ...post(2), kind: "REPLY", floorNumber: null, parentPostId: "display-post-1" }] }];
    else if (pathname.endsWith("/posts/display-post-1/replies")) data = [post(2)];
    else if (pathname.endsWith("/drafts/state")) data = { drafts: [{ id: "display-draft", content, mediaDisplays, slot: 1, version: 1, createdAt: now, updatedAt: now }], usedSlots: 1, maxSlots: 5, slots: [1] };
    else if (pathname.endsWith("/stickers")) data = { version: 1, limit: 100, items: [{ id: "favorite", asset: { ...images[5], frameCount: 3, durationMs: 1500 }, createdAt: now }], recent: [], pendingImports: [] };
    else if (pathname.endsWith("/direct-conversations/display-dm/messages")) data = [{ id: "display-message", conversationId: "display-dm", senderId: "other", recipientId: user.id, content: "", media: images[3], sticker: null, recalledAt: null, createdAt: now }];
    else if (pathname.endsWith("/direct-conversations/display-dm")) data = conversation;
    else if (pathname.endsWith("/direct-conversations")) data = [conversation];
    else if (pathname.endsWith("/moments/display-moment/comments")) data = [{ id: "display-comment", momentId: "display-moment", author: user, content: "评论展示", media: images[2], sticker: null, parentCommentId: null, replyToComment: null, deleted: false, canDelete: false, createdAt: now, replyCount: 1, replies: [{ id: "display-subcomment", momentId: "display-moment", author: user, content: "表情展示", media: null, sticker: images[5], parentCommentId: "display-comment", replyToComment: null, deleted: false, canDelete: false, createdAt: now }] }];
    else if (pathname.endsWith("/moments/display-moment")) data = moment;
    else if (pathname.endsWith("/moments")) data = [moment];
    await route.fulfill({ json: { code: 0, message: "ok", data, meta: { cursor: null, hasMore: false } } });
  });
  return { images, requests, writes, getContent: () => content, setContent: (value: string) => { content = value; }, setPublished: (value: boolean) => { published = value; } };
}

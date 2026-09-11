import { readFileSync } from "node:fs";
import { createServer, request } from "node:http";
import path from "node:path";
import type { AddressInfo } from "node:net";

/** 全部业务 API 和图片由本地 fixture 提供，不用 route 拦截，以保留真实 HTTP 缓存。 */
export async function coverHttpFixture(candidate: string, options: { count?: number; gif?: boolean; clock?: boolean; sameUrl?: boolean; sharedPoster?: boolean; delayMs?: number } = {}) {
  const counts = new Map<string, number>(), bytes = new Map<string, number>();
  const image = (id: number, kind: string) => `/__cover-all__/${options.sameUrl ? 0 : id}/${kind}`;
  const items = Array.from({ length: options.count ?? 12 }, (_, id) => ({
    id: `cover-test-${id}`, title: `可见播放验收帖子 ${id}`, category: "RPG",
    categoryInfo: { slug: "RPG", name: "角色扮演", isActive: true }, status: "RECRUITING", visibility: "PUBLIC", published: true, pinned: false,
    createdAt: "2026-09-09T00:00:00Z", updatedAt: "2026-09-09T00:00:00Z", deletedAt: null, tipTotal: "0",
    owner: { id: "cover-owner", username: "封面验收", avatar: null, level: 1 }, defaultSubthread: null, topicTags: [],
    _count: { members: 1, players: 1, posts: 1 }, preview: "只使用本地构造媒体", bookmarkId: `bookmark-${id}`, bookmarkFolderId: "folder-test",
    coverImages: [image(id, "animation.gif")], coverMedia: { url: image(id, "animation.gif"), animated: true as boolean | null,
      posterUrl: image(options.sharedPoster ? 0 : id, "poster.webp") as string | null, previewVariants: options.gif ? null : [
        { url: image(id, "preview.webp"), width: 480, height: 270, bytes: 85890 },
      ] },
  }));
  const server = createServer((req, res) => {
    const pathname = new URL(req.url!, "http://127.0.0.1").pathname;
    if (pathname.startsWith("/__cover-all__/")) {
      const name = pathname.endsWith("poster.webp") ? "poster.webp" : `${options.clock ? "clock" : "motion"}.${pathname.endsWith(".gif") ? "gif" : "webp"}`;
      const body = readFileSync(path.join(process.cwd(), "e2e/fixtures/cover-playback", name));
      counts.set(pathname, (counts.get(pathname) ?? 0) + 1); bytes.set(pathname, (bytes.get(pathname) ?? 0) + body.length);
      res.writeHead(200, { "Content-Type": name.endsWith(".gif") ? "image/gif" : "image/webp", "Content-Length": body.length, "Cache-Control": "public,max-age=3600,immutable" });
      if (options.delayMs && !pathname.endsWith("poster.webp")) setTimeout(() => res.end(body), options.delayMs); else res.end(body); return;
    }
    if (pathname.startsWith("/api/v1/")) {
      let data: unknown = [];
      if (pathname.endsWith("/auth/refresh")) data = { accessToken: "local-cover-fixture-token", user: { id: "cover-owner", username: "封面验收", email: "cover@example.invalid", avatar: null, role: "USER" } };
      else if (pathname.endsWith("/thread-categories")) data = [{ id: "category-test", slug: "RPG", name: "角色扮演", isActive: true, sortOrder: 0 }];
      else if (pathname.endsWith("/threads") || pathname.endsWith("/created-threads") || pathname.endsWith("/played-threads") || pathname.endsWith("/bookmarks")) data = items;
      else if (pathname.endsWith("/bookmark-folders")) data = [{ id: "folder-test", name: "默认收藏", itemCount: items.length, isDefault: true }];
      else if (pathname.endsWith("/notifications/unread")) data = { unreadCount: 0 };
      else if (pathname.endsWith("/direct-conversations/unread")) data = { unreadMessageCount: 0, pendingRequestCount: 0, total: 0 };
      else if (pathname.endsWith("/meta")) data = { markdownContractVersion: 5 };
      else if (pathname === "/api/v1/users/cover-owner") data = { id: "cover-owner", username: "封面验收", avatar: null, profileCover: null, bio: "", role: "USER", level: 1, receivedTipTotal: "0", receivedTipCount: 0, showRecentReplies: true, showPlayerBadges: true, showBookmarks: true, accountStatus: "ACTIVE", createdAt: "2026-09-09T00:00:00Z", _count: { following: 0, followers: 0, threads: items.length, posts: 0 } };
      else if (/\/threads\/cover-test-/.test(pathname)) { res.writeHead(404, { "Content-Type": "application/json" }); res.end(JSON.stringify({ code: 404, message: "本地详情占位", data: null })); return; }
      res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" }); res.end(JSON.stringify({ code: 0, message: "ok", data, meta: { cursor: null, hasMore: false } })); return;
    }
    const upstream = request(new URL(req.url!, candidate), { method: req.method, headers: { ...req.headers, host: new URL(candidate).host } }, (incoming) => { res.writeHead(incoming.statusCode ?? 502, incoming.headers); incoming.pipe(res); });
    upstream.on("error", () => { res.writeHead(502); res.end("候选站代理失败"); }); req.pipe(upstream);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return { origin: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, counts, bytes, items,
    animationRequests: () => [...counts.entries()].filter(([url]) => !url.endsWith("poster.webp")),
    close: () => new Promise<void>((resolve, reject) => { server.close((error) => error ? reject(error) : resolve()); server.closeAllConnections(); }),
  };
}

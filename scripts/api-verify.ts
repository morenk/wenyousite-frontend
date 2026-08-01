/** API 事实快照脚本
 *  用真实 HTTP 请求抓取每个模块所有端点的响应 JSON，
 *  保存到 docs/snapshots/<module>.snapshot.json，
 *  作为前端类型和 docs_direct 的唯一依据。
 *
 *  用法: npx tsx scripts/api-verify.ts [--module=all|threads|auth|posts|tags|drafts]
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import * as fs from "fs";
import * as path from "path";

const BASE = process.env.API_BASE || "http://127.0.0.1:3000";
const SNAPSHOT_DIR = path.resolve("docs/snapshots");
const CREDENTIALS = {
  email: process.env.TEST_EMAIL || "test_thread2@example.com",
  password: process.env.TEST_PASS || "Test123456!",
};

interface SnapEntry {
  label: string;
  request: unknown;
  response: unknown;
  httpStatus: number;
}

interface ModuleSnapshot {
  module: string;
  generatedAt: string;
  description: string;
  endpoints: Record<string, SnapEntry>;
}

let TOKEN = "";
let USER_ID = "";

/** ── helpers ── */

async function api(
  method: string,
  path: string,
  body?: unknown,
): Promise<{ body: unknown; status: number }> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (TOKEN) headers["Authorization"] = `Bearer ${TOKEN}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { body: json, status: res.status };
}

function snap(module: string, description: string): ModuleSnapshot {
  return {
    module,
    generatedAt: new Date().toISOString(),
    description,
    endpoints: {},
  };
}

function record(s: ModuleSnapshot, label: string, req: unknown, resBody: unknown, status: number) {
  s.endpoints[label] = { label, request: req, response: resBody, httpStatus: status };
}

function save(s: ModuleSnapshot) {
  const file = path.join(SNAPSHOT_DIR, `${s.module}.snapshot.json`);
  fs.writeFileSync(file, JSON.stringify(s, null, 2), "utf-8");
  console.log(`  ✓ ${s.module}.snapshot.json (${Object.keys(s.endpoints).length} endpoints)`);
}

async function login(): Promise<void> {
  const { body } = await api("POST", "/api/v1/auth/login", { email: CREDENTIALS.email, password: CREDENTIALS.password });
  const data = (body as any)?.data;
  TOKEN = data?.accessToken ?? "";
  USER_ID = data?.user?.id ?? "";
  if (!TOKEN) throw new Error("登录失败，无法获取 accessToken");
  console.log(`  logged in as ${data?.user?.username} (${USER_ID})`);
}

/** ── module runners ── */

async function captureAuth(): Promise<void> {
  const s = snap("auth", "认证模块全部端点快照");
  // 使用一个完整注册流程需要新邮箱，这里仅记录已登录态下的端点
  // 先 login 获取最新 token
  const { body: loginBody, status: loginStatus } = await api("POST", "/api/v1/auth/login", {
    email: CREDENTIALS.email,
    password: CREDENTIALS.password,
  });
  record(s, "POST /auth/login", { email: CREDENTIALS.email }, loginBody, loginStatus);

  // sessions
  const { body: sessBody, status: sessStatus } = await api("GET", "/api/v1/auth/sessions");
  record(s, "GET /auth/sessions", null, sessBody, sessStatus);

  save(s);
}

async function captureTags(): Promise<void> {
  const s = snap("tags", "标签搜索端点快照");
  const { body, status } = await api("GET", "/api/v1/tags?q=test");
  record(s, "GET /tags?q=test", { q: "test" }, body, status);
  save(s);
}

async function captureDrafts(): Promise<void> {
  const s = snap("drafts", "全局草稿池端点快照（5槽位）");

  // slots
  const { body: slotBody, status: slotStatus } = await api("GET", "/api/v1/drafts/slots");
  record(s, "GET /drafts/slots", null, slotBody, slotStatus);

  // thread drafts (沙盒草稿，不是全局草稿池)
  const { body: draftList, status: draftStatus } = await api("GET", "/api/v1/threads/draft");
  record(s, "GET /threads/draft", null, draftList, draftStatus);

  save(s);
}

async function captureThreads(): Promise<void> {
  const s = snap("threads", "主题帖全部端点快照");

  // ── 列表 ──
  const { body: listRec, status: sr } = await api("GET", "/api/v1/threads?sort=recommended&limit=3");
  record(s, "GET /threads?sort=recommended&limit=3", { sort: "recommended", limit: 3 }, listRec, sr);

  const { body: listNew, status: sn } = await api("GET", "/api/v1/threads?sort=newest&limit=3");
  record(s, "GET /threads?sort=newest&limit=3", { sort: "newest", limit: 3 }, listNew, sn);

  const { body: listCat, status: sc } = await api("GET", "/api/v1/threads?category=RPG&limit=3");
  record(s, "GET /threads?category=RPG&limit=3", { category: "RPG", limit: 3 }, listCat, sc);

  // ── 创建（无正文） ──
  const { body: createEmpty, status: ce } = await api("POST", "/api/v1/threads", {});
  record(s, "POST /threads {}", {}, createEmpty, ce);
  const emptyThreadId = (createEmpty as any)?.data?.id;
  const emptySubId = (createEmpty as any)?.data?.defaultSubthreadId;
  const emptyVersion = (createEmpty as any)?.data?.version;

  // ── 创建（含正文） ──
  const { body: createFull, status: cf } = await api("POST", "/api/v1/threads", {
    title: "快照测试帖",
    category: "RPG",
    visibility: "PUBLIC",
    content: "这是一段正文内容（快照验证）",
    tagNames: ["测试"],
  });
  record(s, "POST /threads (with content)", {
    title: "快照测试帖",
    category: "RPG",
    content: "这是一段正文内容（快照验证）",
    tagNames: ["测试"],
  }, createFull, cf);
  const fullThreadId = (createFull as any)?.data?.id;

  // ── 详情（含正文的草稿） ──
  const { body: detailFull, status: df } = await api("GET", `/api/v1/threads/${fullThreadId}`);
  record(s, `GET /threads/${fullThreadId} (draft with bodyPost)`, null, detailFull, df);

  // ── 详情（无正文的草稿） ──
  const { body: detailEmpty, status: de } = await api("GET", `/api/v1/threads/${emptyThreadId}`);
  record(s, `GET /threads/${emptyThreadId} (draft without bodyPost)`, null, detailEmpty, de);

  // ── 创建首楼（无正文草稿 + POST post） ──
  const { body: createPost, status: cp } = await api("POST", `/api/v1/subthreads/${emptySubId}/posts`, { content: "后来补的首楼" });
  record(s, `POST /subthreads/${emptySubId}/posts`, { content: "后来补的首楼" }, createPost, cp);
  const postId = (createPost as any)?.data?.id;
  const postVersion = (createPost as any)?.data?.version;

  // ── 详情（补了首楼后再取，bodyPost 应有值） ──
  const { body: detailAfter, status: da } = await api("GET", `/api/v1/threads/${emptyThreadId}`);
  record(s, `GET /threads/${emptyThreadId} (after creating first post)`, null, detailAfter, da);

  // ── 编辑首楼 ──
  if (postId) {
    const { body: editPost, status: ep } = await api("PATCH", `/api/v1/posts/${postId}`, {
      content: "修改后的首楼正文",
      version: postVersion,
    });
    record(s, `PATCH /posts/${postId}`, { content: "修改后的首楼正文", version: postVersion }, editPost, ep);
  }

  // ── 更新草稿元数据 ──
  const { body: updateMeta, status: um } = await api("PATCH", `/api/v1/threads/${emptyThreadId}`, {
    title: "更新后的标题",
    category: "NATION",
    version: emptyVersion,
  });
  record(s, `PATCH /threads/${emptyThreadId} (update meta)`, {
    title: "更新后的标题",
    category: "NATION",
    version: emptyVersion,
  }, updateMeta, um);
  const updatedVersion = (updateMeta as any)?.data?.version ?? emptyVersion;

  // ── 草稿箱 ──
  const { body: draftList, status: dl } = await api("GET", "/api/v1/threads/draft");
  record(s, "GET /threads/draft", null, draftList, dl);

  // ── 发布 ──
  const { body: publish, status: pb } = await api("PATCH", `/api/v1/threads/${fullThreadId}`, {
    published: true,
    version: 1,
  });
  record(s, `PATCH /threads/${fullThreadId} {published:true}`, { published: true, version: 1 }, publish, pb);

  // ── 邀请链接（需 published + private，放到 empty thread after publish） ──
  // empty thread 现在有正文，可以发布为 private
  await api("PATCH", `/api/v1/threads/${emptyThreadId}`, {
    visibility: "PRIVATE",
    version: updatedVersion,
  });
  // 需要更新 version 后再发布
  const { body: reDetail } = await api("GET", `/api/v1/threads/${emptyThreadId}`);
  const reVersion = (reDetail as any)?.data?.version;
  await api("PATCH", `/api/v1/threads/${emptyThreadId}`, { published: true, version: reVersion });
  const { body: invite, status: iv } = await api("POST", `/api/v1/threads/${emptyThreadId}/invite-link`, {});
  if (invite) record(s, `POST /threads/${emptyThreadId}/invite-link`, null, invite, iv);

  // ── 加入邀请 ──
  const token = (invite as any)?.data?.token;
  if (token) {
    const { body: previewInvite, status: pi } = await api("GET", `/api/v1/threads/join-by-link/${token}`);
    record(s, `GET /threads/join-by-link/${token}`, null, previewInvite, pi);
  }

  // ── 点赞 ──
  const { body: like, status: lk } = await api("POST", `/api/v1/threads/${fullThreadId}/like`, {});
  record(s, `POST /threads/${fullThreadId}/like`, null, like, lk);

  const { body: unlike, status: ul } = await api("DELETE", `/api/v1/threads/${fullThreadId}/like`, {});
  record(s, `DELETE /threads/${fullThreadId}/like`, null, unlike, ul);

  // ── 成员列表 ──
  const { body: members, status: ms } = await api("GET", `/api/v1/threads/${fullThreadId}/members`);
  record(s, `GET /threads/${fullThreadId}/members`, null, members, ms);

  save(s);

  // ── 清理 ──
  await api("DELETE", `/api/v1/threads/${emptyThreadId}`, {});
  await api("DELETE", `/api/v1/threads/${fullThreadId}`, {});
  console.log("  test threads cleaned up");
}

async function captureNotifications(): Promise<void> {
  const s = snap("notifications", "通知端点快照");
  const { body: list, status: ls } = await api("GET", "/api/v1/notifications?limit=5");
  record(s, "GET /notifications?limit=5", { limit: 5 }, list, ls);
  const { body: unread, status: ur } = await api("GET", "/api/v1/notifications/unread");
  record(s, "GET /notifications/unread", null, unread, ur);
  save(s);
}

async function capturePosts(): Promise<void> {
  const s = snap("posts", "楼层/帖子端点快照");

  // 找一个已发布的主题帖
  const { body: list } = await api("GET", "/api/v1/threads?sort=newest&limit=3");
  const published = ((list as any)?.data ?? []).find((t: any) => t.published);
  if (!published) {
    // 没有已发布的帖，创建一个
    const { body: created } = await api("POST", "/api/v1/threads", {
      title: "快照测试帖-posts",
      category: "RPG",
      visibility: "PUBLIC",
      content: "快照测试正文",
    });
    const postThread = (created as any)?.data;
    if (!postThread) { console.log("  ⚠ unable to create test thread for posts"); return; }
    const subId = postThread.defaultSubthreadId || postThread.subthreads?.[0]?.id;
    if (subId) {
      // 额外创建几个楼层
      await api("POST", `/api/v1/subthreads/${subId}/posts`, { content: "第二楼测试" });
      await api("POST", `/api/v1/subthreads/${subId}/posts`, { content: "第三楼测试" });
    }
    await api("PATCH", `/api/v1/threads/${postThread.id}`, { published: true, version: postThread.version });
    // 获取详情
    const { body: detail } = await api("GET", `/api/v1/threads/${postThread.id}`);
    record(s, `GET /threads/${postThread.id} (published)`, null, detail, (detail as any)?.code === 0 ? 200 : 500);

    if (subId) {
      const { body: floors, status: fs } = await api("GET", `/api/v1/subthreads/${subId}/posts?limit=5`);
      record(s, `GET /subthreads/${subId}/posts?limit=5`, { limit: 5 }, floors, fs);

      // 如果有两楼以上，查一楼的内联回复
      const firstFloor = ((floors as any)?.data ?? [])[0];
      if (firstFloor?.id) {
        const { body: replies, status: rs } = await api("GET", `/api/v1/posts/${firstFloor.id}/replies?limit=3`);
        record(s, `GET /posts/${firstFloor.id}/replies?limit=3`, { limit: 3 }, replies, rs);
      }
    }

    // 清理
    await api("DELETE", `/api/v1/threads/${postThread.id}`, {});
  } else {
    // 用已有帖
    const subId = published.defaultSubthreadId || published.defaultSubthread?.id;
    if (!subId) { console.log("  ⚠ no subthread found"); return; }

    const { body: floors, status: fs } = await api("GET", `/api/v1/subthreads/${subId}/posts?limit=5`);
    record(s, `GET /subthreads/${subId}/posts?limit=5`, { limit: 5 }, floors, fs);

    const firstFloor = ((floors as any)?.data ?? [])[0];
    if (firstFloor?.id) {
      const { body: replies, status: rs } = await api("GET", `/api/v1/posts/${firstFloor.id}/replies?limit=3`);
      record(s, `GET /posts/${firstFloor.id}/replies?limit=3`, { limit: 3 }, replies, rs);
    }
  }

  save(s);
}

async function captureSearch(): Promise<void> {
  const s = snap("search", "搜索端点快照");
  const { body, status } = await api("GET", "/api/v1/search?q=测试");
  record(s, "GET /search?q=测试", { q: "测试" }, body, status);
  save(s);
}

async function captureUsers(): Promise<void> {
  const s = snap("users", "用户资料/关注/拉黑端点快照");

  // 本人资料
  const { body: me, status: ms } = await api("GET", "/api/v1/users/me");
  record(s, "GET /users/me", null, me, ms);

  // 搜索用户，找他人做关注/拉黑目标
  const { body: searchBody } = await api("GET", "/api/v1/users/search?q=testuser");
  record(s, "GET /users/search?q=testuser", { q: "testuser" }, searchBody, (searchBody as any)?.code === 0 ? 200 : 500);
  const matches = (searchBody as any)?.data ?? [];
  const target = matches.find((u: any) => u.id !== USER_ID) ?? matches[0];
  const targetId = target?.id;

  // 本人公开资料（登录态，含关系字段）
  if (targetId) {
    const { body: pub, status: ps } = await api("GET", `/api/v1/users/${targetId}`);
    record(s, `GET /users/${targetId} (logged in)`, null, pub, ps);
    const { body: replies, status: rs } = await api("GET", `/api/v1/users/${targetId}/recent-replies`);
    record(s, `GET /users/${targetId}/recent-replies`, null, replies, rs);
    const { body: played, status: pts } = await api("GET", `/api/v1/users/${targetId}/played-threads?limit=3`);
    record(s, `GET /users/${targetId}/played-threads?limit=3`, { limit: 3 }, played, pts);
    const { body: bm, status: bms } = await api("GET", `/api/v1/users/${targetId}/bookmarks?limit=3`);
    record(s, `GET /users/${targetId}/bookmarks?limit=3`, { limit: 3 }, bm, bms);
  }

  // 关注 → 记录 → 取消（保持状态干净）
  if (targetId) {
    const { body: follow, status: fs } = await api("POST", `/api/v1/users/follow/${targetId}`, {});
    record(s, `POST /users/follow/${targetId}`, null, follow, fs);
    const { body: following, status: fgs } = await api("GET", "/api/v1/users/following");
    record(s, "GET /users/following", null, following, fgs);
    const { body: followers, status: fls } = await api("GET", "/api/v1/users/followers");
    record(s, "GET /users/followers", null, followers, fls);
    const { body: unfollow, status: ufs } = await api("DELETE", `/api/v1/users/follow/${targetId}`, {});
    record(s, `DELETE /users/follow/${targetId}`, null, unfollow, ufs);
  }

  // 拉黑 → 记录 → 取消
  if (targetId) {
    const { body: block, status: bs } = await api("POST", `/api/v1/users/me/block/${targetId}`, {});
    record(s, `POST /users/me/block/${targetId}`, null, block, bs);
    const { body: blocks, status: bks } = await api("GET", "/api/v1/users/me/blocks");
    record(s, "GET /users/me/blocks", null, blocks, bks);
    const { body: unblock, status: ubs } = await api("DELETE", `/api/v1/users/me/block/${targetId}`, {});
    record(s, `DELETE /users/me/block/${targetId}`, null, unblock, ubs);
  }

  save(s);
}

/** ── main ── */

async function main() {
  const mod = process.argv[2]?.replace("--module=", "") || "all";
  console.log(`\nAPI Verify — capturing real response snapshots (module=${mod})\n`);

  fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });

  await login();

  if (mod === "all" || mod === "auth") {
    console.log("[auth]");
    await captureAuth();
  }
  if (mod === "all" || mod === "tags") {
    console.log("[tags]");
    await captureTags();
  }
  if (mod === "all" || mod === "drafts") {
    console.log("[drafts]");
    await captureDrafts();
  }
  if (mod === "all" || mod === "threads") {
    console.log("[threads]");
    await captureThreads();
  }
  if (mod === "all" || mod === "posts") {
    console.log("[posts]");
    await capturePosts();
  }
  if (mod === "all" || mod === "notifications") {
    console.log("[notifications]");
    await captureNotifications();
  }
  if (mod === "all" || mod === "search") {
    console.log("[search]");
    await captureSearch();
  }
  if (mod === "all" || mod === "users") {
    console.log("[users]");
    await captureUsers();
  }

  // 登出
  await api("POST", "/api/v1/auth/logout", {});
  console.log(`\nDone. Snapshots written to ${SNAPSHOT_DIR}/\n`);
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});

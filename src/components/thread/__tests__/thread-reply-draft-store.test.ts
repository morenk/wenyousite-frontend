import { afterEach, expect, test, vi } from "vitest";
import { ThreadReplyDraftStore, hashReplyIdentity } from "../thread-reply-draft-store";
import type { ReplyDraft } from "../thread-composer-context";

const key = "wenyou:thread-reply:v1:u1:t1";
const draft = (content = "未发表正文"): ReplyDraft => ({
  session: { key: "reply:p1", anchorId: "reply:p1", type: "reply", subthreadId: "s1", parentPostId: "p1", replyToPostId: "p2", label: "回复", initialContent: "",
    mediaDisplays: [{ sourceUrl: "https://example.com/a.png", display: null }],
    mediaAudios: [{ sourceUrl: "https://example.com/a.mp3", mediaId: "a", contentType: "audio/mpeg", size: 100, durationMs: 1000 }],
    diceRolls: [{ nodeId: "n1", notation: "1d6", results: [2], modifier: 0, total: 2 }],
  }, content, pendingCreate: null,
});
afterEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

test("新实例恢复完整正文、媒体、骰子和身份选择，但从不持久化 token 或未知字段", async () => {
  const report = vi.fn();
  const store = new ThreadReplyDraftStore("u1", report);
  const source = draft("  首尾空白\n[[dice:v1:node:1d6]]\n");
  source.identitySelection = { scope: "reply:p1", mode: "RP", identityId: "role1", token: "private-identity-token", name: "角色" };
  source.pendingCreate = { subthreadId: "s1", content: source.content, identityMode: "RP", identityId: "role1", identityToken: "private-identity-token", clientRequestId: "original-uuid", parentPostId: "p1", replyToPostId: "p2", textFontVersion: 2, textColorVersion: 1, markdownContractVersion: 6 };
  source.pendingIdentityHash = await hashReplyIdentity(source.pendingCreate.identityToken!);
  store.set("t1", source);
  const raw = localStorage.getItem(key)!;
  expect(raw).not.toContain("private-identity-token");
  expect(raw).not.toContain("identityToken");
  const restored = new ThreadReplyDraftStore("u1", report).get("t1")!;
  expect(restored.content).toBe(source.content);
  expect(restored.session).toEqual(source.session);
  expect(restored.pendingCreate).toEqual({ ...source.pendingCreate, identityToken: undefined });
  expect(restored.pendingIdentityHash).toBe(await hashReplyIdentity("private-identity-token"));
  expect(restored.identitySelection).toMatchObject({ identityId: "role1", token: null, requiresConfirmation: true });
  expect(report).not.toHaveBeenCalled();
});

test("同账号不同主题、不同账号、匿名和后台均不串稿", () => {
  const report = vi.fn();
  const a = new ThreadReplyDraftStore("u1", report);
  a.set("t1", draft());
  expect(a.get("t2")).toBeUndefined();
  expect(new ThreadReplyDraftStore("u2", report).get("t1")).toBeUndefined();
  for (const account of ["anonymous", "station"]) {
    const store = new ThreadReplyDraftStore(account, report);
    store.set("t1", draft("匿名输入"));
    expect(store.get("t1")?.content).toBe("匿名输入");
    expect(new ThreadReplyDraftStore(account, report).get("t1")).toBeUndefined();
  }
  expect(localStorage.length).toBe(2);
});

test("完成清稿抑制旧版本，另一标签之后的新输入仍能恢复而不复活已发表正文", () => {
  const report = vi.fn();
  const a = new ThreadReplyDraftStore("u1", report);
  a.set("t1", draft("初稿"));
  const b = new ThreadReplyDraftStore("u1", report);
  expect(b.get("t1")?.content).toBe("初稿");
  a.delete("t1");
  expect(new ThreadReplyDraftStore("u1", report).get("t1")).toBeUndefined();
  b.set("t1", draft("另一个标签新的输入"));
  expect(new ThreadReplyDraftStore("u1", report).get("t1")?.content).toBe("另一个标签新的输入");
  expect(Object.values(localStorage).join("")).not.toContain("初稿");
});

test("账号切换只封旧实例，各账号盘稿保留，激活仅用于提交后生命周期", () => {
  const report = vi.fn();
  const a = new ThreadReplyDraftStore("u1", report);
  a.set("t1", draft());
  new ThreadReplyDraftStore("u2", report).set("t1", draft("另一个账号"));
  a.deactivate();
  a.set("t1", draft("迟到"));
  expect(a.delete("t1")).toBe(false);
  expect(new ThreadReplyDraftStore("u1", report).get("t1")?.content).toBe("未发表正文");
  expect(new ThreadReplyDraftStore("u2", report).get("t1")?.content).toBe("另一个账号");
  a.activate();
  expect(a.get("t1")?.content).toBe("未发表正文");
});

test("确定性交错的两个标签均读到旧版本时，两份正文都保留且可轮流恢复", () => {
  const report = vi.fn();
  const a = new ThreadReplyDraftStore("u1", report);
  a.set("t1", draft("共同起点"));
  const b = new ThreadReplyDraftStore("u1", report);
  b.get("t1");
  const raw = localStorage.getItem(key);
  const get = localStorage.getItem.bind(localStorage);
  let interleaved = false;
  vi.spyOn(localStorage, "getItem").mockImplementation((name) => {
    if (name === key && !interleaved) {
      interleaved = true;
      b.set("t1", draft("B并发正文"));
      return raw;
    }
    return get(name);
  });
  a.set("t1", draft("A并发正文"));
  expect(a.alternative("t1")?.draft.content).toBe("B并发正文");
  const restored = new ThreadReplyDraftStore("u1", report);
  expect(restored.get("t1")?.content).toBe("A并发正文");
  const other = restored.alternative("t1")!;
  expect(other.draft.content).toBe("B并发正文");
  restored.adoptAlternative("t1", other.revision);
  restored.set("t1", other.draft);
  expect(new ThreadReplyDraftStore("u1", report).get("t1")?.content).toBe("B并发正文");
  expect(restored.alternative("t1")?.draft.content).toBe("A并发正文");
});

test("正常连续输入回收旧全文，恢复确认过期不会错误选取另一个版本", () => {
  const report = vi.fn();
  const store = new ThreadReplyDraftStore("u1", report);
  for (let index = 0; index < 50; index++) store.set("t1", draft("最新" + index));
  expect(localStorage.length).toBe(2);
  expect(store.alternativeCount("t1")).toBe(0);
  expect(store.adoptAlternative("t1", "gone")).toBeUndefined();
});

test.each(["bad-json", JSON.stringify({ version: 2 }), JSON.stringify({ version: 1, revision: "v", draft: { content: 1 } })])("坏记录不覆盖且不崩溃：%s", (raw) => {
  localStorage.setItem(key, raw);
  const report = vi.fn();
  const store = new ThreadReplyDraftStore("u1", report);
  expect(store.get("t1")).toBeUndefined();
  store.set("t1", draft("当前输入"));
  expect(store.get("t1")?.content).toBe("当前输入");
  expect(localStorage.getItem(key)).toBe(raw);
  expect(store.hasUnsaved()).toBe(false);
  expect(report).toHaveBeenCalledTimes(1);
  expect(new ThreadReplyDraftStore("u1", report).get("t1")?.content).toBe("当前输入");
  expect(report).toHaveBeenCalledTimes(2);
});

test("存储禁用或配额失败不丢内存输入，恢复存储后可再次保存", () => {
  const report = vi.fn();
  const read = vi.spyOn(localStorage, "getItem").mockImplementation(() => { throw new Error("disabled"); });
  const store = new ThreadReplyDraftStore("u1", report);
  expect(store.get("t1")).toBeUndefined();
  store.set("t1", draft("仍能输入"));
  expect(store.get("t1")?.content).toBe("仍能输入");
  expect(store.hasUnsaved()).toBe(true);
  read.mockRestore();
  store.set("t1", draft("恢复"));
  expect(new ThreadReplyDraftStore("u1", report).get("t1")?.content).toBe("恢复");
  expect(store.hasUnsaved()).toBe(false);
  const write = vi.spyOn(localStorage, "setItem").mockImplementation(() => { throw new Error("quota"); });
  store.set("t1", draft("配额期间输入"));
  expect(store.get("t1")?.content).toBe("配额期间输入");
  expect(store.hasUnsaved()).toBe(true);
  write.mockRestore();
});

test("ACCOUNT身份恢复无需角色确认；未读key删除也建立防复活标记", () => {
  const report = vi.fn();
  const store = new ThreadReplyDraftStore("u1", report);
  store.set("t1", { ...draft(), identitySelection: { scope: "a", mode: "ACCOUNT", token: null, name: "本人" } });
  expect(new ThreadReplyDraftStore("u1", report).get("t1")?.identitySelection?.requiresConfirmation).toBe(false);
  expect(store.delete("empty")).toBe(false);
  expect(report).not.toHaveBeenCalled();
});

test("损坏的待确认请求目标不能作为另一楼层的回复恢复或覆盖旧稿", () => {
  const report = vi.fn();
  const store = new ThreadReplyDraftStore("u1", report);
  const broken = { ...draft(), pendingCreate: { subthreadId: "other-subthread", content: "待确认", clientRequestId: "uuid" } };
  store.set("t1", broken);
  expect(store.get("t1")).toBe(broken);
  expect(store.hasUnsaved()).toBe(true);
  expect(localStorage.getItem(key)).toBeNull();
  expect(report).toHaveBeenCalledOnce();
});

test("其他标签已经发表后，未改正文的pagehide/卸载快照不能复活初稿", () => {
  const report = vi.fn();
  const a = new ThreadReplyDraftStore("u1", report);
  a.set("t1", draft("已经发表的初稿"));
  const b = new ThreadReplyDraftStore("u1", report);
  const snapshot = b.get("t1")!;
  a.delete("t1");
  b.set("t1", { ...snapshot, session: { ...snapshot.session, key: "reply:other", label: "新入口" }, identitySelection: { scope: "reply:other", mode: "ACCOUNT", token: null, name: "新显示名" } });
  expect(new ThreadReplyDraftStore("u1", report).get("t1")).toBeUndefined();
  expect(Object.values(localStorage).join("")).not.toContain("已经发表的初稿");
});

test("主记录写入失败后的可靠副本保持单调版本，重试不会与另一标签并发稿错误合并", () => {
  const report = vi.fn();
  const a = new ThreadReplyDraftStore("u1", report);
  const set = localStorage.setItem.bind(localStorage);
  const failMain = vi.spyOn(localStorage, "setItem").mockImplementation((name, value) => { if (name === key) throw new Error("quota"); set(name, value); });
  a.set("t1", draft("副本已写"));
  expect(a.hasUnsaved()).toBe(true);
  failMain.mockRestore();
  const b = new ThreadReplyDraftStore("u1", report);
  expect(b.get("t1")?.content).toBe("副本已写");
  b.set("t1", draft("B新正文"));
  a.set("t1", draft("A新正文"));
  expect(a.alternative("t1")?.draft.content).toBe("B新正文");
  expect(Object.values(localStorage).join("")).toContain("A新正文");
});

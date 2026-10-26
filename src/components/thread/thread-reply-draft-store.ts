import { z } from "zod";
import type { ReplyDraft } from "./thread-composer-types";

const text = z.string().max(500_000);
const id = z.string().min(1).max(500);
const display = z.object({
  url: text, contentType: z.literal("image/webp"), width: z.number(), height: z.number(),
  bytes: z.number(), animated: z.boolean(), frameCount: z.number(), durationMs: z.number(), loopCount: z.number(),
});
const base = {
  key: id, anchorId: id, subthreadId: id, label: text, initialContent: text,
  mediaDisplays: z.array(z.object({ sourceUrl: text, display: display.nullable() })).max(1000).optional(),
  mediaAudios: z.array(z.object({ sourceUrl: text, mediaId: id, contentType: z.literal("audio/mpeg"), size: z.number(), durationMs: z.number() })).max(1000).optional(),
  diceRolls: z.array(z.object({ nodeId: id, notation: text, results: z.array(z.number()), modifier: z.number(), total: z.number() })).max(1000).optional(),
};
// 所有持久化字段显式列举；身份 token、访问凭证与未知字段不会进入本机记录。
const schema = z.object({
  session: z.discriminatedUnion("type", [
    z.object({ ...base, type: z.literal("create-floor") }),
    z.object({ ...base, type: z.literal("reply"), parentPostId: id, replyToPostId: id }),
  ]),
  content: text,
  identitySelection: z.object({ scope: id, mode: z.enum(["ACCOUNT", "RP"]), identityId: id.optional(), name: text }).optional(),
  pendingCreate: z.object({
    subthreadId: id, content: text, clientRequestId: id,
    parentPostId: id.optional(), replyToPostId: id.optional(),
    identityMode: z.enum(["ACCOUNT", "RP"]).optional(), identityId: id.optional(),
    markdownContractVersion: z.literal(6).optional(), textColorVersion: z.literal(1).optional(), textFontVersion: z.union([z.literal(1), z.literal(2)]).optional(),
  }).nullable(),
  pendingIdentityHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
}).superRefine((draft, context) => {
  const request = draft.pendingCreate;
  if (request && (request.subthreadId !== draft.session.subthreadId
    || request.parentPostId !== (draft.session.type === "reply" ? draft.session.parentPostId : undefined)
    || request.replyToPostId !== (draft.session.type === "reply" ? draft.session.replyToPostId : undefined))) {
    context.addIssue({ code: "custom", message: "待确认请求目标与草稿不一致" });
  }
});
const envelope = z.object({
  version: z.literal(1), revision: id, clock: z.record(z.string(), z.number().int().nonnegative()),
  updatedAt: z.number(), draft: schema.nullable(),
});
type Record = z.infer<typeof envelope>;
type Clock = Record["clock"];
const prefix = "wenyou:thread-reply:v1:";
function signature(draft: Record["draft"]) {
  if (!draft) return "null";
  return JSON.stringify({
    content: draft.content, mediaDisplays: draft.session.mediaDisplays ?? [],
    mediaAudios: draft.session.mediaAudios ?? [], diceRolls: draft.session.diceRolls ?? [],
    identityMode: draft.identitySelection?.mode ?? "ACCOUNT", identityId: draft.identitySelection?.identityId ?? null,
    pendingCreate: draft.pendingCreate, pendingIdentityHash: draft.pendingIdentityHash,
  });
}

const dominates = (a: Clock, b: Clock) => Object.entries(b).every(([writer, version]) => (a[writer] ?? 0) >= version);
const strictlyDominates = (a: Clock, b: Clock) => dominates(a, b) && !dominates(b, a);
function restore(record: Record): ReplyDraft | undefined {
  const draft = record.draft;
  return draft ? { ...draft, identitySelection: draft.identitySelection ? { ...draft.identitySelection, token: null, requiresConfirmation: draft.identitySelection.mode === "RP" } : undefined } : undefined;
}

export async function hashReplyIdentity(token: string): Promise<string> {
  const result = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(result), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** 同步不可变副本先落盘；向量标记并发分支，连续输入只保留最新全文。 */
export class ThreadReplyDraftStore extends Map<string, ReplyDraft> {
  private expected = new Map<string, string | null>();
  private clocks = new Map<string, Clock>();
  private signatures = new Map<string, string>();
  private writers = new Map<string, string>();
  private alternatives = new Map<string, Record[]>();
  private failed = new Set<string>();
  private corrupt = new Set<string>();
  private listeners = new Set<() => void>();
  private active = true;
  private warned = false;
  private enabled: boolean;
  private accountPrefix: string;
  constructor(accountId: string, private report: (message: string) => void) {
    super();
    this.enabled = !["anonymous", "station"].includes(accountId);
    this.accountPrefix = prefix + encodeURIComponent(accountId) + ":";
  }
  private key(threadId: string) { return this.accountPrefix + encodeURIComponent(threadId); }
  private warning(message: string) {
    if (!this.warned) { this.warned = true; this.report(message); }
  }
  private records(threadId: string) {
    const key = this.key(threadId);
    const keys = [key, ...Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index)).filter((item): item is string => Boolean(item?.startsWith(key + ":revision:")))];
    const records: { key: string; raw: string; record: Record }[] = [];
    for (const item of keys) {
      const raw = localStorage.getItem(item);
      if (!raw) continue;
      try {
        const parsed = envelope.safeParse(JSON.parse(raw));
        if (!parsed.success) throw new Error("本地回复稿版本无法读取");
        records.push({ key: item, raw, record: parsed.data });
      } catch {
        if (item === key) this.corrupt.add(threadId);
        this.warning("本地回复草稿无法读取，请先保留当前输入");
      }
    }
    return records;
  }
  private maximal(threadId: string) {
    const records = [...new Map(this.records(threadId).map((item) => [item.record.revision, item.record])).values()];
    return records.filter((record) => !records.some((other) => strictlyDominates(other.clock, record.clock)));
  }
  private updateAlternatives(threadId: string, selected?: string) {
    const alternatives = this.maximal(threadId).filter((record) => record.draft && record.revision !== selected);
    this.alternatives.set(threadId, alternatives);
    for (const listener of this.listeners) listener();
  }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  alternativeCount = (threadId: string) => this.alternatives.get(threadId)?.length ?? 0;
  refresh(threadId: string) {
    if (!this.enabled) return;
    try {
      const clock = this.clocks.get(threadId) ?? {};
      const alternatives = this.maximal(threadId).filter((record) => record.draft && !dominates(clock, record.clock));
      this.alternatives.set(threadId, alternatives);
      for (const listener of this.listeners) listener();
    } catch { this.warning("本地回复草稿无法读取，请先保留当前输入"); }
  }
  override get(threadId: string) {
    if (!this.enabled || this.expected.has(threadId)) return super.get(threadId);
    try {
      const raw = localStorage.getItem(this.key(threadId));
      this.expected.set(threadId, raw);
      const candidates = this.maximal(threadId);
      const selected = candidates.find((record) => record.draft && record.revision === readRevision(raw))
        ?? candidates.filter((record) => record.draft).sort((a, b) => b.updatedAt - a.updatedAt)[0]
        ?? candidates[0];
      this.clocks.set(threadId, selected?.clock ?? {});
      this.signatures.set(threadId, signature(selected?.draft ?? null));
      const draft = selected ? restore(selected) : undefined;
      if (draft) super.set(threadId, draft);
      this.updateAlternatives(threadId, selected?.revision);
      if (this.alternativeCount(threadId)) this.warning("存在另一份本地回复草稿，可在编辑器中恢复");
    } catch {
      this.expected.set(threadId, localStorageAvailableValue(this.key(threadId)));
      this.failed.add(threadId);
      this.warning("本地回复草稿无法读取，离开前请保留正文");
    }
    return super.get(threadId);
  }
  private write(threadId: string, draft: ReplyDraft | null) {
    if (!this.active || !this.enabled) return;
    try {
      const key = this.key(threadId);
      const payload = draft === null || (draft.content === "" && !draft.pendingCreate) ? null : schema.parse(draft);
      const nextSignature = signature(payload);
      if (nextSignature === this.signatures.get(threadId)) { this.refresh(threadId); return; }
      const observed = localStorage.getItem(key);
      const writer = this.writers.get(threadId) ?? crypto.randomUUID();
      this.writers.set(threadId, writer);
      const clock = { ...this.clocks.get(threadId) };
      clock[writer] = (clock[writer] ?? 0) + 1;
      const record: Record = { version: 1, revision: writer + ":" + clock[writer], clock, updatedAt: Date.now(), draft: payload };
      const raw = JSON.stringify(record);
      // 不可变随机键无跨标签覆盖；副本失败时绝不替换主记录。
      localStorage.setItem(key + ":revision:" + record.revision, raw);
      this.clocks.set(threadId, clock);
      this.signatures.set(threadId, nextSignature);
      if (observed === this.expected.get(threadId) && !this.corrupt.has(threadId)) {
        localStorage.setItem(key, raw);
        this.expected.set(threadId, raw);
      }
      // 只删除已被本次向量包含的不可变旧记录，不触碰并发或新出现的分支。
      for (const old of this.records(threadId)) {
        if (old.key !== key && strictlyDominates(clock, old.record.clock)) localStorage.removeItem(old.key);
      }
      this.failed.delete(threadId);
      this.updateAlternatives(threadId, record.revision);
      if (this.alternativeCount(threadId)) this.warning("另一标签页有不同回复稿，当前输入已保留，可恢复另一稿");
    } catch {
      this.failed.add(threadId);
      this.warning("本地回复草稿保存失败，离开前请保留正文");
    }
  }
  override set(threadId: string, draft: ReplyDraft) {
    if (!this.active) return this;
    this.get(threadId);
    super.set(threadId, draft);
    this.write(threadId, draft);
    return this;
  }
  override delete(threadId: string) {
    if (!this.active) return false;
    this.get(threadId);
    const removed = super.delete(threadId);
    this.write(threadId, null);
    return removed;
  }
  alternative(threadId: string) {
    this.refresh(threadId);
    const record = this.alternatives.get(threadId)?.[0];
    return record?.draft ? { revision: record.revision, draft: restore(record)! } : undefined;
  }
  /** 显式恢复以新分支继续，当前原稿仍留在独立分支，不覆盖待确认请求。 */
  adoptAlternative(threadId: string, revision: string): ReplyDraft | undefined {
    this.refresh(threadId);
    const record = this.alternatives.get(threadId)?.find((item) => item.revision === revision);
    if (!record?.draft) return;
    this.clocks.set(threadId, record.clock);
    this.signatures.delete(threadId);
    this.writers.set(threadId, crypto.randomUUID());
    this.expected.set(threadId, localStorageAvailableValue(this.key(threadId)));
    return restore(record);
  }
  hasUnsaved() { return this.failed.size > 0; }
  deactivate() { this.active = false; }
  activate() { this.active = true; }
}
function localStorageAvailableValue(key: string) {
  try { return localStorage.getItem(key); } catch { return null; }
}

function readRevision(raw: string | null): string | undefined { try { return raw ? JSON.parse(raw)?.revision : undefined; } catch { return undefined; } }

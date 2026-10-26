/** 主题帖详情编辑会话：全页只允许一个按需挂载的 Markdown 编辑器 */

"use client";

import { ThreadReplyDraftStore, hashReplyIdentity } from "./thread-reply-draft-store";
import type { PublicationIdentitySelection } from "@/components/thread/use-thread-identity-submission";
import type { CreatePostArgs } from "@/api/hooks/use-create-post";
import type { MarkdownMediaAudio } from "@/lib/markdown-audio";
import type { MarkdownMediaDisplay } from "@/lib/media-display";
import {
  createContext,
  useCallback,
  useEffect,
  useLayoutEffect,
  useContext,
  useMemo,
  useState,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { ThreadComposerSession, ReplyDraft } from "./thread-composer-types";
export type { ThreadComposerSession, CreateFloorComposerSession, ReplyComposerSession, EditComposerSession, ReplyDraft } from "./thread-composer-types";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/confirm-provider";

interface CloseOptions {
  /** 外部点击只关闭其观察到的会话，不能关闭随后切换的新目标。 */
  sessionKey?: string;
  force?: boolean;
  preserveReplyDraft?: boolean;
}

interface ThreadComposerContextValue {
  threadId?: string;
  session: ThreadComposerSession | null;
  content: string;
  dirty: boolean;
  pending: boolean;
  identitySelection?: PublicationIdentitySelection;
  setIdentitySelection: (value: PublicationIdentitySelection | undefined) => void;
  pendingCreate: CreatePostArgs | null;
  pendingIdentityHash?: string;
  localDraftRecovery: number;
  localDraftAlternatives: number;
  recoverLocalDraft: () => Promise<boolean>;
  setPendingCreate: (request: CreatePostArgs | null) => Promise<void>;
  open: (session: ThreadComposerSession) => Promise<boolean>;
  close: (options?: CloseOptions) => Promise<boolean>;
  setContent: (content: string) => void;
  setSessionContent: (key: string, content: string, recovery?: number) => void;
  setSessionMediaAudios: (key: string, mediaAudios: readonly MarkdownMediaAudio[] | undefined, recovery?: number) => void;
  setSessionMediaDisplays: (key: string, mediaDisplays: readonly MarkdownMediaDisplay[] | undefined, recovery?: number) => void;
  setPending: (pending: boolean) => void;
  setEditorValid: (valid: boolean) => void;
  onDocumentChange: (recovery?: number) => void;
  registerCloseGuard: (guard: () => boolean) => () => void;
}

type SessionContextValue = Omit<ThreadComposerContextValue, "content" | "dirty">;
const ThreadComposerSessionContext = createContext<SessionContextValue | null>(null);
const ThreadComposerContext = createContext<ThreadComposerContextValue | null>(null);

interface ReplyDraftScope {
  accountId: string;
  drafts: ThreadReplyDraftStore;
}

const ReplyDraftsContext = createContext<ReplyDraftScope | null>(null);

/** 本地草稿独立于云正文草稿；按账号隔离，登出或切号更换内存仓。 */
export function ThreadReplyDraftsProvider({ children, accountId }: { children: ReactNode; accountId: string }) {
  const [scope, setScope] = useState<ReplyDraftScope>(() => ({ accountId, drafts: new ThreadReplyDraftStore(accountId, (message) => toast.error(message)) }));
  if (scope.accountId !== accountId) {
    setScope({ accountId, drafts: new ThreadReplyDraftStore(accountId, (message) => toast.error(message)) });
  }
  useEffect(() => {
    scope.drafts.activate();
    return () => scope.drafts.deactivate();
  }, [scope]);
  useEffect(() => {
    const protectPending = (event: BeforeUnloadEvent) => {
      if (!scope.drafts.hasUnsaved() && ![...scope.drafts.values()].some((draft) => draft.pendingCreate)) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", protectPending);
    return () => window.removeEventListener("beforeunload", protectPending);
  }, [scope]);
  return <ReplyDraftsContext.Provider value={scope}>{children}</ReplyDraftsContext.Provider>;
}

export function ThreadComposerProvider({ children, threadId }: { children: ReactNode; threadId?: string }) {
  const sharedScope = useContext(ReplyDraftsContext);
  const [localDrafts] = useState(() => new Map<string, ReplyDraft>());
  return <ThreadComposerScope key={`${sharedScope?.accountId ?? "local"}:${threadId ?? ""}`} threadId={threadId} drafts={sharedScope?.drafts ?? localDrafts}>{children}</ThreadComposerScope>;
}

function ThreadComposerScope({ children, threadId, drafts }: { children: ReactNode; threadId?: string; drafts: Map<string, ReplyDraft> }) {
  const [session, setSession] = useState<ThreadComposerSession | null>(null);
  const [content, updateContent] = useState("");
  const [identitySelection, updateIdentitySelection] = useState<PublicationIdentitySelection>();
  const [pendingCreate, updatePendingCreate] = useState<CreatePostArgs | null>(() => drafts.get(threadId ?? "")?.pendingCreate ?? null);
  const [pendingIdentityHash, updatePendingIdentityHash] = useState<string | undefined>(() => drafts.get(threadId ?? "")?.pendingIdentityHash);
  const pendingHash = useRef(pendingIdentityHash);
  const [localDraftRecovery, setLocalDraftRecovery] = useState(0);
  const recoveryRef = useRef(0);
  const store = drafts instanceof ThreadReplyDraftStore ? drafts : null;
  const localDraftAlternatives = useSyncExternalStore(
    useCallback((listener) => store?.subscribe(listener) ?? (() => {}), [store]),
    useCallback(() => store?.alternativeCount(threadId ?? "") ?? 0, [store, threadId]),
    () => 0,
  );
  const [pending, updatePending] = useState(false);
  const [editorValid, updateEditorValid] = useState(true);
  const closeGuardRef = useRef<(() => boolean) | null>(null);
  const identityRef = useRef<PublicationIdentitySelection>(undefined);
  const live = useRef({ active: true, session: null as ThreadComposerSession | null, content: "", pending: false, pendingCreate: null as CreatePostArgs | null, valid: true, revision: 0, unsynchronized: false });
  const saveReplyDraft = useCallback(() => {
    const current = live.current;
    if (!current.active || !current.session || current.session.type === "edit") return;
    drafts.set(threadId ?? "", { session: current.session, content: current.content, identitySelection: identityRef.current, pendingCreate: current.pendingCreate, pendingIdentityHash: pendingHash.current });
  }, [drafts, threadId]);
  const setIdentitySelection = useCallback((next: PublicationIdentitySelection | undefined) => {
    identityRef.current = next;
    updateIdentitySelection(next);
    saveReplyDraft();
  }, [saveReplyDraft]);
  const setPendingCreate = useCallback(async (request: CreatePostArgs | null) => {
    const hash = request?.identityToken && drafts instanceof ThreadReplyDraftStore ? await hashReplyIdentity(request.identityToken) : request ? pendingHash.current : undefined;
    if (!live.current.active) {
      if (request) throw new Error("回复编辑会话已离开，未发送发表请求");
      return;
    }
    live.current.pendingCreate = request;
    updatePendingCreate(request);
    pendingHash.current = hash;
    updatePendingIdentityHash(hash);
    saveReplyDraft();
  }, [drafts, saveReplyDraft]);
  useEffect(() => {
    if (!pendingCreate) return;
    const protectPending = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", protectPending);
    return () => window.removeEventListener("beforeunload", protectPending);
  }, [pendingCreate]);
  const setContent = useCallback((next: string) => {
    live.current.content = next;
    live.current.unsynchronized = false;
    updateContent(next);
    saveReplyDraft();
  }, [saveReplyDraft]);
  const setSessionContent = useCallback((key: string, next: string, recovery?: number) => {
    if (recovery !== undefined && recovery !== recoveryRef.current) return;
    if (live.current.active && live.current.session?.key === key) setContent(next);
  }, [setContent]);
  const setSessionMediaDisplays = useCallback((key: string, mediaDisplays: readonly MarkdownMediaDisplay[] | undefined, recovery?: number) => {
    if (recovery !== undefined && recovery !== recoveryRef.current) return;
    const current = live.current;
    if (!current.active || current.session?.key !== key || !mediaDisplays || current.session.mediaDisplays === mediaDisplays) return;
    if (current.session.mediaDisplays?.length === mediaDisplays.length && current.session.mediaDisplays.every((previous, index) => previous.sourceUrl === mediaDisplays[index].sourceUrl && previous.display === mediaDisplays[index].display)) return;
    current.session = { ...current.session, mediaDisplays };
    setSession(current.session);
    saveReplyDraft();
  }, [saveReplyDraft]);
  const setSessionMediaAudios = useCallback((key: string, mediaAudios: readonly MarkdownMediaAudio[] | undefined, recovery?: number) => {
    if (recovery !== undefined && recovery !== recoveryRef.current) return;
    const current = live.current;
    if (!current.active || current.session?.key !== key || !mediaAudios || JSON.stringify(current.session.mediaAudios) === JSON.stringify(mediaAudios)) return;
    current.session = { ...current.session, mediaAudios };
    setSession(current.session);
    saveReplyDraft();
  }, [saveReplyDraft]);
  const onDocumentChange = useCallback((recovery?: number) => { if (recovery !== undefined && recovery !== recoveryRef.current) return; live.current.revision++; live.current.unsynchronized = true; }, []);
  const setPending = useCallback((next: boolean) => { live.current.pending = next; updatePending(next); }, []);
  const setEditorValid = useCallback((next: boolean) => { live.current.valid = next; updateEditorValid(next); }, []);
  const registerCloseGuard = useCallback((guard: () => boolean) => {
    closeGuardRef.current = guard;
    return () => { if (closeGuardRef.current === guard) closeGuardRef.current = null; };
  }, []);
  useLayoutEffect(() => {
    const current = live.current;
    current.active = true;
    return () => {
      // 父级先于编辑器卸载，先刷新快照，再封住旧实例的一切迟到写入。
      if (!current.pendingCreate) closeGuardRef.current?.();
      current.active = false;
    };
  }, []);
  useEffect(() => {
    const synchronize = () => {
      if (!live.current.active || live.current.pendingCreate) return true;
      return closeGuardRef.current?.() !== false;
    };
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (live.current.pending || !synchronize() || (drafts instanceof ThreadReplyDraftStore && drafts.hasUnsaved())) {
        event.preventDefault(); event.returnValue = "";
      }
    };
    const hidden = () => { if (document.visibilityState === "hidden") synchronize(); };
    window.addEventListener("pagehide", synchronize);
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.removeEventListener("pagehide", synchronize);
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [drafts]);
  const confirmAction = useConfirm();
  useEffect(() => {
    const refresh = () => store?.refresh(threadId ?? "");
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    return () => { window.removeEventListener("storage", refresh); window.removeEventListener("focus", refresh); };
  }, [store, threadId]);
  const recoverLocalDraft = useCallback(async () => {
    const current = live.current;
    const candidate = store?.alternative(threadId ?? "");
    const alternative = candidate?.draft;
    if (!store || !current.active || !current.session || !alternative) return false;
    if (current.pendingCreate || current.pending) { toast.error("请先确认当前发表结果，另一份草稿已保留"); return false; }
    if (current.session.type === "edit") return false;
    if (closeGuardRef.current?.() === false) return false;
    if (alternative.pendingCreate && alternative.session.key !== current.session.key) { toast.error("另一份草稿的发表结果待确认，请回到原回复入口恢复"); return false; }
    const revision = current.revision;
    const originalKey = current.session.key;
    const originalType = current.session.type;
    const generation = recoveryRef.current;
    const snapshot = current.content;
    if (!await confirmAction({ title: "恢复另一份本地稿", description: "当前正文会保留为另一份本地稿。", confirmLabel: "恢复" })) return false;
    if (!live.current.active || live.current.revision !== revision || live.current.pendingCreate || live.current.pending
      || live.current.session?.key !== originalKey || live.current.session.type !== originalType
      || recoveryRef.current !== generation || live.current.content !== snapshot || closeGuardRef.current?.() === false) return false;
    if (alternative.pendingCreate && alternative.session.key !== live.current.session.key) return false;
    const adopted = store.adoptAlternative(threadId ?? "", candidate!.revision);
    if (!adopted) { toast.error("另一份草稿已变化，请重新恢复"); return false; }
    recoveryRef.current++;
    const nextSession = { ...current.session, mediaDisplays: alternative.session.mediaDisplays, mediaAudios: alternative.session.mediaAudios, diceRolls: alternative.session.diceRolls };
    current.session = nextSession;
    current.content = alternative.content;
    current.pendingCreate = alternative.pendingCreate;
    current.unsynchronized = false;
    pendingHash.current = alternative.pendingIdentityHash;
    identityRef.current = alternative.identitySelection ? { ...alternative.identitySelection, scope: nextSession.key } : undefined;
    updateContent(current.content);
    setSession(nextSession);
    updatePendingCreate(current.pendingCreate);
    updatePendingIdentityHash(pendingHash.current);
    updateIdentitySelection(identityRef.current);
    saveReplyDraft();
    setLocalDraftRecovery(recoveryRef.current);
    return true;
  }, [store, threadId, confirmAction, saveReplyDraft]);
  const dirty = session !== null && (!editorValid || content !== session.initialContent);
  const confirmDiscard = useCallback(async () => {
    // guard 可同步刷新正文，必须在其执行后读取 ref，不能依赖上一轮 render 的 dirty。
    if (live.current.pendingCreate) { toast.error("发表结果尚未确认，请先重试确认发表"); return false; }
    if (closeGuardRef.current?.() === false) return false;
    const current = live.current;
    if (current.session?.type !== "edit" && (!current.valid || current.unsynchronized)) { toast.error("正文尚未同步，请完成输入后重试"); return false; }
    if (!current.session || current.session.type !== "edit" || (current.valid && !current.unsynchronized && current.content === current.session.initialContent)) return true;
    const revision = current.revision;
    const snapshot = current.content;
    const confirmed = await confirmAction({
      title: "放弃未提交内容",
      description: "当前内容尚未提交，确定要放弃吗？",
      confirmLabel: "放弃内容",
      destructive: true,
    });
    if (!confirmed || closeGuardRef.current?.() === false) return false;
    if (live.current.revision !== revision || live.current.content !== snapshot) {
      toast.error("正文已变化，请再次确认");
      return false;
    }
    return true;
  }, [confirmAction]);
  const open = useCallback(async (nextSession: ThreadComposerSession) => {
    if (!live.current.active || live.current.pending) return false;
    if (live.current.session?.key === nextSession.key) return true;
    const stored = drafts.get(threadId ?? "");
    // 跨路由返回时，结果不明的请求仍绑定原入口，不能借共享正文改写目标或 UUID。
    if (!live.current.session && stored?.pendingCreate && stored.session.key !== nextSession.key) {
      toast.error("发表结果尚未确认，请回到原回复入口重试确认发表");
      return false;
    }
    if (!(await confirmDiscard()) || !live.current.active) return false;
    saveReplyDraft();
    const draft = nextSession.type === "edit" ? undefined : drafts.get(threadId ?? "");
    const restoredSession = draft ? {
      ...nextSession,
      mediaDisplays: draft.session.mediaDisplays,
      mediaAudios: draft.session.mediaAudios,
      diceRolls: draft.session.diceRolls,
    } : nextSession;
    setEditorValid(true);
    const restoredIdentity = draft?.identitySelection ? { ...draft.identitySelection, scope: nextSession.key } : undefined;
    const restoredContent = draft?.content ?? nextSession.initialContent;
    // 先原子更新所有 live refs，再统一写盘，不能先把恢复正文覆盖为空。
    live.current.session = restoredSession;
    live.current.content = restoredContent;
    live.current.pendingCreate = draft?.pendingCreate ?? null;
    live.current.unsynchronized = false;
    identityRef.current = restoredIdentity;
    pendingHash.current = draft?.pendingIdentityHash;
    setSession(restoredSession);
    updateContent(restoredContent);
    updateIdentitySelection(restoredIdentity);
    updatePendingCreate(live.current.pendingCreate);
    updatePendingIdentityHash(pendingHash.current);
    saveReplyDraft();
    return true;
  }, [confirmDiscard, drafts, threadId, saveReplyDraft, setEditorValid]);
  const close = useCallback(async ({ force = false, preserveReplyDraft = false, sessionKey }: CloseOptions = {}) => {
    if (sessionKey && live.current.session?.key !== sessionKey) return false;
    if (!live.current.active || (!force && live.current.pending)) return false;
    if (!force && !(await confirmDiscard())) return false;
    if (sessionKey && live.current.session?.key !== sessionKey) return false;
    if (!live.current.active) return false;
    if (force && !preserveReplyDraft) drafts.delete(threadId ?? "");
    else saveReplyDraft();
    setEditorValid(true);
    live.current.session = null;
    setSession(null);
    setContent("");
    setPending(false);
    setPendingCreate(null);
    setIdentitySelection(undefined);
    return true;
  }, [confirmDiscard, drafts, threadId, saveReplyDraft, setContent, setEditorValid, setPending, setPendingCreate, setIdentitySelection]);

  const value = useMemo<ThreadComposerContextValue>(
    () => ({
      threadId,
      session,
      content,
      dirty,
      pending,
      pendingCreate,
      pendingIdentityHash,
      localDraftRecovery, localDraftAlternatives, recoverLocalDraft,
      setPendingCreate,
      identitySelection,
      setIdentitySelection,
      open,
      close,
      setContent,
      setSessionContent,
      setSessionMediaDisplays,
      setSessionMediaAudios,
      setPending,
      setEditorValid,
      registerCloseGuard,
      onDocumentChange,
    }),
    [threadId, session, content, dirty, pending, pendingCreate, pendingIdentityHash, localDraftRecovery, localDraftAlternatives, recoverLocalDraft, setPendingCreate, identitySelection, setIdentitySelection, open, close, registerCloseGuard, onDocumentChange, setContent, setSessionContent, setSessionMediaDisplays, setSessionMediaAudios, setPending, setEditorValid],
  );

  const sessionValue = useMemo<SessionContextValue>(() => ({ threadId, session, pending, pendingCreate, pendingIdentityHash, localDraftRecovery, localDraftAlternatives, recoverLocalDraft, setPendingCreate, identitySelection, setIdentitySelection, open, close, setContent, setSessionContent, setSessionMediaDisplays, setSessionMediaAudios, setPending, setEditorValid, registerCloseGuard, onDocumentChange }),
    [threadId, session, pending, pendingCreate, pendingIdentityHash, localDraftRecovery, localDraftAlternatives, recoverLocalDraft, setPendingCreate, identitySelection, setIdentitySelection, open, close, setContent, setSessionContent, setSessionMediaDisplays, setSessionMediaAudios, setPending, setEditorValid, registerCloseGuard, onDocumentChange]);
  return (
    <ThreadComposerSessionContext.Provider value={sessionValue}>
      <ThreadComposerContext.Provider value={value}>{children}</ThreadComposerContext.Provider>
    </ThreadComposerSessionContext.Provider>
  );
}

export function useThreadComposer() {
  const context = useContext(ThreadComposerContext);
  if (!context) {
    throw new Error("useThreadComposer 必须在 ThreadComposerProvider 内使用");
  }
  return context;
}

/** 楼层/回复入口只订阅会话目标，不订阅正文快照。 */
export function useThreadComposerSession() {
  const context = useContext(ThreadComposerSessionContext);
  if (!context) throw new Error("useThreadComposerSession 必须在 ThreadComposerProvider 内使用");
  return context;
}

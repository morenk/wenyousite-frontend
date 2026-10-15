/** 主题帖详情编辑会话：全页只允许一个按需挂载的 Markdown 编辑器 */

"use client";

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
  type ReactNode,
} from "react";
import type { InlineDiceRoll } from "@/lib/dice-inline";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/confirm-provider";

interface BaseComposerSession {
  key: string;
  anchorId: string;
  subthreadId: string;
  label: string;
  initialContent: string;
  mediaDisplays?: readonly MarkdownMediaDisplay[];
  mediaAudios?: readonly MarkdownMediaAudio[];
  diceRolls?: InlineDiceRoll[];
}

export interface CreateFloorComposerSession extends BaseComposerSession {
  type: "create-floor";
}

export interface ReplyComposerSession extends BaseComposerSession {
  type: "reply";
  parentPostId: string;
  replyToPostId: string;
}

export interface EditComposerSession extends BaseComposerSession {
  type: "edit";
  postId: string;
  version: number;
  parentPostId?: string;
}

export type ThreadComposerSession =
  | CreateFloorComposerSession
  | ReplyComposerSession
  | EditComposerSession;

interface CloseOptions {
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
  setPendingCreate: (request: CreatePostArgs | null) => void;
  open: (session: ThreadComposerSession) => Promise<boolean>;
  close: (options?: CloseOptions) => Promise<boolean>;
  setContent: (content: string) => void;
  setSessionContent: (key: string, content: string) => void;
  setSessionMediaAudios: (key: string, mediaAudios: readonly MarkdownMediaAudio[] | undefined) => void;
  setSessionMediaDisplays: (key: string, mediaDisplays: readonly MarkdownMediaDisplay[] | undefined) => void;
  setPending: (pending: boolean) => void;
  setEditorValid: (valid: boolean) => void;
  onDocumentChange: () => void;
  registerCloseGuard: (guard: () => boolean) => () => void;
}

type SessionContextValue = Omit<ThreadComposerContextValue, "content" | "dirty">;
const ThreadComposerSessionContext = createContext<SessionContextValue | null>(null);
const ThreadComposerContext = createContext<ThreadComposerContextValue | null>(null);

interface ReplyDraft {
  session: CreateFloorComposerSession | ReplyComposerSession;
  content: string;
  identitySelection?: PublicationIdentitySelection;
  pendingCreate: CreatePostArgs | null;
}

interface ReplyDraftScope {
  accountId: string;
  drafts: Map<string, ReplyDraft>;
}

const ReplyDraftsContext = createContext<ReplyDraftScope | null>(null);

/** 仅保存在当前应用内存；账号改变（含登出）时只替换草稿仓，不重挂无关页面。 */
export function ThreadReplyDraftsProvider({ children, accountId }: { children: ReactNode; accountId: string }) {
  const [scope, setScope] = useState<ReplyDraftScope>(() => ({ accountId, drafts: new Map() }));
  if (scope.accountId !== accountId) setScope({ accountId, drafts: new Map() });
  useEffect(() => {
    const protectPending = (event: BeforeUnloadEvent) => {
      if (![...scope.drafts.values()].some((draft) => draft.pendingCreate)) return;
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
  const [pending, updatePending] = useState(false);
  const [editorValid, updateEditorValid] = useState(true);
  const closeGuardRef = useRef<(() => boolean) | null>(null);
  const identityRef = useRef<PublicationIdentitySelection>(undefined);
  const live = useRef({ active: true, session: null as ThreadComposerSession | null, content: "", pending: false, pendingCreate: null as CreatePostArgs | null, valid: true, revision: 0, unsynchronized: false });
  const saveReplyDraft = useCallback(() => {
    const current = live.current;
    if (!current.active || !current.session || current.session.type === "edit") return;
    drafts.set(threadId ?? "", { session: current.session, content: current.content, identitySelection: identityRef.current, pendingCreate: current.pendingCreate });
  }, [drafts, threadId]);
  const setIdentitySelection = useCallback((next: PublicationIdentitySelection | undefined) => {
    identityRef.current = next;
    updateIdentitySelection(next);
    saveReplyDraft();
  }, [saveReplyDraft]);
  const setPendingCreate = useCallback((request: CreatePostArgs | null) => {
    live.current.pendingCreate = request;
    updatePendingCreate(request);
    saveReplyDraft();
  }, [saveReplyDraft]);
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
  const setSessionContent = useCallback((key: string, next: string) => {
    if (live.current.active && live.current.session?.key === key) setContent(next);
  }, [setContent]);
  const setSessionMediaDisplays = useCallback((key: string, mediaDisplays: readonly MarkdownMediaDisplay[] | undefined) => {
    const current = live.current;
    if (!current.active || current.session?.key !== key || !mediaDisplays || current.session.mediaDisplays === mediaDisplays) return;
    if (current.session.mediaDisplays?.length === mediaDisplays.length && current.session.mediaDisplays.every((previous, index) => previous.sourceUrl === mediaDisplays[index].sourceUrl && previous.display === mediaDisplays[index].display)) return;
    current.session = { ...current.session, mediaDisplays };
    setSession(current.session);
    saveReplyDraft();
  }, [saveReplyDraft]);
  const setSessionMediaAudios = useCallback((key: string, mediaAudios: readonly MarkdownMediaAudio[] | undefined) => {
    const current = live.current;
    if (!current.active || current.session?.key !== key || !mediaAudios || JSON.stringify(current.session.mediaAudios) === JSON.stringify(mediaAudios)) return;
    current.session = { ...current.session, mediaAudios };
    setSession(current.session);
    saveReplyDraft();
  }, [saveReplyDraft]);
  const onDocumentChange = useCallback(() => { live.current.revision++; live.current.unsynchronized = true; }, []);
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
  const confirmAction = useConfirm();
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
    live.current.session = restoredSession;
    setSession(restoredSession);
    setIdentitySelection(draft?.identitySelection ? { ...draft.identitySelection, scope: nextSession.key } : undefined);
    setPendingCreate(draft?.pendingCreate ?? null);
    setContent(draft?.content ?? nextSession.initialContent);
    return true;
  }, [confirmDiscard, drafts, threadId, saveReplyDraft, setContent, setEditorValid, setIdentitySelection, setPendingCreate]);
  const close = useCallback(async ({ force = false, preserveReplyDraft = false }: CloseOptions = {}) => {
    if (!live.current.active || (!force && live.current.pending)) return false;
    if (!force && !(await confirmDiscard())) return false;
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
    [threadId, session, content, dirty, pending, pendingCreate, setPendingCreate, identitySelection, setIdentitySelection, open, close, registerCloseGuard, onDocumentChange, setContent, setSessionContent, setSessionMediaDisplays, setSessionMediaAudios, setPending, setEditorValid],
  );

  const sessionValue = useMemo<SessionContextValue>(() => ({ threadId, session, pending, pendingCreate, setPendingCreate, identitySelection, setIdentitySelection, open, close, setContent, setSessionContent, setSessionMediaDisplays, setSessionMediaAudios, setPending, setEditorValid, registerCloseGuard, onDocumentChange }),
    [threadId, session, pending, pendingCreate, setPendingCreate, identitySelection, setIdentitySelection, open, close, setContent, setSessionContent, setSessionMediaDisplays, setSessionMediaAudios, setPending, setEditorValid, registerCloseGuard, onDocumentChange]);
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

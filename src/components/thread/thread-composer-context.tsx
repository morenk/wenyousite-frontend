/** 主题帖详情编辑会话：全页只允许一个按需挂载的 Markdown 编辑器 */

"use client";

import type { MarkdownMediaDisplay } from "@/lib/media-display";
import {
  createContext,
  useCallback,
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
}

interface ThreadComposerContextValue {
  threadId?: string;
  session: ThreadComposerSession | null;
  content: string;
  dirty: boolean;
  pending: boolean;
  open: (session: ThreadComposerSession) => Promise<boolean>;
  close: (options?: CloseOptions) => Promise<boolean>;
  setContent: (content: string) => void;
  setPending: (pending: boolean) => void;
  setEditorValid: (valid: boolean) => void;
  onDocumentChange: () => void;
  registerCloseGuard: (guard: () => boolean) => () => void;
}

type SessionContextValue = Omit<ThreadComposerContextValue, "content" | "dirty">;
const ThreadComposerSessionContext = createContext<SessionContextValue | null>(null);
const ThreadComposerContext = createContext<ThreadComposerContextValue | null>(null);

export function ThreadComposerProvider({ children, threadId }: { children: ReactNode; threadId?: string }) {
  const [session, setSession] = useState<ThreadComposerSession | null>(null);
  const [content, updateContent] = useState("");
  const [pending, updatePending] = useState(false);
  const [editorValid, updateEditorValid] = useState(true);
  const closeGuardRef = useRef<(() => boolean) | null>(null);
  const live = useRef({ session: null as ThreadComposerSession | null, content: "", pending: false, valid: true, revision: 0, unsynchronized: false });
  const setContent = useCallback((next: string) => {
    live.current.content = next;
    live.current.unsynchronized = false;
    updateContent(next);
  }, []);
  const onDocumentChange = useCallback(() => { live.current.revision++; live.current.unsynchronized = true; }, []);
  const setPending = useCallback((next: boolean) => { live.current.pending = next; updatePending(next); }, []);
  const setEditorValid = useCallback((next: boolean) => { live.current.valid = next; updateEditorValid(next); }, []);
  const registerCloseGuard = useCallback((guard: () => boolean) => {
    closeGuardRef.current = guard;
    return () => { if (closeGuardRef.current === guard) closeGuardRef.current = null; };
  }, []);
  const confirmAction = useConfirm();
  const dirty = session !== null && (!editorValid || content !== session.initialContent);
  const confirmDiscard = useCallback(async () => {
    // guard 可同步刷新正文，必须在其执行后读取 ref，不能依赖上一轮 render 的 dirty。
    if (closeGuardRef.current?.() === false) return false;
    const current = live.current;
    if (!current.session || (current.valid && !current.unsynchronized && current.content === current.session.initialContent)) return true;
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
    if (live.current.pending) return false;
    if (live.current.session?.key === nextSession.key) return true;
    if (!(await confirmDiscard())) return false;
    setEditorValid(true);
    live.current.session = nextSession;
    setSession(nextSession);
    setContent(nextSession.initialContent);
    return true;
  }, [confirmDiscard, setContent, setEditorValid]);
  const close = useCallback(async ({ force = false }: CloseOptions = {}) => {
    if (!force && live.current.pending) return false;
    if (!force && !(await confirmDiscard())) return false;
    setEditorValid(true);
    live.current.session = null;
    setSession(null);
    setContent("");
    setPending(false);
    return true;
  }, [confirmDiscard, setContent, setEditorValid, setPending]);

  const value = useMemo<ThreadComposerContextValue>(
    () => ({
      threadId,
      session,
      content,
      dirty,
      pending,
      open,
      close,
      setContent,
      setPending,
      setEditorValid,
      registerCloseGuard,
      onDocumentChange,
    }),
    [threadId, session, content, dirty, pending, open, close, registerCloseGuard, onDocumentChange, setContent, setPending, setEditorValid],
  );

  const sessionValue = useMemo<SessionContextValue>(() => ({ threadId, session, pending, open, close, setContent, setPending, setEditorValid, registerCloseGuard, onDocumentChange }),
    [threadId, session, pending, open, close, setContent, setPending, setEditorValid, registerCloseGuard, onDocumentChange]);
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

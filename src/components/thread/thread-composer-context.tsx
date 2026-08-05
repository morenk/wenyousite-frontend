/** 主题帖详情编辑会话：全页只允许一个按需挂载的 Markdown 编辑器 */

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

interface BaseComposerSession {
  key: string;
  anchorId: string;
  subthreadId: string;
  label: string;
  initialContent: string;
  initialDiceNotations?: string[];
  existingDiceCount?: number;
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
  diceNotations: string[];
  dirty: boolean;
  pending: boolean;
  open: (session: ThreadComposerSession) => boolean;
  close: (options?: CloseOptions) => boolean;
  setContent: (content: string) => void;
  setDiceNotations: (notations: string[]) => void;
  setPending: (pending: boolean) => void;
}

const ThreadComposerContext = createContext<ThreadComposerContextValue | null>(null);

export function ThreadComposerProvider({ children, threadId }: { children: ReactNode; threadId?: string }) {
  const [session, setSession] = useState<ThreadComposerSession | null>(null);
  const [content, setContent] = useState("");
  const [diceNotations, setDiceNotations] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const dirty = session !== null && (
    content !== session.initialContent ||
    JSON.stringify(diceNotations) !== JSON.stringify(session.initialDiceNotations ?? [])
  );

  const confirmDiscard = useCallback(() => {
    if (!dirty) return true;
    return window.confirm("当前内容尚未提交，确定要放弃吗？");
  }, [dirty]);

  const open = useCallback(
    (nextSession: ThreadComposerSession) => {
      if (pending) return false;
      if (session?.key === nextSession.key) return true;
      if (!confirmDiscard()) return false;

      setSession(nextSession);
      setContent(nextSession.initialContent);
      setDiceNotations(nextSession.initialDiceNotations ?? []);
      return true;
    },
    [confirmDiscard, pending, session?.key],
  );

  const close = useCallback(
    ({ force = false }: CloseOptions = {}) => {
      if (!force && pending) return false;
      if (!force && !confirmDiscard()) return false;

      setSession(null);
      setContent("");
      setDiceNotations([]);
      setPending(false);
      return true;
    },
    [confirmDiscard, pending],
  );

  const value = useMemo<ThreadComposerContextValue>(
    () => ({
      threadId,
      session,
      content,
      diceNotations,
      dirty,
      pending,
      open,
      close,
      setContent,
      setDiceNotations,
      setPending,
    }),
    [threadId, session, content, diceNotations, dirty, pending, open, close],
  );

  return (
    <ThreadComposerContext.Provider value={value}>
      {children}
    </ThreadComposerContext.Provider>
  );
}

export function useThreadComposer() {
  const context = useContext(ThreadComposerContext);
  if (!context) {
    throw new Error("useThreadComposer 必须在 ThreadComposerProvider 内使用");
  }
  return context;
}

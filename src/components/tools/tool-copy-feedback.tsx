"use client";
import { useEffect, useRef, useState } from "react";
import { copyToolText } from "@/lib/tools/clipboard";

export const TOOL_COPY_FEEDBACK_MS = 1500;

export function useToolCopy() {
  const [message, setMessage] = useState("");
  const timer = useRef<number | undefined>(undefined);
  const attempt = useRef(0);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    attempt.current++;
    return () => {
      alive.current = false;
      window.clearTimeout(timer.current);
    };
  }, []);
  const copy = async (text: string) => {
    const current = ++attempt.current;
    window.clearTimeout(timer.current);
    let copied = false;
    try { copied = await copyToolText(text); } catch { /* 保留可手动复制的失败提示。 */ }
    if (!alive.current || current !== attempt.current) return;
    setMessage(copied ? "已复制" : "复制未成功，请长按或选中结果手动复制");
    if (copied) timer.current = window.setTimeout(() => setMessage(""), TOOL_COPY_FEEDBACK_MS);
  };
  return { message, copy };
}

export function ToolCopyFeedback({ message }: { message: string }) {
  return <p role="status" aria-atomic="true" className={message
    ? "pointer-events-none fixed inset-x-4 bottom-6 z-[var(--layer-floating)] mx-auto w-fit max-w-[calc(100%-2rem)] rounded-[var(--radius-panel)] bg-popover px-4 py-2 text-sm text-popover-foreground shadow-popover"
    : "sr-only"}>{message}</p>;
}

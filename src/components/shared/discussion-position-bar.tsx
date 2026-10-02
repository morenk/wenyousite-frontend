"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Undo2 } from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/api/errors";
import { Button } from "@/components/ui/button";
import { DiscussionJump } from "./discussion-jump";

interface Props {
  subject: "楼层" | "回复";
  current?: number;
  maxNumber: number;
  total: number;
  onOpen?: () => void;
  onJump: (number: number, signal?: AbortSignal) => Promise<void>;
  onReturn?: () => Promise<void>;
  children?: ReactNode;
  showCompact?: boolean;
}

/** 统计行离开视口后收敛为编号胶囊，位于既有阅读栏之下。 */
export function DiscussionPositionBar({ subject, current, maxNumber, total, onJump, onOpen, onReturn, children, showCompact = true }: Props) {
  const marker = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    if (!marker.current || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setCompact(entry.boundingClientRect.top < 0 && !entry.isIntersecting), { threshold: 0 });
    observer.observe(marker.current);
    return () => observer.disconnect();
  }, []);
  const jump = (isCompact: boolean) => <DiscussionJump subject={subject} current={current} maxNumber={maxNumber} total={total} compact={isCompact} onJump={onJump} onOpen={onOpen} />;
  return <>
    {showCompact ? <div data-slot="discussion-position-anchor" className="sticky top-2 z-[var(--layer-sticky)] h-0">
      {compact ? <div data-slot="discussion-position-bar" className="inline-flex rounded-[var(--radius-control)] border border-border bg-card shadow-floating">{jump(true)}{onReturn ? <DiscussionReturnButton onReturn={onReturn} compact /> : null}</div> : null}
    </div> : null}
    <div ref={marker} className="mb-3 flex flex-wrap items-center gap-2">
      {jump(false)}
      {onReturn ? <DiscussionReturnButton onReturn={onReturn} /> : null}
      <div className="ml-auto min-w-0">{children}</div>
    </div>
  </>;
}

/** 只在本次有可返回位置时出现；紧凑阅读栏使用同一操作。 */
export function DiscussionReturnButton({ onReturn, compact = false }: { onReturn: () => Promise<void>; compact?: boolean }) {
  const [returning, setReturning] = useState(false);
  const button = <Button variant="ghost" size={compact ? "icon-sm" : "sm"} aria-label="回到刚才" pending={returning} disabled={returning} onClick={async () => {
    setReturning(true);
    try { await onReturn(); }
    catch (error) { toast.error(getApiErrorMessage(error, "暂时无法返回原位置")); }
    finally { setReturning(false); }
  }}>{compact ? <Undo2 className="size-4" aria-hidden="true" /> : "回到刚才"}</Button>;
  return compact ? <Tooltip content="回到刚才">{button}</Tooltip> : button;
}

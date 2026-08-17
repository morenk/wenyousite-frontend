/** 长主题帖滚动后的紧凑阅读书签条。 */

"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, Search } from "lucide-react";
import { useEffect, useState } from "react";

import type { SubthreadDetail } from "@/api/hooks/use-thread-detail";
import { SubthreadSwitcher } from "@/components/thread/subthread-tabs";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface ThreadReadingBarProps {
  threadTitle: string;
  subthreads: SubthreadDetail[];
  selectedSubthreadId?: string;
  onSubthreadChange: (id: string) => void;
  onSearch: () => void;
  isSearchOpen: boolean;
}

export function ThreadReadingBar({
  threadTitle,
  subthreads,
  selectedSubthreadId,
  onSubthreadChange,
  onSearch,
  isSearchOpen,
}: ThreadReadingBarProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const header = document.querySelector<HTMLElement>(
      '[data-slot="thread-detail-header"]',
    );
    if (!header || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setVisible(!entry.isIntersecting && entry.boundingClientRect.bottom < 0);
      },
      { threshold: 0 },
    );
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  return (
    <div data-slot="thread-reading-bar-anchor" className="sticky top-2 z-[var(--layer-sticky)] h-0">
      <AnimatePresence>
        {visible ? (
          <motion.nav
            data-slot="thread-reading-bar"
            aria-label="帖内阅读导航"
            initial={{ opacity: 0, y: -8, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.99 }}
            transition={{ duration: 0.16, ease: [0.2, 0.8, 0.2, 1] }}
            className="pointer-events-auto mx-1 flex min-w-0 items-center gap-2 overflow-visible rounded-2xl border border-border bg-card/95 p-2 shadow-floating backdrop-blur-md"
          >
            <span className="min-w-0 max-w-40 truncate px-2 text-sm font-semibold text-foreground">
              {threadTitle}
            </span>
            <div className="h-5 w-px shrink-0 bg-border" aria-hidden="true" />
            {subthreads.length > 1 ? (
              <SubthreadSwitcher
                subthreads={subthreads}
                selectedId={selectedSubthreadId}
                onChange={onSubthreadChange}
                className="min-w-0 flex-1"
              />
            ) : (
              <span className="min-w-0 flex-1 truncate px-1 text-sm text-muted-foreground">
                {subthreads[0]?.title ?? "主帖"}
              </span>
            )}
            <Tooltip content={isSearchOpen ? "关闭本帖搜索" : "搜索本帖"}>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={isSearchOpen ? "关闭本帖搜索" : "搜索本帖"}
                aria-expanded={isSearchOpen}
                onClick={onSearch}
                className={cn(
                  "rounded-lg text-muted-foreground hover:text-foreground",
                  isSearchOpen && "bg-accent text-foreground",
                )}
              >
                <Search className="size-4" aria-hidden="true" />
              </Button>
            </Tooltip>
            <Tooltip content="回到主题帖开头">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="回到主题帖开头"
                onClick={() => {
                  const reduceMotion = window.matchMedia?.(
                    "(prefers-reduced-motion: reduce)",
                  ).matches;
                  window.scrollTo({
                    top: 0,
                    behavior: reduceMotion ? "auto" : "smooth",
                  });
                }}
                className="rounded-lg text-muted-foreground hover:text-foreground"
              >
                <ArrowUp className="size-4" aria-hidden="true" />
              </Button>
            </Tooltip>
          </motion.nav>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

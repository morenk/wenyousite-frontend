/** 全站统一发布入口：用一枚“便笺折角”按钮承载主题帖与动态两种创作方式。 */

"use client";

import { Popover } from "@base-ui/react/popover";
import { ChevronDown, ChevronRight, FileText, Images, PenLine } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { MomentComposer } from "@/components/moment/moment-composer";
import { cn } from "@/lib/utils";

export function PublishMenu({ userId, compact = false }: { userId: string; compact?: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);

  return (
    <>
      <Popover.Root open={menuOpen} onOpenChange={setMenuOpen}>
        <Popover.Trigger
          render={
            <button
              type="button"
              aria-label="打开发布菜单"
              title="发布"
              className={cn(
                "group relative isolate mt-5 flex h-12 w-full items-center justify-center overflow-hidden rounded-2xl bg-primary font-display text-primary-foreground transition-[background-color,transform] duration-[var(--motion-fast)] ease-[var(--ease-standard)] hover:bg-accent active:translate-y-px",
                !compact && "xl:justify-start xl:gap-2.5 xl:px-4",
              )}
            />
          }
        >
          <span
            aria-hidden="true"
            className="absolute inset-y-0 right-0 -z-10 w-16 bg-secondary/35 [clip-path:polygon(38%_0,100%_0,100%_100%,0_100%)] transition-transform duration-[var(--motion-standard)] ease-[var(--ease-standard)] group-hover:translate-x-1"
          />
          <PenLine className="size-5" />
          <span className={cn(
            "hidden font-display text-[1.0625rem] font-bold tracking-[0.12em]",
            !compact && "xl:inline",
          )}>发布</span>
          <ChevronDown className={cn(
            "hidden size-4 transition-transform duration-[var(--motion-fast)] group-aria-expanded:rotate-180",
            !compact && "xl:ml-auto xl:block",
          )} />
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Positioner side="right" align="start" sideOffset={12} className="z-[80]">
            <Popover.Popup className="w-64 rounded-2xl bg-popover p-2 text-popover-foreground shadow-popover outline-none">
              <div className="px-3 pb-2 pt-2">
                <Popover.Title className="font-display text-base font-bold tracking-wide">选择发布方式</Popover.Title>
                <Popover.Description className="mt-0.5 text-xs text-muted-foreground">按内容长度选择合适的入口</Popover.Description>
              </div>
              <nav className="grid gap-1" aria-label="发布选项">
                <Link
                  href="/threads/create"
                  onClick={() => setMenuOpen(false)}
                  className="group/item flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                >
                  <FileText className="size-5 text-brand-strong" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-[0.9375rem] font-bold">发布主题帖</span>
                    <span className="block truncate text-xs text-muted-foreground">长内容、楼层与讨论</span>
                  </span>
                  <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover/item:translate-x-0.5" />
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setComposerOpen(true);
                  }}
                  className="group/item flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                >
                  <Images className="size-5 text-brand-strong" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-[0.9375rem] font-bold">发布动态</span>
                    <span className="block truncate text-xs text-muted-foreground">短文字与图片瀑布流</span>
                  </span>
                  <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover/item:translate-x-0.5" />
                </button>
              </nav>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>

      {composerOpen ? (
        <MomentComposer open userId={userId} onClose={() => setComposerOpen(false)} />
      ) : null}
    </>
  );
}

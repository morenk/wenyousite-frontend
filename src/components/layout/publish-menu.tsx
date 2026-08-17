/** 全站统一发布入口：用一枚“便笺折角”按钮承载主题帖与动态两种创作方式。 */

"use client";

import { Popover } from "@base-ui/react/popover";
import { NAVIGATION_ICONS, NAVIGATION_LABELS } from "@wenyousite/foundation/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useState } from "react";
import { WenyouIcon } from "@/components/ui/wenyou-icon";
import { cn } from "@/lib/utils";

const MomentComposer = dynamic(
  () => import("@/components/moment/moment-composer").then((module) => module.MomentComposer),
  { ssr: false },
);

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
              title={NAVIGATION_LABELS.publish}
              className={cn(
                "group relative isolate mt-5 flex h-12 w-full items-center justify-center overflow-hidden rounded-2xl bg-primary text-primary-foreground transition-[background-color,transform] duration-[var(--motion-fast)] ease-[var(--ease-standard)] hover:bg-accent active:translate-y-px",
                !compact && "xl:justify-start xl:gap-2.5 xl:px-4",
              )}
            />
          }
        >
          <span
            aria-hidden="true"
            className="absolute inset-y-0 right-0 -z-10 w-16 bg-secondary/35 [clip-path:polygon(38%_0,100%_0,100%_100%,0_100%)] transition-transform duration-[var(--motion-standard)] ease-[var(--ease-standard)] group-hover:translate-x-1"
          />
          <WenyouIcon id={NAVIGATION_ICONS.publish} className="size-5" />
          <span className={cn(
            "hidden text-[1.0625rem] font-semibold tracking-[0.12em]",
            !compact && "xl:inline",
          )}>{NAVIGATION_LABELS.publish}</span>
          <WenyouIcon id="navigation.expand" className={cn(
            "hidden size-4 transition-transform duration-[var(--motion-fast)] group-aria-expanded:rotate-180",
            !compact && "xl:ml-auto xl:block",
          )} />
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Positioner side="right" align="start" sideOffset={12} className="z-[var(--layer-popup)]">
            <Popover.Popup className="w-64 rounded-2xl bg-popover p-2 text-popover-foreground shadow-popover outline-none">
              <div className="px-3 pb-2 pt-2">
                <Popover.Title className="text-base font-semibold tracking-wide">选择发布方式</Popover.Title>
              </div>
              <nav className="grid gap-1" aria-label="发布选项">
                <Link
                  href="/threads/create"
                  onClick={() => setMenuOpen(false)}
                  className="group/item flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                >
                  <WenyouIcon id="status.file" className="size-5 text-brand-strong" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[0.9375rem] font-semibold">发布主题帖</span>
                  </span>
                  <WenyouIcon id="navigation.next" className="size-4 text-muted-foreground transition-transform group-hover/item:translate-x-0.5" />
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setComposerOpen(true);
                  }}
                  className="group/item flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                >
                  <WenyouIcon id="status.gallery" className="size-5 text-brand-strong" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[0.9375rem] font-semibold">发布动态</span>
                  </span>
                  <WenyouIcon id="navigation.next" className="size-4 text-muted-foreground transition-transform group-hover/item:translate-x-0.5" />
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

/** 主题帖次要信息与低频操作：避免排头长期承载统计面板。 */

"use client";

import { Popover } from "@base-ui/react/popover";
import {
  Ellipsis,
  Eye,
  Fuel,
  Link2,
  LogOut,
  MessageSquare,
  Settings,
  ShieldAlert,
  Users,
} from "lucide-react";
import { useState } from "react";

import type { ThreadDetail } from "@/api/hooks/use-thread-detail";
import { TopicTagLink } from "@/components/thread/topic-tag-link";
import { Button } from "@/components/ui/button";
import { formatWenyou } from "@/lib/wenyou";
import { cn } from "@/lib/utils";

interface ThreadDetailMoreProps {
  thread: ThreadDetail;
  onCopyLink?: () => void | Promise<void>;
  onExitPlayer?: () => void | Promise<void>;
  exitPlayerPending?: boolean;
  onManage?: () => void | Promise<void>;
  onModerate?: () => void;
}

const actionClassName =
  "flex min-h-10 w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium text-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/30";

function ThreadStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-lg bg-muted/45 px-3 py-2.5">
      <dt className="flex items-center gap-1.5 font-utility text-[11px] text-muted-foreground">
        {icon}
        {label}
      </dt>
      <dd className="mt-1 font-utility text-sm font-bold tabular-nums text-foreground">
        {value}
      </dd>
    </div>
  );
}

export function ThreadDetailMore({
  thread,
  onCopyLink,
  onExitPlayer,
  exitPlayerPending = false,
  onManage,
  onModerate,
}: ThreadDetailMoreProps) {
  const [open, setOpen] = useState(false);
  const hasActions = Boolean(onCopyLink || onExitPlayer || onManage || onModerate);

  const runAction = (action: () => void | Promise<void>) => {
    setOpen(false);
    void action();
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="更多帖子信息与操作"
            title="更多帖子信息与操作"
            className="rounded-lg text-muted-foreground hover:text-foreground"
          />
        }
      >
        <Ellipsis className="size-4" aria-hidden="true" />
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Positioner
          side="bottom"
          align="end"
          sideOffset={6}
          className="z-[var(--layer-popup)]"
        >
          <Popover.Popup className="w-[min(20rem,calc(100vw-2rem))] rounded-2xl border border-border bg-popover p-2 text-popover-foreground shadow-popover outline-none">
            <div className="px-2 pb-2 pt-1.5">
              <Popover.Title className="text-sm font-semibold">
                帖子信息
              </Popover.Title>
            </div>

            <dl aria-label="帖子统计" className="grid grid-cols-2 gap-1.5">
              <ThreadStat
                icon={<Eye className="size-3.5" aria-hidden="true" />}
                label="浏览"
                value={thread.viewCount}
              />
              <ThreadStat
                icon={<Users className="size-3.5" aria-hidden="true" />}
                label="玩家"
                value={thread._count.players}
              />
              <ThreadStat
                icon={<MessageSquare className="size-3.5" aria-hidden="true" />}
                label="楼层"
                value={thread._count.posts}
              />
              <ThreadStat
                icon={<Fuel className="size-3.5" aria-hidden="true" />}
                label="累计温油"
                value={formatWenyou(thread.tipTotal)}
              />
            </dl>

            {thread.topicTags.length > 0 ? (
              <div className="mt-2 border-t border-border px-2 pt-2.5">
                <p className="mb-2 font-utility text-[11px] text-muted-foreground">
                  主题标签
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {thread.topicTags.map(({ tag }) => (
                    <TopicTagLink key={tag.id} tag={tag} />
                  ))}
                </div>
              </div>
            ) : null}

            {hasActions ? (
              <div className="mt-2 border-t border-border pt-1.5">
                {onCopyLink ? (
                  <button
                    type="button"
                    className={actionClassName}
                    onClick={() => runAction(onCopyLink)}
                  >
                    <Link2 className="size-4" aria-hidden="true" />
                    复制主题帖链接
                  </button>
                ) : null}
                {onManage ? (
                  <button
                    type="button"
                    className={actionClassName}
                    onClick={() => runAction(onManage)}
                  >
                    <Settings className="size-4" aria-hidden="true" />
                    管理主题帖
                  </button>
                ) : null}
                {onExitPlayer ? (
                  <button
                    type="button"
                    className={actionClassName}
                    disabled={exitPlayerPending}
                    onClick={() => runAction(onExitPlayer)}
                  >
                    <LogOut className="size-4" aria-hidden="true" />
                    {exitPlayerPending ? "正在退出…" : "退出玩家身份"}
                  </button>
                ) : null}
                {onModerate ? (
                  <button
                    type="button"
                    className={cn(
                      actionClassName,
                      "text-destructive hover:bg-destructive-soft focus-visible:ring-destructive/30",
                    )}
                    onClick={() => runAction(onModerate)}
                  >
                    <ShieldAlert className="size-4" aria-hidden="true" />
                    站务隐藏主题帖
                  </button>
                ) : null}
              </div>
            ) : null}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

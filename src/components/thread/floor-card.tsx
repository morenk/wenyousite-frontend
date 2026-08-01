/** 楼层卡片组件：Markdown 渲染 + 作者信息 + 时间 */

"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { MarkdownContent } from "@/components/thread/markdown-content";
import type { PostData } from "@/api/hooks/use-floors";

interface FloorCardProps {
  floor: PostData;
  isEven: boolean;
}

export function FloorCard({ floor, isEven }: FloorCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border p-4",
        isEven ? "bg-muted/30" : "bg-card",
      )}
    >
      {/* 楼层头部 */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link
            href={`/users/${floor.authorId}`}
            className="text-sm font-medium text-foreground hover:text-primary"
          >
            {floor.author.username}
          </Link>
          {floor.floorNumber != null && (
            <span className="text-xs text-muted-foreground">
              #{floor.floorNumber}
            </span>
          )}
        </div>
        <span className="text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(floor.createdAt), {
            addSuffix: true,
            locale: zhCN,
          })}
        </span>
      </div>

      {/* 楼层正文 */}
      <MarkdownContent content={floor.content} />

      {/* 回复数 */}
      {floor._count.replies > 0 && (
        <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
          <MessageSquare className="h-3.5 w-3.5" />
          {floor._count.replies} 条回复
        </div>
      )}
    </div>
  );
}

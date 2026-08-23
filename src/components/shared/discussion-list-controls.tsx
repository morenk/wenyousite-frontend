"use client";

import type { ReplyOrder } from "@/api/reply-query";
import { ChronologicalOrderToggle } from "@/components/shared/chronological-order-toggle";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WenyouIcon } from "@/components/ui/wenyou-icon";
import { cn } from "@/lib/utils";

interface DiscussionListControlsProps {
  subject: "楼层" | "回复";
  order: ReplyOrder;
  onOrderChange: (order: ReplyOrder) => void;
  authorId?: string;
  onAuthorChange: (authorId?: string) => void;
  authors: DiscussionAuthorOption[];
  authorsLoading: boolean;
  authorsError: boolean;
  onRetryAuthors: () => void;
  className?: string;
}

export interface DiscussionAuthorOption {
  id: string;
  username: string;
  role: "OWNER" | "COLLABORATOR" | "PARTICIPANT";
}

function roleDetail(author: DiscussionAuthorOption) {
  if (author.role === "OWNER") return "楼主";
  if (author.role === "COLLABORATOR") return "协作者";
  return "玩家";
}

export function DiscussionListControls({
  subject,
  order,
  onOrderChange,
  authorId,
  onAuthorChange,
  authors,
  authorsLoading,
  authorsError,
  onRetryAuthors,
  className,
}: DiscussionListControlsProps) {
  const authorItems = [
    { value: "ALL", label: "全部玩家与管理者" },
    ...authors.map((author) => ({ value: author.id, label: author.username })),
  ];

  const authorControl = authors.length > 0 ? (
    <Select
      items={authorItems}
      value={authorId ?? "ALL"}
      onValueChange={(value) => onAuthorChange(!value || value === "ALL" ? undefined : value)}
    >
      <SelectTrigger
        size="compact"
        aria-label={`只看某人的${subject}`}
        className="min-w-44"
      >
        <WenyouIcon id="identity.member" className="size-3.5 text-muted-foreground" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end" className="min-w-52">
        <SelectItem value="ALL">全部玩家与管理者</SelectItem>
        {authors.map((author) => (
          <SelectItem key={author.id} value={author.id}>
            <span>{author.username}</span>
            <span className="font-utility text-[0.6875rem] text-muted-foreground">
              {roleDetail(author)}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  ) : authorsLoading ? (
    <Button variant="outline" size="compact" disabled aria-label={`正在加载${subject}作者`}>
      <WenyouIcon id="status.loading" className="animate-spin" />
      正在加载作者
    </Button>
  ) : authorsError ? (
    <Button variant="outline" size="compact" onClick={onRetryAuthors}>
      <WenyouIcon id="identity.member" className="size-3.5" />
      重新加载作者
    </Button>
  ) : (
    <Button variant="outline" size="compact" disabled aria-label={`当前${subject}暂无可筛选作者`}>
      <WenyouIcon id="identity.member" className="size-3.5" />
      暂无可筛选作者
    </Button>
  );

  return (
    <div
      role="group"
      aria-label={`${subject}列表筛选与排序`}
      className={cn("flex flex-wrap items-center justify-end gap-2", className)}
    >
      {authorControl}
      <ChronologicalOrderToggle
        order={order}
        onOrderChange={onOrderChange}
        accessibleName={`${subject}排序`}
      />
    </div>
  );
}

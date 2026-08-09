"use client";

import { ArrowDownUp, UserRound } from "lucide-react";
import type { ReplyOrder } from "@/api/reply-query";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface ReplyAuthorOption {
  id: string;
  username: string;
  detail?: string;
}

interface ReplyThreadControlsProps {
  order: ReplyOrder;
  onOrderChange: (order: ReplyOrder) => void;
  authorId?: string;
  onAuthorChange: (authorId?: string) => void;
  authors: ReplyAuthorOption[];
  authorScopeLabel?: string;
}

const orderItems = [
  { value: "OLDEST", label: "最早回复在前" },
  { value: "NEWEST", label: "最新回复在前" },
] as const;

export function ReplyThreadControls({
  order,
  onOrderChange,
  authorId,
  onAuthorChange,
  authors,
  authorScopeLabel = "全部回复者",
}: ReplyThreadControlsProps) {
  const authorItems = [
    { value: "ALL", label: authorScopeLabel },
    ...authors.map((author) => ({ value: author.id, label: author.username })),
  ];

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/80 bg-card/75 p-2">
      <span className="inline-flex h-8 items-center gap-1.5 px-1 font-utility text-xs font-bold tracking-wide text-muted-foreground">
        <ArrowDownUp className="size-3.5" />
        阅读方式
      </span>
      <Select
        items={orderItems}
        value={order}
        onValueChange={(value) => onOrderChange(value as ReplyOrder)}
      >
        <SelectTrigger size="compact" aria-label="回复排序" className="min-w-36 flex-1 sm:flex-none">
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="start">
          {orderItems.map((item) => (
            <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        items={authorItems}
        value={authorId ?? "ALL"}
        onValueChange={(value) => onAuthorChange(!value || value === "ALL" ? undefined : value)}
      >
        <SelectTrigger size="compact" aria-label="只看某人的回复" className="min-w-40 flex-1 sm:flex-none">
          <UserRound className="size-3.5 text-muted-foreground" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="start" className="min-w-52">
          <SelectItem value="ALL">{authorScopeLabel}</SelectItem>
          {authors.map((author) => (
            <SelectItem key={author.id} value={author.id}>
              <span>{author.username}</span>
              {author.detail ? (
                <span className="font-utility text-[0.6875rem] text-muted-foreground">
                  {author.detail}
                </span>
              ) : null}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

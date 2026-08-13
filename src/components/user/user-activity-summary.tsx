"use client";

import Link from "next/link";
import { FilePenLine, Images, MessageSquareText, UsersRound } from "lucide-react";
import { useUserActivitySummary } from "@/api/hooks/use-user-activity-summary";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const countFormatter = new Intl.NumberFormat("zh-CN");

export function UserActivitySummaryCard({ userId }: { userId: string }) {
  const { data, isLoading, isError, refetch } = useUserActivitySummary(userId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">创作概览</CardTitle>
        <CardDescription>公开内容与共同创作足迹</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="创作概览加载中">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-24 rounded-xl" />
            ))}
          </div>
        ) : isError || !data ? (
          <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center">
            <p className="text-sm text-muted-foreground">暂时无法加载创作概览</p>
            <Button
              type="button"
              variant="ghost"
              size="compact"
              className="mt-2"
              onClick={() => void refetch()}
            >
              重试
            </Button>
          </div>
        ) : (
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <SummaryMetric
              label="发布动态"
              hint="短内容"
              value={data.momentCount}
              href={`/users/${userId}/moments`}
              icon={Images}
            />
            <SummaryMetric
              label="创建主题"
              hint="担任楼主"
              value={data.createdThreadCount}
              href={`/users/${userId}/threads`}
              icon={FilePenLine}
            />
            <SummaryMetric
              label="参与主题"
              hint="玩家身份"
              value={data.playedThreadCount}
              href={data.playedThreadCount === null ? undefined : `/users/${userId}/threads`}
              icon={UsersRound}
            />
            <SummaryMetric
              label="累计回复"
              hint="楼层讨论"
              value={data.replyCount}
              href={data.replyCount === null ? undefined : "#recent-replies"}
              icon={MessageSquareText}
            />
          </dl>
        )}
      </CardContent>
    </Card>
  );
}

function SummaryMetric({
  label,
  hint,
  value,
  href,
  icon: Icon,
}: {
  label: string;
  hint: string;
  value: number | null;
  href?: string;
  icon: typeof Images;
}) {
  return (
    <div
      className={cn(
        "relative min-h-24 overflow-hidden rounded-xl bg-muted/55 p-3.5",
        href && "transition-colors has-[a:hover]:bg-accent/70",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <dt className="text-xs font-semibold text-muted-foreground">{label}</dt>
        <Icon className="size-4 text-brand-strong" aria-hidden="true" />
      </div>
      <dd
        className={cn(
          "mt-2 font-display font-bold text-foreground tabular-nums",
          value === null ? "text-sm" : "text-2xl",
        )}
      >
        {value === null ? "未公开" : countFormatter.format(value)}
      </dd>
      <p className="mt-0.5 text-[0.6875rem] text-muted-foreground">{hint}</p>
      {href ? (
        <Link
          href={href}
          aria-label={`查看${label}`}
          className="absolute inset-0 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/30"
        />
      ) : null}
    </div>
  );
}

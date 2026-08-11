"use client";

import { Activity, CircleGauge, Flag, ShieldAlert, UsersRound } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAdminDashboard } from "@/api/hooks/use-admin";
import { Badge } from "@/components/ui/badge";

const metricLabels = {
  activeUsers: "区间活跃用户",
  newUsers: "新增用户",
  publishedThreads: "新增主题",
  newPosts: "新增楼层",
  reportsReceived: "收到举报",
  reportsHandled: "完成处理",
} as const;

const serviceLabels: Record<string, string> = {
  database: "数据库",
  redis: "缓存服务",
  storage: "文件存储",
  queue: "任务队列",
};

export function AdminDashboardPanel() {
  const dashboard = useAdminDashboard();

  if (dashboard.isLoading) {
    return <p className="text-sm text-muted-foreground">正在汇总站务数据…</p>;
  }
  if (dashboard.isError || !dashboard.data) {
    return <p className="text-sm text-destructive">站务总览加载失败，请检查服务状态。</p>;
  }

  const { overview, timeseries, health } = dashboard.data;
  const healthItems = Object.entries(health.info ?? {});
  const current = overview.current;
  const reportPace = timeseries.items.map((item) => ({
    ...item,
    day: item.date.slice(5),
  }));

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-4 gap-4">
        <MetricCard icon={UsersRound} label="用户总数" value={overview.snapshot.totalUsers} />
        <MetricCard icon={Flag} label="待处理举报" value={overview.snapshot.pendingReports} tone="warning" />
        <MetricCard icon={ShieldAlert} label="生效中处罚" value={overview.snapshot.activeSuspensions + overview.snapshot.activeBans} tone="danger" />
        <MetricCard icon={Activity} label="今日活跃" value={overview.activity.dau} tone="success" />
      </section>

      <section className="grid grid-cols-[1.45fr_0.55fr] gap-5">
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-utility text-xs font-bold tracking-[0.12em] text-muted-foreground">近期活动</p>
              <h2 className="mt-1 font-display text-xl font-bold">近期待办与社区活动</h2>
            </div>
            <p className="text-xs text-muted-foreground">{overview.range.from} — {overview.range.to}</p>
          </div>
          <div className="mt-6 grid grid-cols-3 gap-x-6 gap-y-5">
            {Object.entries(metricLabels).map(([key, label]) => {
              const typedKey = key as keyof typeof metricLabels;
              const previous = overview.previous[typedKey];
              const delta = current[typedKey] - previous;
              return (
                <div key={key} className="border-l-2 border-border pl-4">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <div className="mt-1 flex items-baseline gap-2">
                    <strong className="font-display text-2xl">{current[typedKey]}</strong>
                    <span className={delta > 0 ? "text-xs text-success" : delta < 0 ? "text-xs text-muted-foreground" : "text-xs text-muted-foreground"}>
                      {delta > 0 ? "+" : ""}{delta} 较上期
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-success-soft text-success"><CircleGauge className="size-5" /></span>
            <div>
              <h2 className="font-display text-lg font-bold">服务状态</h2>
              <p className="text-xs text-muted-foreground">每分钟自动刷新</p>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            {healthItems.length ? healthItems.map(([name, item]) => (
              <div key={name} className="flex items-center justify-between rounded-lg bg-muted px-3 py-2.5 text-sm">
                <span className="font-utility">{serviceLabels[name] ?? "其他服务"}</span>
                <Badge tone={item.status === "up" ? "success" : "danger"}>{item.status === "up" ? "正常" : "异常"}</Badge>
              </div>
            )) : (
              <div className="flex items-center justify-between rounded-lg bg-muted px-3 py-2.5 text-sm">
                <span>接口服务</span><Badge tone={health.status === "ok" ? "success" : "danger"}>{health.status === "ok" ? "正常" : health.status ? "异常" : "未知"}</Badge>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="font-utility text-xs font-bold tracking-[0.12em] text-muted-foreground">处理节奏</p>
            <h2 className="mt-1 font-display text-xl font-bold">最近 {timeseries.items.length} 天举报处理节奏</h2>
          </div>
          <p className="text-xs text-muted-foreground">浅色：收到 · 深色：完成</p>
        </div>
        <div className="mt-6 h-56" role="img" aria-label="每日收到举报与完成处理数量的双柱趋势图">
          {reportPace.length > 0 ? <ResponsiveContainer width="100%" height="100%">
            <BarChart data={reportPace} margin={{ top: 8, right: 8, left: -20, bottom: 0 }} accessibilityLayer>
              <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 5" />
              <XAxis
                dataKey="day"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
                tickMargin={10}
              />
              <YAxis
                allowDecimals={false}
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
              />
              <Tooltip
                cursor={{ fill: "var(--muted)" }}
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "0.75rem",
                  color: "var(--foreground)",
                  fontSize: "0.75rem",
                }}
                labelStyle={{ color: "var(--muted-foreground)", marginBottom: "0.25rem" }}
              />
              <Bar dataKey="reportsReceived" name="收到举报" fill="var(--warning)" fillOpacity={0.35} radius={[4, 4, 0, 0]} />
              <Bar dataKey="reportsHandled" name="完成处理" fill="var(--primary)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer> : (
            <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
              当前区间没有举报处理数据
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  tone = "default",
}: {
  icon: typeof UsersRound;
  label: string;
  value: number;
  tone?: "default" | "warning" | "danger" | "success";
}) {
  const toneClass = {
    default: "bg-info-soft text-info",
    warning: "bg-warning-soft text-warning",
    danger: "bg-destructive-soft text-destructive",
    success: "bg-success-soft text-success",
  }[tone];
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <span className={`flex size-9 items-center justify-center rounded-lg ${toneClass}`}><Icon className="size-4" /></span>
      <p className="mt-5 text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-3xl font-bold">{value}</p>
    </div>
  );
}

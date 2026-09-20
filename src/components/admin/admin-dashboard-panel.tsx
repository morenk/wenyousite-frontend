"use client";

import Link from "next/link";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAdminDashboard, useAdminHealth } from "@/api/hooks/use-admin";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const metricLabels = {
  publishedThreads: "主题帖", newPosts: "楼层与回复", newMoments: "动态", newMomentComments: "动态评论",
} as const;
const serviceLabels: Record<string, string> = { database: "数据库", redis: "缓存", storage: "文件存储", queue: "任务队列" };
function dateRange(days: number) {
  const end = new Date(Date.now() + 8 * 3600_000);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - days + 1);
  return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
}

export function AdminDashboardPanel() {
  const [range, setRange] = useState(() => dateRange(30));
  const [draft, setDraft] = useState(range);
  const [trend, setTrend] = useState("users");
  const dashboard = useAdminDashboard(range);
  const health = useAdminHealth();
  const value = dashboard.data;
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center gap-2">
      {[7, 30].map((days) => <Button key={days} size="compact" variant="outline" onClick={() => { const next = dateRange(days); setRange(next); setDraft(next); }}>近 {days} 天</Button>)}
      <Input aria-label="开始日期" type="date" value={draft.from} className="h-8 w-40" onChange={(event) => setDraft({ ...draft, from: event.target.value })} />
      <span>至</span>
      <Input aria-label="结束日期" type="date" value={draft.to} className="h-8 w-40" onChange={(event) => setDraft({ ...draft, to: event.target.value })} />
      <Button size="compact" disabled={!draft.from || !draft.to || draft.from > draft.to || dashboard.isFetching} onClick={() => setRange(draft)}>查询</Button>
    </div>
    {dashboard.isLoading ? <p role="status" className="text-sm text-muted-foreground">正在读取统计…</p> : null}
    {dashboard.isError ? <p role="alert" className="text-sm text-destructive">统计加载失败 <Button size="compact" variant="ghost" onClick={() => void dashboard.refetch()}>重试</Button></p> : null}
    {value ? <>
      <section className="grid grid-cols-4 gap-3">
        <Metric label="用户总数" value={value.overview.snapshot.totalUsers} />
        <Metric label="活跃用户" value={value.overview.current.activeUsers} />
        <Metric label="新增用户" value={value.overview.current.newUsers} />
        <Metric label="新增内容" value={value.overview.current.publishedThreads + value.overview.current.newPosts + value.overview.current.newMoments + value.overview.current.newMomentComments} />
      </section>
      <section className="rounded-lg border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Select value={trend} onValueChange={(next) => setTrend(next ?? "users")}>
            <SelectTrigger aria-label="趋势" className="h-8 w-40"><SelectValue>{trend === "users" ? "用户活动" : "内容发布"}</SelectValue></SelectTrigger>
            <SelectContent><SelectItem value="users">用户活动</SelectItem><SelectItem value="content">内容发布</SelectItem></SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">{value.overview.range.from} — {value.overview.range.to} · 北京时间</span>
        </div>
        <div className="mt-3 h-64" role="img" aria-label={trend === "users" ? "用户活动趋势" : "内容发布趋势"}>
          {value.timeseries.items.length ? <ResponsiveContainer width="100%" height="100%">
            <BarChart data={value.timeseries.items} accessibilityLayer margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="date" tickFormatter={(date: string) => date.slice(5)} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }} />
              <Legend />
              {trend === "users" ? <>
                <Bar dataKey="dau" name="活跃用户" fill="var(--brand-strong)" />
                <Bar dataKey="newUsers" name="新增用户" fill="var(--info)" />
              </> : <>
                <Bar dataKey="publishedThreads" name="主题帖" fill="var(--brand-strong)" />
                <Bar dataKey="newPosts" name="楼层与回复" fill="var(--info)" />
                <Bar dataKey="newMoments" name="动态" fill="var(--success)" />
                <Bar dataKey="newMomentComments" name="动态评论" fill="var(--warning)" />
              </>}
            </BarChart>
          </ResponsiveContainer> : <p className="py-16 text-center text-sm text-muted-foreground">暂无数据</p>}
        </div>
        <div className="mt-3 flex flex-wrap gap-6 border-t border-border pt-3">
          {Object.entries(metricLabels).map(([key, label]) => <span key={key} className="text-sm">{label} <strong className="font-utility">{value.overview.current[key as keyof typeof metricLabels]}</strong></span>)}
        </div>
      </section>
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-4 py-2">
        <span className="text-sm font-semibold">待办</span>
        <Link href="/station/cases" className={buttonVariants({ size: "compact", variant: "ghost" })}>举报 {value.overview.snapshot.pendingReports}</Link>
        <Link href="/station/appeals" className={buttonVariants({ size: "compact", variant: "ghost" })}>申诉复核</Link>
      </div>
      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-3 text-base font-semibold">主题帖分类分布</h2>
        <div className="flex flex-wrap gap-4" aria-label="已发布主题分类分布">
          {value.distributions.threadsByCategory.map((item) => <div key={item.key} className="flex items-center gap-2 text-sm"><span>{item.name}</span>{!item.isActive ? <Badge tone="neutral">已停用</Badge> : null}<strong className="font-utility">{item.count}</strong></div>)}
          {!value.distributions.threadsByCategory.length ? <p className="text-sm text-muted-foreground">暂无数据</p> : null}
        </div>
      </section>
    </> : null}
    <section className="rounded-lg border border-border bg-card px-4 py-3">
      <h2 className="mb-2 text-base font-semibold">运行状态</h2>
      {health.isLoading ? <p className="text-sm text-muted-foreground">正在读取状态…</p> : health.isError ? <p role="alert" className="text-sm text-destructive">状态读取失败 <Button size="compact" variant="ghost" onClick={() => void health.refetch()}>重试</Button></p> : <div className="flex flex-wrap gap-4">
        {Object.entries(health.data?.info ?? {}).map(([name, item]) => <span key={name} className="flex items-center gap-2 text-sm">{serviceLabels[name] ?? "其他服务"}<Badge tone={item.status === "up" ? "success" : "danger"}>{item.status === "up" ? "正常" : "异常"}</Badge></span>)}
        {!Object.keys(health.data?.info ?? {}).length ? <Badge tone={health.data?.status === "ok" ? "success" : "danger"}>{health.data?.status === "ok" ? "正常" : "异常"}</Badge> : null}
      </div>}
    </section>
  </div>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-lg border border-border bg-card px-4 py-3"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 font-utility text-2xl font-semibold">{value}</p></div>;
}

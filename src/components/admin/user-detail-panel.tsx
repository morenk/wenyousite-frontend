"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAdminUserDetail } from "@/api/hooks/use-admin";
import { Button, buttonVariants } from "@/components/ui/button";
import { WenyouTime } from "@/components/shared/wenyou-time";
import { adminContentLabels } from "@/lib/admin-content-management";
import { safeAdminReturnTo } from "@/hooks/use-admin-list-return";
import { UserAccountState } from "./user-account-state";

export function UserDetailPanel({ id }: { id: string }) {
  const params = useSearchParams();
  const user = useAdminUserDetail(id);
  const data = user.isError ? undefined : user.data;
  const source = params.get("returnTo");
  const fromContent = source === "/station/content" || source?.startsWith("/station/content?");
  const returnTo = safeAdminReturnTo(source, fromContent ? "/station/content" : "/station/users");
  return <div className="space-y-4">
    <Link href={returnTo} className={buttonVariants({ variant: "outline", size: "compact" })}>{fromContent ? "返回内容列表" : "返回用户列表"}</Link>
    {user.isLoading ? <p role="status" className="text-sm text-muted-foreground">正在读取用户…</p> : null}
    {user.isError ? <p role="alert" className="text-sm text-destructive">用户加载失败 <Button size="compact" variant="ghost" onClick={() => void user.refetch()}>重试</Button></p> : null}
    {data ? <>
      <section className="rounded-[var(--radius-card)] border border-border bg-card p-4">
        <h2 className="mb-3 text-lg font-semibold">{data.username}</h2>
        <dl className="grid grid-cols-[7rem_minmax(0,1fr)_7rem_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
          <dt className="text-muted-foreground">用户编号</dt><dd className="break-all">{data.id}</dd>
          <dt className="text-muted-foreground">邮箱</dt><dd className="break-all">{data.email}</dd>
          <dt className="text-muted-foreground">等级</dt><dd>Lv.{data.level}</dd>
          <dt className="text-muted-foreground">角色</dt><dd>{data.role === "USER" ? "普通用户" : data.role === "ADMIN" ? "管理员" : "超级管理员"}</dd>
          <dt className="text-muted-foreground">注册时间</dt><dd><WenyouTime value={data.createdAt} /></dd>
          <dt className="text-muted-foreground">最近活跃日期</dt><dd>{data.lastActiveDate ?? "暂无记录"}</dd>
          <dt className="text-muted-foreground">个人简介</dt><dd className="col-span-3 whitespace-pre-wrap break-words">{data.bio || "未填写"}</dd>
        </dl>
      </section>
      <section className="rounded-[var(--radius-card)] border border-border bg-card p-4">
        <h2 className="mb-3 text-base font-semibold">关联内容</h2>
        <div className="flex flex-wrap gap-3">{Object.entries(adminContentLabels).map(([type, label]) => <Link key={type} href={`/station/content?type=${type}&authorId=${encodeURIComponent(id)}`} className={buttonVariants({ variant: "outline", size: "compact" })}>{label} {data.contentCounts[type as keyof typeof data.contentCounts]}</Link>)}</div>
      </section>
      <UserAccountState user={data} />
    </> : null}
  </div>;
}

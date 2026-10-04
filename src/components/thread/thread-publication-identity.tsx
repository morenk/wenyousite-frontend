"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ThreadIdentityControls } from "@/components/thread/thread-identity-controls";
import type { useThreadIdentitySubmission } from "@/components/thread/use-thread-identity-submission";
import { Button } from "@/components/ui/button";

export function ThreadPublicationIdentity({
  controller, threadId, disabled,
}: {
  controller: ReturnType<typeof useThreadIdentitySubmission>;
  threadId: string;
  disabled?: boolean;
}) {
  const { query, mode, choose, canUseRp, displayName } = controller;
  if (query.isPending) return <p role="status" className="text-xs text-muted-foreground">正在加载发言身份…</p>;
  if (query.isError) return <Button variant="ghost" type="button" size="sm" onClick={() => void query.refetch()}>身份加载失败，重试</Button>;
  const items = [
    { value: "RP", label: `帖内身份：${query.data?.display?.nickname ?? displayName ?? "当前不可用"}` },
    { value: "ACCOUNT", label: `站内身份：${query.data?.account.username ?? ""}` },
  ];
  return <div className="flex flex-wrap items-center gap-2">
    <Select value={mode} items={items} disabled={disabled} onValueChange={(value) => { if (value === "ACCOUNT" || value === "RP") choose(value); }}>
      <SelectTrigger size="compact" aria-label="发表身份" className="max-w-full"><SelectValue className="min-w-0 truncate" /></SelectTrigger>
      <SelectContent>
        {items.map((item) => <SelectItem key={item.value} value={item.value} disabled={item.value === "RP" && !canUseRp} className="[&>span]:min-w-0 [&>span]:shrink"><span className="min-w-0 truncate" title={item.label}>{item.label}</span></SelectItem>)}
      </SelectContent>
    </Select>
    <span className="min-w-0 truncate text-xs text-muted-foreground">以「{displayName}」发表</span>
    {!disabled && query.data?.canEdit ? <ThreadIdentityControls threadId={threadId} compact /> : null}
  </div>;
}

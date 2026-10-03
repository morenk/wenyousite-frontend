"use client";

import { useId } from "react";
import { AppDownloadError } from "@/lib/app-download";
import { Button } from "@/components/ui/button";
import { WenyouIcon } from "@/components/ui/wenyou-icon";
import { cn } from "@/lib/utils";
import { useAppDownloadContext } from "./app-download-context";

const unavailableMessages = {
  no_release: "暂无可下载版本，请稍后再试。",
  withdrawn: "此版本已撤回，请稍后再试。",
  paused: "下载已暂停，请稍后再试。",
  unavailable: "安装包暂不可用，请稍后再试。",
};

export function AppDownloadEntry({ variant = "menu", onAction }: {
  variant?: "menu" | "dialog";
  onAction?: () => void;
}) {
  const { query, phase, attempted, pending, waiting, fileError, handedOff, download, retry } = useAppDownloadContext();
  const statusId = useId();
  const isDialog = variant === "dialog";
  const retryInDialog = isDialog && attempted;
  const error = fileError || query.error;
  const info = query.data?.info;
  let message: string | undefined;
  if (!pending && attempted) {
    if (error instanceof AppDownloadError && error.status === 429) message = "下载请求较多，请稍后重试。";
    else if (error instanceof AppDownloadError && error.status === 409) message = "版本信息已变化，请重试下载。";
    else if (error) message = "暂时无法下载，请重试。";
    else if (info && info.status !== "available") message = unavailableMessages[info.status];
    else if (handedOff) message = "已交给浏览器下载，请在下载列表查看。若未开始，可重试下载。";
    if (waiting) message = `${message ?? "暂时无法下载。"}等待结束后可重试。`;
  }
  // 全局控件使用 font: inherit；菜单和对话框分别从局部容器继承文字层级。
  return <div data-slot="app-download-entry" className={cn("text-sm", isDialog ? "font-bold" : "mt-2 border-t border-border pt-1 font-normal")}>
    <Button type="button" variant={isDialog ? "default" : "ghost"}
      onClick={(event) => {
        // 原位切换为重试后，双击的后续 click 不代表再次传输的意图。
        if (isDialog && event.detail > 1) return;
        onAction?.();
        void (retryInDialog ? retry() : download());
      }}
      onKeyDown={(event) => {
        if (isDialog && event.repeat && (event.key === "Enter" || event.key === " ")) event.preventDefault();
      }} pending={pending}
      pendingLabel={phase === "preflight" ? "正在确认下载…" : "正在获取版本…"}
      disabled={waiting || (!isDialog && attempted)} aria-describedby={message ? statusId : undefined}
      className={cn("w-full", !isDialog && "justify-start gap-3 px-2.5 font-normal text-muted-foreground")}>
      <WenyouIcon id="action.download" className="size-4.5" />{retryInDialog ? "重试下载" : "下载 APP"}
    </Button>
    {message && <div className={cn("space-y-1 text-xs font-normal", isDialog ? "pt-3" : "px-2.5 pb-1 pt-2")}>
      <p id={statusId} role="status" aria-live="polite" className="text-xs leading-relaxed text-muted-foreground">{message}</p>
      {!isDialog && <Button type="button" variant="link" size="compact" onClick={() => { onAction?.(); void retry(); }} disabled={pending || waiting} className="h-auto min-h-8 px-0 text-xs">重试下载</Button>}
    </div>}
  </div>;
}

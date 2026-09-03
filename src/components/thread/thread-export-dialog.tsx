"use client";

import { Archive, Download, FileText, Link2, UserRound } from "lucide-react";
import { useState, type ChangeEvent } from "react";

import { getApiErrorMessage } from "@/api/errors";
import {
  useThreadExport,
  type ThreadExportOptions,
} from "@/api/hooks/use-thread-export";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogBackdrop,
  DialogClose,
  DialogCloseButton,
  DialogDescription,
  DialogFooter,
  DialogPopup,
  DialogPortal,
  DialogTitle,
  DialogViewport,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface ThreadExportDialogProps {
  threadId: string;
  threadTitle: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DEFAULT_OPTIONS: ThreadExportOptions = {
  includeAuthors: true,
  includeTimestamps: true,
  includeFloorNumbers: true,
  includeReplyTargets: true,
  includeSourceLinks: false,
  includeMedia: true,
};

const OPTIONS: Array<{
  key: keyof ThreadExportOptions;
  label: string;
  description: string;
  icon: typeof UserRound;
}> = [
  { key: "includeAuthors", label: "保留作者名", description: "让每一段发言保留署名。", icon: UserRound },
  { key: "includeTimestamps", label: "保留时间", description: "记录每段正文、楼层和回复的发布时间。", icon: FileText },
  { key: "includeFloorNumbers", label: "保留楼层号", description: "保留原主题中的楼层位置。", icon: Archive },
  { key: "includeReplyTargets", label: "保留回复目标", description: "标记回复针对的作者。", icon: UserRound },
  { key: "includeSourceLinks", label: "保留站内来源链接", description: "方便从档案回到温油站；邀请链接仍会脱敏。", icon: Link2 },
];

function OptionRow({
  option,
  checked,
  onChange,
}: {
  option: (typeof OPTIONS)[number];
  checked: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  const Icon = option.icon;
  return (
    <Label
      htmlFor={`thread-export-${option.key}`}
      className={cn(
        "cursor-pointer items-start rounded-xl border border-border/70 bg-background/40 px-3 py-3 transition-colors hover:bg-muted/45 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30",
        checked && "border-brand/30 bg-brand/5",
      )}
    >
      <input
        id={`thread-export-${option.key}`}
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="mt-0.5 size-4 shrink-0 accent-[var(--brand-strong)]"
      />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <Icon className="size-3.5 text-muted-foreground" aria-hidden="true" />
          {option.label}
        </span>
        <span className="mt-1 block text-xs leading-5 text-muted-foreground">
          {option.description}
        </span>
      </span>
    </Label>
  );
}

export function ThreadExportDialog({
  threadId,
  threadTitle,
  open,
  onOpenChange,
}: ThreadExportDialogProps) {
  const [options, setOptions] = useState(DEFAULT_OPTIONS);
  const exportMutation = useThreadExport();

  const setOption = (key: keyof ThreadExportOptions) => (event: ChangeEvent<HTMLInputElement>) => {
    setOptions((current) => ({ ...current, [key]: event.target.checked }));
  };

  const submit = async () => {
    try {
      const { blob, filename } = await exportMutation.mutateAsync({ threadId, options });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      onOpenChange(false);
    } catch {
      // 错误由弹窗内的提示呈现，保留选项以便用户重试。
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !exportMutation.isPending && onOpenChange(next)}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogViewport>
          <DialogPopup className="max-w-xl overflow-hidden">
            <div className="border-b border-border bg-muted/20 px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <DialogTitle className="flex items-center gap-2 font-display text-xl font-medium">
                    <Archive className="size-5 text-brand-strong" aria-hidden="true" />
                    导出主题档案
                  </DialogTitle>
                  <DialogDescription className="mt-1.5 line-clamp-2">
                    为“{threadTitle || "未命名主题帖"}”整理一份可本地留存的 Markdown + TXT ZIP。
                  </DialogDescription>
                </div>
                <DialogCloseButton label="关闭导出主题档案" disabled={exportMutation.isPending} />
              </div>
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                void submit();
              }}
              className="space-y-5 px-6 py-5"
            >
              <section className="rounded-xl border border-border bg-muted/35 px-4 py-3.5" aria-labelledby="thread-export-scope">
                <div className="flex items-start gap-3">
                  <FileText className="mt-0.5 size-4 text-muted-foreground" aria-hidden="true" />
                  <div>
                    <h2 id="thread-export-scope" className="text-sm font-semibold text-foreground">固定导出范围</h2>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">已发布主题帖的可见子贴正文、楼层与回复，按原顺序整理。</p>
                  </div>
                </div>
              </section>

              <fieldset className="space-y-2">
                <legend className="font-utility text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">档案信息</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {OPTIONS.map((option) => (
                    <OptionRow
                      key={option.key}
                      option={option}
                      checked={options[option.key]}
                      onChange={setOption(option.key)}
                    />
                  ))}
                </div>
              </fieldset>

              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-brand/20 bg-brand/5 px-3 py-3 hover:bg-brand/10 focus-within:ring-2 focus-within:ring-ring/30">
                <input
                  type="checkbox"
                  checked={options.includeMedia}
                  onChange={setOption("includeMedia")}
                  className="mt-0.5 size-4 shrink-0 accent-[var(--brand-strong)]"
                />
                <span>
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground"><Download className="size-3.5 text-brand-strong" aria-hidden="true" />打包站内图片与表情</span>
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">媒体会放入 ZIP 的 media/ 目录；外链图片不会被服务端抓取。</span>
                </span>
              </label>

              {exportMutation.error ? (
                <p role="alert" className="rounded-lg bg-destructive-soft px-3 py-2 text-sm text-destructive">
                  {getApiErrorMessage(exportMutation.error, "导出失败，请稍后重试。")}
                </p>
              ) : null}

              <DialogFooter className="-mx-6 -mb-5 border-t border-border bg-muted/20 px-6 py-4">
                <DialogClose
                  type="button"
                  disabled={exportMutation.isPending}
                  className={buttonVariants({ variant: "ghost", size: "compact" })}
                >
                  取消
                </DialogClose>
                <Button
                  type="submit"
                  size="compact"
                  pending={exportMutation.isPending}
                  pendingLabel="正在整理档案…"
                >
                  <Download className="size-4" aria-hidden="true" />
                  下载 ZIP
                </Button>
              </DialogFooter>
            </form>
          </DialogPopup>
        </DialogViewport>
      </DialogPortal>
    </Dialog>
  );
}

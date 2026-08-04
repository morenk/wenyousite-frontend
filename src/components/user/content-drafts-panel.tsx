/** 正文草稿面板：全局 5 槽位草稿池（楼层/回复内容暂存，与主题帖草稿隔离） */

"use client";

import { useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import {
  X,
  Trash2,
  RotateCcw,
  StickyNote,
  Loader2,
  Save,
  Inbox,
} from "lucide-react";
import { toast } from "sonner";
import { useContentDrafts, type DraftItem } from "@/api/hooks/use-content-drafts";
import { useDraftSlots } from "@/api/hooks/use-draft-slots";
import { useSaveDraft } from "@/api/hooks/use-save-draft";
import { useDeleteContentDraft } from "@/api/hooks/use-delete-content-draft";
import { Button } from "@/components/ui/button";

interface ContentDraftsPanelProps {
  open: boolean;
  onClose: () => void;
  /** 恢复草稿：把内容回填给调用方（楼层/回复编辑器）；缺省时复制到剪贴板 */
  onRestore?: (content: string) => void;
  /** 打开面板时的当前编辑器全文，所有手动保存操作直接使用该内容 */
  initialContent?: string;
  autoSaveEnabled?: boolean;
  autoSaveStatus?: "idle" | "saving" | "saved" | "error";
  onAutoSaveChange?: (enabled: boolean, version?: number) => void;
}

function getErrorMessage(error: unknown, fallback: string): string {
  const e = error as { message?: string };
  return e.message || fallback;
}

export function ContentDraftsPanel({
  open,
  onClose,
  onRestore,
  initialContent,
  autoSaveEnabled = false,
  autoSaveStatus = "idle",
  onAutoSaveChange,
}: ContentDraftsPanelProps) {
  const {
    data: drafts = [],
    isLoading,
    error,
    refetch,
  } = useContentDrafts();
  const { data: slots } = useDraftSlots();
  const saveDraft = useSaveDraft();
  const deleteDraft = useDeleteContentDraft();

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const usedSlots = slots?.usedSlots ?? 0;
  const maxSlots = slots?.maxSlots ?? 5;
  const draftBySlot = new Map(drafts.map((d) => [d.slot, d]));
  const currentContent = initialContent?.trim() ?? "";

  const handleRestore = (draft: DraftItem) => {
    const currentText = initialContent?.trim();
    if (
      onRestore &&
      currentText &&
      currentText !== draft.content.trim() &&
      !confirm("恢复草稿将覆盖当前编辑器内容，是否继续？")
    ) {
      return;
    }
    if (onRestore) {
      onRestore(draft.content);
      onClose();
      return;
    }
    navigator.clipboard
      ?.writeText(draft.content)
      .then(() => toast.success("正文草稿已复制，可粘贴到楼层/回复编辑器"))
      .catch(() => toast.error("复制失败，请手动复制"));
  };

  const handleDelete = async (draft: DraftItem) => {
    const deletingAutoSave = draft.slot === 1 && autoSaveEnabled;
    const message = deletingAutoSave
      ? "删除槽位 1 会同时关闭当前编辑器的自动保存，是否继续？"
      : "确定要删除这条正文草稿吗？删除后无法恢复。";
    if (!confirm(message)) return;
    try {
      await deleteDraft.mutateAsync(draft.id);
      if (deletingAutoSave) onAutoSaveChange?.(false);
      toast.success("正文草稿已删除");
    } catch (err) {
      toast.error(getErrorMessage(err, "删除失败，请稍后重试"));
    }
  };

  const handleSave = async (slot?: number) => {
    const text = currentContent;
    if (!text) return;
    const occupied = slot === undefined ? undefined : draftBySlot.get(slot);
    if (occupied && !confirm(`确定要覆盖槽位 ${slot} 的正文草稿吗？`)) return;
    try {
      await saveDraft.mutateAsync({
        content: text,
        ...(slot ? { slot } : {}),
        ...(occupied ? { version: occupied.version } : {}),
      });
      toast.success(occupied ? `已覆盖槽位 ${slot}` : "正文草稿已保存");
    } catch (err) {
      toast.error(getErrorMessage(err, "保存失败，请稍后重试"));
    }
  };

  const handleAutoSaveToggle = () => {
    const next = !autoSaveEnabled;
    if (
      next &&
      draftBySlot.has(1) &&
      !confirm("开启自动保存后，槽位 1 将由当前编辑器持续覆盖，是否继续？")
    ) {
      return;
    }
    onAutoSaveChange?.(next, next ? draftBySlot.get(1)?.version : undefined);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-label="正文草稿"
      onClick={onClose}
    >
      <div
        className="absolute right-0 top-0 flex h-full w-80 max-w-[85vw] flex-col border-l border-border bg-background shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-border px-4 py-3">
          <div>
            <h2 className="flex items-center gap-1.5 text-sm font-bold text-foreground">
              <StickyNote className="h-4 w-4 text-primary" />
              正文草稿
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              全局 {maxSlots} 槽位 · 楼层/回复内容暂存
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="关闭"
            className="rounded-md p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          <div className="mb-3 rounded-lg border border-border bg-muted/30 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-foreground">槽位 1 自动保存</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {autoSaveEnabled
                    ? autoSaveStatus === "saving"
                      ? "正在保存当前编辑器内容…"
                      : autoSaveStatus === "error"
                        ? "自动保存失败，将在下次编辑时重试"
                        : autoSaveStatus === "saved"
                          ? "当前内容已自动保存"
                          : "编辑后将自动更新到槽位 1"
                    : "开启后，当前编辑器全文会自动更新到槽位 1"}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={autoSaveEnabled}
                aria-label="槽位 1 自动保存"
                onClick={handleAutoSaveToggle}
                disabled={!onAutoSaveChange || isLoading}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                  autoSaveEnabled ? "bg-primary" : "bg-muted-foreground/30"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    autoSaveEnabled ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>
            <p className="mt-2 border-t border-border pt-2 text-[11px] text-muted-foreground">
              当前编辑器：{currentContent ? `${currentContent.length} 个字符` : "暂无内容"}
            </p>
          </div>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-3 py-12">
              <Inbox className="h-10 w-10 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">草稿加载失败</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                重试
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {Array.from({ length: maxSlots }, (_, i) => i + 1).map((slot) => {
                const draft = draftBySlot.get(slot);
                if (!draft) {
                  return (
                    <div
                      key={slot}
                      className="flex items-center justify-between rounded-lg border border-dashed border-border px-3 py-2.5"
                    >
                      <span className="text-xs text-muted-foreground">
                        槽位 {slot} 空闲
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => handleSave(slot)}
                        disabled={!currentContent || saveDraft.isPending}
                      >
                        保存到此处
                      </Button>
                    </div>
                  );
                }
                return (
                  <div
                    key={draft.id}
                    className="rounded-lg border border-border bg-card p-3"
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                        槽位 {slot}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {formatDistanceToNow(new Date(draft.updatedAt), {
                          addSuffix: true,
                          locale: zhCN,
                        })}
                      </span>
                    </div>
                    <p className="mb-2 line-clamp-3 whitespace-pre-wrap break-words text-xs text-foreground">
                      {draft.content}
                    </p>
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => handleRestore(draft)}
                      >
                        <RotateCcw className="mr-1 h-3 w-3" />
                        恢复
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => handleSave(slot)}
                        disabled={!currentContent || saveDraft.isPending}
                        aria-label={`覆盖槽位 ${slot}`}
                      >
                        <Save className="mr-1 h-3 w-3" />
                        覆盖
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                        onClick={() => handleDelete(draft)}
                        disabled={deleteDraft.isPending}
                        aria-label="删除草稿"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
          已用 {usedSlots}/{maxSlots} 槽位 · 点击槽位按钮直接保存当前编辑器全文
        </div>
      </div>
    </div>
  );
}

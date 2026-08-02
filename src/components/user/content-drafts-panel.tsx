/** 正文草稿面板：全局 5 槽位草稿池（楼层/回复内容暂存，与主题帖草稿隔离） */

"use client";

import { useEffect, useState } from "react";
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
  /** 打开时预填到「保存」输入框的内容（如当前编辑器正文），便于把正在写的内容存入草稿池 */
  initialContent?: string;
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
}: ContentDraftsPanelProps) {
  const [content, setContent] = useState(initialContent ?? "");
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

  const handleRestore = (draft: DraftItem) => {
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
    if (!confirm("确定要删除这条正文草稿吗？删除后无法恢复。")) return;
    try {
      await deleteDraft.mutateAsync(draft.id);
      toast.success("正文草稿已删除");
    } catch (err) {
      toast.error(getErrorMessage(err, "删除失败，请稍后重试"));
    }
  };

  const handleSave = async () => {
    const text = content.trim();
    if (!text) return;
    try {
      await saveDraft.mutateAsync({ content: text });
      setContent("");
      toast.success("正文草稿已保存");
    } catch (err) {
      toast.error(getErrorMessage(err, "保存失败，请稍后重试"));
    }
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

        <div className="border-t border-border p-3">
          <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              已用 {usedSlots}/{maxSlots} 槽位
            </span>
            <button
              className="text-primary hover:underline"
              onClick={() =>
                document.getElementById("draft-save-box")?.scrollIntoView({ behavior: "smooth" })
              }
            >
              保存新草稿
            </button>
          </div>
          <div id="draft-save-box" className="space-y-2">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="粘贴或输入楼层/回复内容，保存到草稿池…"
              rows={3}
              className="w-full resize-none rounded-lg border border-border bg-background px-2.5 py-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
            <Button
              size="sm"
              className="w-full"
              onClick={handleSave}
              disabled={!content.trim() || saveDraft.isPending}
            >
              {saveDraft.isPending ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="mr-1.5 h-3.5 w-3.5" />
              )}
              保存到草稿池
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

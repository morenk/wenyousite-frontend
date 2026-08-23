/** 正文草稿面板：全局 5 槽位草稿池（楼层/回复内容暂存，与主题帖草稿隔离） */

"use client";

import { useEffect } from "react";
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
import { getApiErrorMessage } from "@/api/errors";
import { Button } from "@/components/ui/button";
import { WenyouTime } from "@/components/shared/wenyou-time";
import { useConfirm } from "@/components/ui/confirm-provider";
import { parseInlineDiceNodes, replaceInlineDiceNodes } from "@/lib/dice-inline";

interface ContentDraftsPanelProps {
  open: boolean;
  onClose: () => void;
  /** 恢复草稿：把内容回填给调用方（楼层/回复编辑器）；缺省时复制到剪贴板 */
  onRestore?: (snapshot: EditorDraftSnapshot) => void;
  /** 当前编辑器全文；托盘打开期间继续编辑时，保存操作始终使用最新内容 */
  initialContent?: string;
  autoSaveEnabled?: boolean;
  autoSaveStatus?: "idle" | "saving" | "saved" | "error";
  onAutoSaveChange?: (
    enabled: boolean,
    draft?: Pick<DraftItem, "id" | "version">,
  ) => void;
}

export interface EditorDraftSnapshot {
  content: string;
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
  const confirmAction = useConfirm();

  useEffect(() => {
    if (!open) return;
    void refetch();
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    const onFocus = () => void refetch();
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("focus", onFocus);
    };
  }, [open, onClose, refetch]);

  if (!open) return null;

  const usedSlots = slots?.usedSlots ?? 0;
  const maxSlots = slots?.maxSlots ?? 5;
  const draftBySlot = new Map(drafts.map((d) => [d.slot, d]));
  const currentContent = initialContent ?? "";
  const currentDiceCount = parseInlineDiceNodes(currentContent).length;
  const hasCurrentSnapshot = currentContent.trim().length > 0;

  const handleRestore = async (draft: DraftItem) => {
    const currentText = initialContent ?? "";
    if (
      onRestore &&
      hasCurrentSnapshot &&
      currentText !== draft.content &&
      !(await confirmAction({
        title: "恢复正文草稿",
        description: "恢复草稿将覆盖当前编辑器内容，是否继续？",
        confirmLabel: "覆盖并恢复",
        destructive: true,
      }))
    ) {
      return;
    }
    if (onRestore) {
      onRestore({ content: draft.content });
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
      ? "删除草稿 1 还会关闭自动保存，是否继续？"
      : "确定要删除这条正文草稿吗？删除后无法恢复。";
    if (!(await confirmAction({
      title: "删除正文草稿",
      description: message,
      confirmLabel: "删除",
      destructive: true,
    }))) return;
    try {
      await deleteDraft.mutateAsync({ id: draft.id, version: draft.version });
      if (deletingAutoSave) onAutoSaveChange?.(false);
      toast.success("正文草稿已删除");
    } catch (err) {
      toast.error(getApiErrorMessage(err, "删除失败，请稍后重试"));
    }
  };

  const handleSave = async (slot?: number) => {
    const text = currentContent;
    if (!text.trim()) return;
    const occupied = slot === undefined ? undefined : draftBySlot.get(slot);
    if (occupied && !(await confirmAction({
      title: `覆盖草稿 ${slot}`,
      description: `这会替换草稿 ${slot} 的内容，是否继续？`,
      confirmLabel: "覆盖",
      destructive: true,
    }))) return;
    try {
      const savedDraft = await saveDraft.mutateAsync(
        occupied
          ? {
              draftId: occupied.id,
              content: text,
              version: occupied.version,
            }
          : {
              content: text,
              ...(slot ? { slot } : {}),
            },
      );
      if (slot === 1 && autoSaveEnabled) {
        onAutoSaveChange?.(true, {
          id: savedDraft.id,
          version: savedDraft.version,
        });
      }
      toast.success(occupied ? `草稿 ${slot} 已覆盖` : "正文草稿已保存");
    } catch (err) {
      toast.error(getApiErrorMessage(err, "保存失败，请稍后重试"));
    }
  };

  const handleAutoSaveToggle = async () => {
    const next = !autoSaveEnabled;
    const refreshed = next ? await refetch() : null;
    const freshSlotOne = (refreshed?.data ?? drafts).find((draft) => draft.slot === 1);
    if (
      next &&
      !!freshSlotOne &&
      !(await confirmAction({
        title: "开启自动保存",
        description: "开启后会用当前正文覆盖草稿 1，是否继续？",
        confirmLabel: "开启并覆盖",
      }))
    ) {
      return;
    }
    onAutoSaveChange?.(
      next,
      next && freshSlotOne
        ? { id: freshSlotOne.id, version: freshSlotOne.version }
        : undefined,
    );
  };

  return (
    <section
      data-slot="content-drafts-panel"
      className="border-t border-border bg-muted/20"
      role="region"
      aria-label="正文草稿"
    >
      <div className="flex items-start justify-between gap-3 px-3 py-2.5">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-brand-strong">
            <StickyNote className="size-4" />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-foreground">正文草稿</h2>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {usedSlots}/{maxSlots}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="收起正文草稿"
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="max-h-[min(22rem,52vh)] overflow-y-auto border-t border-border px-3 py-3 overscroll-contain">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2.5">
          <div className="min-w-0">
            <p className="text-xs font-medium text-foreground">自动保存到草稿 1</p>
            {autoSaveEnabled || autoSaveStatus === "error" ? (
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {autoSaveStatus === "error"
                  ? "保存失败，请重新开启"
                  : autoSaveStatus === "saving"
                    ? "保存中…"
                    : autoSaveStatus === "saved"
                      ? "已保存"
                      : "等待编辑"}
              </p>
            ) : null}
            <p className="mt-1 text-[11px] tabular-nums text-muted-foreground">
              {hasCurrentSnapshot ? `${currentContent.length} 字` : "正文为空"}
              {currentDiceCount > 0 ? ` · ${currentDiceCount} 个待掷骰子` : ""}
            </p>
          </div>
          <button
            type="button"
            data-slot="content-drafts-autosave-switch"
            role="switch"
            aria-checked={autoSaveEnabled}
            aria-label="自动保存到草稿 1"
            onClick={() => void handleAutoSaveToggle()}
            disabled={!onAutoSaveChange || isLoading}
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50 ${
              autoSaveEnabled ? "bg-primary" : "bg-muted-foreground/30"
            }`}
          >
            <span
              data-slot="content-drafts-autosave-thumb"
              aria-hidden="true"
              className={`pointer-events-none absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-card shadow transition-transform ${
                autoSaveEnabled ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-10">
            <Inbox className="h-9 w-9 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">草稿加载失败</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              重试
            </Button>
          </div>
        ) : (
          <ol className="grid gap-2 sm:grid-cols-2">
            {Array.from({ length: maxSlots }, (_, i) => i + 1).map((slot) => {
              const draft = draftBySlot.get(slot);
              if (!draft) {
                return (
                  <li
                    key={slot}
                    className="group flex min-h-20 items-center gap-3 rounded-lg border border-dashed border-border bg-background/60 px-3 py-2.5"
                  >
                    <span className="font-utility text-xl font-medium tabular-nums text-muted-foreground/45">
                      {String(slot).padStart(2, "0")}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted-foreground">未保存</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-1 h-7 px-0 text-xs hover:bg-transparent hover:text-brand-strong"
                        onClick={() => handleSave(slot)}
                        disabled={!hasCurrentSnapshot || saveDraft.isPending}
                      >
                        保存当前正文
                      </Button>
                    </div>
                  </li>
                );
              }
              return (
                <li
                  key={draft.id}
                  className="relative min-h-28 overflow-hidden rounded-lg border border-border bg-background px-3 py-2.5 pl-12"
                >
                  <span className="absolute inset-y-0 left-0 flex w-9 items-start justify-center border-r border-border bg-muted/35 pt-2.5 font-utility text-base font-medium tabular-nums text-brand-strong">
                    {String(slot).padStart(2, "0")}
                  </span>
                  <div className="flex items-center justify-end gap-2">
                    {slot === 1 && autoSaveEnabled ? (
                      <span className="text-[11px] font-medium text-muted-foreground">
                        自动保存
                      </span>
                    ) : null}
                    <WenyouTime value={draft.updatedAt} className="text-[11px] text-muted-foreground" />
                  </div>
                  <p className="mt-1 line-clamp-2 min-h-8 whitespace-pre-wrap break-words text-xs leading-4 text-foreground">
                    {replaceInlineDiceNodes(draft.content, (node) => `${node.notation} = ?`) || "（无正文）"}
                  </p>
                  <div className="mt-2 flex items-center gap-1">
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
                      disabled={!hasCurrentSnapshot || saveDraft.isPending}
                      aria-label={`覆盖草稿 ${slot}`}
                    >
                      <Save className="mr-1 h-3 w-3" />
                      覆盖
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-auto h-7 px-2 text-xs text-destructive hover:text-destructive"
                      onClick={() => handleDelete(draft)}
                      disabled={deleteDraft.isPending}
                      aria-label="删除草稿"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
}

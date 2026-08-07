"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, GripVertical, Images, Loader2, Settings2, SmilePlus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/api/errors";
import { useStickerActions, useStickers, type UserSticker } from "@/api/hooks/use-stickers";
import { getKnownUserId } from "@/lib/auth-store";
import { uploadImageFile, validateImageFile } from "@/lib/upload-image";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface StickerPickerPopoverProps {
  onSelect: (sticker: UserSticker) => Promise<unknown> | unknown;
  disabled?: boolean;
  align?: "start" | "end";
  label?: string;
}

interface TileProps {
  sticker: UserSticker;
  managing: boolean;
  selected: boolean;
  busy: boolean;
  onClick: () => void;
}

function StickerImage({ sticker }: { sticker: UserSticker }) {
  const [active, setActive] = useState(false);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={active && sticker.asset.animated ? sticker.asset.url : sticker.asset.thumbnailUrl}
      alt="收藏表情"
      draggable={false}
      loading="lazy"
      decoding="async"
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => setActive(false)}
      onFocus={() => setActive(true)}
      onBlur={() => setActive(false)}
      className="h-full w-full object-contain"
    />
  );
}

function SortableStickerTile(props: TileProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.sticker.id,
    disabled: !props.managing,
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("relative aspect-square", isDragging && "z-10 opacity-60")}
    >
      <button
        type="button"
        onClick={props.onClick}
        disabled={props.busy}
        aria-label={props.managing ? "选择收藏表情" : "使用收藏表情"}
        className={cn(
          "h-full w-full rounded-lg border border-transparent bg-muted/40 p-1.5 hover:border-primary/40 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
          props.selected && "border-primary bg-primary/10",
        )}
      >
        <StickerImage sticker={props.sticker} />
      </button>
      {props.managing && (
        <button
          type="button"
          aria-label="拖动排序"
          className="absolute left-0.5 top-0.5 cursor-grab rounded bg-background/90 p-0.5 text-muted-foreground shadow active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-3 w-3" />
        </button>
      )}
      {props.selected && (
        <span className="pointer-events-none absolute right-1 top-1 rounded-full bg-primary p-0.5 text-primary-foreground">
          <Check className="h-3 w-3" />
        </span>
      )}
    </div>
  );
}

async function runWithConcurrency<T>(tasks: Array<() => Promise<T>>, concurrency: number) {
  const results: Array<PromiseSettledResult<T>> = new Array(tasks.length);
  let cursor = 0;
  const worker = async () => {
    for (;;) {
      const index = cursor++;
      if (index >= tasks.length) return;
      try {
        results[index] = { status: "fulfilled", value: await tasks[index]() };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, worker));
  return results;
}

function StickerPickerPanel({
  onSelect,
  align = "start",
  onClose,
}: Pick<StickerPickerPopoverProps, "onSelect" | "align"> & { onClose: () => void }) {
  const userId = getKnownUserId() ?? undefined;
  const query = useStickers(userId);
  const actions = useStickerActions(userId);
  const [tab, setTab] = useState<"recent" | "favorites">("favorites");
  const [managing, setManaging] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [orderOverride, setOrderOverride] = useState<{
    version: number;
    items: UserSticker[];
  } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const ordered = useMemo(
    () => orderOverride && orderOverride.version === query.data?.version
      ? orderOverride.items
      : query.data?.items ?? [],
    [orderOverride, query.data?.items, query.data?.version],
  );
  const shown = useMemo(
    () => (tab === "recent" && !managing ? query.data?.recent ?? [] : ordered),
    [managing, ordered, query.data?.recent, tab],
  );

  const handleSelect = async (sticker: UserSticker) => {
    if (managing) {
      setSelected((current) => {
        const next = new Set(current);
        if (next.has(sticker.id)) next.delete(sticker.id);
        else next.add(sticker.id);
        return next;
      });
      return;
    }
    setBusyId(sticker.id);
    try {
      await onSelect(sticker);
      onClose();
      await actions.refresh();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "使用表情失败"));
    } finally {
      setBusyId(null);
    }
  };

  const handleDragEnd = async ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id || !query.data) return;
    const oldIndex = ordered.findIndex((item) => item.id === active.id);
    const newIndex = ordered.findIndex((item) => item.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(ordered, oldIndex, newIndex);
    setOrderOverride({ version: query.data.version, items: next });
    try {
      await actions.reorder.mutateAsync({
        version: query.data.version,
        favoriteIds: next.map((item) => item.id),
      });
    } catch (error) {
      setOrderOverride(null);
      toast.error(getApiErrorMessage(error, "排序失败，请刷新后重试"));
    }
  };

  const handleDelete = async () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    try {
      for (const id of ids) await actions.remove.mutateAsync(id);
      setSelected(new Set());
      toast.success(`已移除 ${ids.length} 个表情`);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "部分表情移除失败"));
      await actions.refresh();
    }
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const candidates = [...files].slice(0, 10);
    const invalid = candidates.find((file) => validateImageFile(file));
    if (invalid) {
      toast.error(validateImageFile(invalid)!);
      return;
    }
    setUploading(true);
    const results = await runWithConcurrency(
      candidates.map((file) => async () => {
        const uploaded = await uploadImageFile(file);
        return actions.importMedia.mutateAsync(uploaded.mediaId);
      }),
      3,
    );
    const succeeded = results.filter((result) => result.status === "fulfilled").length;
    const failed = results.length - succeeded;
    if (succeeded) toast.success(`已添加 ${succeeded} 个表情`);
    if (failed) toast.error(`${failed} 个表情添加失败，成功项已保留`);
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
    await actions.refresh();
  };

  return (
        <div
          role="dialog"
          aria-label="表情收藏"
          className={cn(
            "absolute bottom-full z-50 mb-2 w-[min(22rem,calc(100vw-1rem))] rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-xl",
            align === "end" ? "right-0" : "left-0",
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex rounded-lg bg-muted p-0.5">
              <button
                type="button"
                onClick={() => { setTab("recent"); setManaging(false); }}
                className={cn("rounded-md px-3 py-1 text-xs", tab === "recent" && !managing && "bg-background shadow")}
              >
                最近
              </button>
              <button
                type="button"
                onClick={() => setTab("favorites")}
                className={cn("rounded-md px-3 py-1 text-xs", (tab === "favorites" || managing) && "bg-background shadow")}
              >
                收藏 {query.data ? `${query.data.items.length}/${query.data.limit}` : ""}
              </button>
            </div>
            <div className="flex items-center gap-1">
              <input
                ref={fileRef}
                type="file"
                multiple
                accept="image/jpeg,image/png,image/gif,image/webp,image/avif"
                className="hidden"
                onChange={(event) => void handleFiles(event.target.files)}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                title="批量添加（最多 10 张）"
                disabled={uploading || (query.data?.items.length ?? 0) >= (query.data?.limit ?? 200)}
                onClick={() => fileRef.current?.click()}
              >
                {uploading ? <Loader2 className="animate-spin" /> : <Upload />}
              </Button>
              <Button
                type="button"
                variant={managing ? "secondary" : "ghost"}
                size="icon-sm"
                title="管理收藏"
                onClick={() => {
                  setManaging((value) => !value);
                  setTab("favorites");
                  setSelected(new Set());
                }}
              >
                <Settings2 />
              </Button>
            </div>
          </div>

          <div className="mt-3 max-h-72 min-h-36 overflow-y-auto">
            {query.isLoading ? (
              <div className="flex h-36 items-center justify-center text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : query.isError ? (
              <button type="button" className="h-36 w-full text-sm text-muted-foreground" onClick={() => query.refetch()}>
                加载失败，点击重试
              </button>
            ) : shown.length === 0 ? (
              <div className="flex h-36 flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
                <Images className="h-7 w-7" />
                {tab === "recent" ? "发送过的表情会显示在这里" : "上传图片或收藏站内图片来添加表情"}
              </div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={shown.map((item) => item.id)} strategy={rectSortingStrategy}>
                  <div className="grid grid-cols-5 gap-1.5">
                    {shown.map((sticker) => (
                      <SortableStickerTile
                        key={sticker.id}
                        sticker={sticker}
                        managing={managing}
                        selected={selected.has(sticker.id)}
                        busy={busyId === sticker.id}
                        onClick={() => void handleSelect(sticker)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>

          {!!query.data?.pendingImports.length && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              正在处理 {query.data.pendingImports.length} 个表情…
            </p>
          )}
          {managing && (
            <div className="mt-3 flex items-center justify-between border-t border-border pt-2">
              <span className="text-xs text-muted-foreground">拖动可排序，已选 {selected.size} 个</span>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={!selected.size || actions.remove.isPending}
                onClick={() => void handleDelete()}
              >
                <Trash2 />
                移除
              </Button>
            </div>
          )}
        </div>
  );
}

export function StickerPickerPopover({
  onSelect,
  disabled = false,
  align = "start",
  label = "表情",
}: StickerPickerPopoverProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  return (
    <div ref={rootRef} className="relative inline-flex">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <SmilePlus className="h-4 w-4" />
        {label}
      </Button>
      {open && (
        <StickerPickerPanel
          onSelect={onSelect}
          align={align}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

/** 管理工作台章节目录：真实顺序编号、鼠标/键盘排序与低噪音操作。 */

"use client";

import { useCallback } from "react";
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
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { POSTING_POLICY_LABEL } from "@/lib/post-policy";
import type { SubthreadDetail } from "@/api/hooks/use-thread-detail";

interface SubthreadTreeNodeProps {
  subthread: SubthreadDetail;
  index: number;
  isSelected: boolean;
  disabled: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

function SubthreadTreeNode({
  subthread,
  index,
  isSelected,
  disabled,
  onSelect,
  onDelete,
}: SubthreadTreeNodeProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: subthread.id, disabled });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      data-selected={isSelected ? "true" : "false"}
      className={cn(
        "group relative flex min-h-14 items-center gap-1 rounded-xl border border-transparent px-1.5 transition-[background-color,border-color,box-shadow] duration-[var(--motion-fast)]",
        "before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:origin-center before:rounded-full before:bg-brand-strong before:transition-transform",
        isSelected
          ? "border-border bg-card shadow-sm before:scale-y-100"
          : "hover:bg-card/70 before:scale-y-0",
        isDragging && "z-10 border-border bg-card shadow-popover",
      )}
    >
      <button
        type="button"
        className="flex size-8 shrink-0 touch-none items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/30 disabled:pointer-events-none"
        aria-label={`拖动子贴「${subthread.title}」排序`}
        title="拖拽或使用键盘排序"
        disabled={disabled}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>

      <button
        type="button"
        onClick={onSelect}
        disabled={disabled}
        aria-label={`选择子贴「${subthread.title}」`}
        aria-current={isSelected ? "page" : undefined}
        className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:pointer-events-none"
      >
        <span className="w-6 shrink-0 font-utility text-[0.6875rem] font-bold tabular-nums text-muted-foreground">
          {String(index + 1).padStart(2, "0")}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-foreground">
            {subthread.title}
          </span>
          <span className="mt-0.5 flex items-center gap-1.5 font-utility text-[0.6875rem] leading-4 text-muted-foreground">
            <span>{POSTING_POLICY_LABEL[subthread.postingPolicy] ?? subthread.postingPolicy}</span>
            <span aria-hidden="true">·</span>
            <span>{subthread._count.posts} 楼</span>
          </span>
        </span>
      </button>

      <button
        type="button"
        onClick={onDelete}
        disabled={disabled}
        aria-label={`删除子贴「${subthread.title}」`}
        title="删除子贴"
        className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground opacity-0 outline-none transition-[background-color,color,opacity] group-hover:opacity-100 focus:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/30 hover:bg-destructive-soft hover:text-destructive disabled:pointer-events-none"
      >
        <Trash2 className="size-4" />
      </button>
    </div>
  );
}

interface SubthreadTreeProps {
  subthreads: SubthreadDetail[];
  selectedId?: string;
  disabled?: boolean;
  onSelect: (id: string) => void;
  onDelete: (subthread: SubthreadDetail) => void;
  onReorder: (ids: string[]) => void;
  onCreate: () => void;
}

export function getReorderedSubthreadIds(
  subthreads: SubthreadDetail[],
  activeId: string | number,
  overId: string | number | null,
) {
  if (overId === null || activeId === overId) return null;
  const oldIndex = subthreads.findIndex((subthread) => subthread.id === activeId);
  const newIndex = subthreads.findIndex((subthread) => subthread.id === overId);
  if (oldIndex === -1 || newIndex === -1) return null;
  return arrayMove(subthreads, oldIndex, newIndex).map((subthread) => subthread.id);
}

export function SubthreadTree({
  subthreads,
  selectedId,
  disabled = false,
  onSelect,
  onDelete,
  onReorder,
  onCreate,
}: SubthreadTreeProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      const ids = getReorderedSubthreadIds(subthreads, active.id, over?.id ?? null);
      if (ids) onReorder(ids);
    },
    [onReorder, subthreads],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 space-y-1 overflow-y-auto p-2">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={subthreads.map((subthread) => subthread.id)}
            strategy={verticalListSortingStrategy}
          >
            {subthreads.map((subthread, index) => (
              <SubthreadTreeNode
                key={subthread.id}
                subthread={subthread}
                index={index}
                isSelected={selectedId === subthread.id}
                disabled={disabled}
                onSelect={() => onSelect(subthread.id)}
                onDelete={() => onDelete(subthread)}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>

      <div className="border-t border-border p-2">
        <button
          type="button"
          onClick={onCreate}
          disabled={disabled}
          className="flex min-h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border text-sm font-semibold text-muted-foreground outline-none transition-colors hover:border-brand-strong/35 hover:bg-card hover:text-brand-strong focus-visible:ring-2 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:bg-muted"
        >
          <Plus className="size-4" />
          添加子贴
        </button>
      </div>
    </div>
  );
}

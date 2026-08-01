/** SubthreadTree：管理面板左栏子贴目录树（支持拖拽排序） */

"use client";

import { useCallback } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { computeReorderedIds } from "@/lib/reorder";
import type { SubthreadDetail } from "@/api/hooks/use-thread-detail";

const POSTING_POLICY_LABEL: Record<string, string> = {
  PARTICIPANTS: "参与人",
  COLLABORATORS: "协作者",
  PLAYERS: "玩家",
};

interface SubthreadTreeNodeProps {
  subthread: SubthreadDetail;
  isDefault: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function SubthreadTreeNode({
  subthread,
  isDefault,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
}: SubthreadTreeNodeProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: subthread.id, disabled: isDefault });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex cursor-pointer select-none items-center gap-1.5 rounded-lg px-2 py-2 text-sm",
        isSelected
          ? "bg-primary/10 text-foreground"
          : "text-foreground hover:bg-muted",
        isDragging && "relative z-10 shadow-md",
      )}
      onClick={onSelect}
    >
      <button
        type="button"
        className="shrink-0 touch-none text-muted-foreground hover:text-foreground"
        title="拖拽排序"
        onClick={(e) => e.stopPropagation()}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>

      <span className="min-w-0 flex-1 truncate">
        {subthread.title}
        {isDefault && (
          <span className="ml-1.5 rounded bg-primary/10 px-1 py-0.5 text-xs text-primary">
            主帖
          </span>
        )}
      </span>

      <span className="shrink-0 text-xs text-muted-foreground">
        {POSTING_POLICY_LABEL[subthread.postingPolicy] ?? subthread.postingPolicy}
      </span>

      <div className="flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          title="编辑子贴"
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        {!isDefault && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            title="删除子贴"
            className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

interface SubthreadTreeProps {
  subthreads: SubthreadDetail[];
  defaultSubthreadId: string;
  selectedId?: string;
  onSelect: (id: string) => void;
  onEdit: (subthread: SubthreadDetail) => void;
  onDelete: (subthread: SubthreadDetail) => void;
  onReorder: (ids: string[]) => void;
  onCreate: () => void;
}

export function SubthreadTree({
  subthreads,
  defaultSubthreadId,
  selectedId,
  onSelect,
  onEdit,
  onDelete,
  onReorder,
  onCreate,
}: SubthreadTreeProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const reordered = computeReorderedIds(
        subthreads.map((s) => s.id),
        String(active.id),
        String(over.id),
        defaultSubthreadId,
      );
      if (!reordered) {
        toast.error("主帖必须保持在第一位，不能与其他子帖交换顺序");
        return;
      }
      onReorder(reordered);
    },
    [subthreads, defaultSubthreadId, onReorder],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto space-y-0.5 p-2">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={subthreads.map((s) => s.id)}
            strategy={verticalListSortingStrategy}
          >
            {subthreads.map((sub) => (
              <SubthreadTreeNode
                key={sub.id}
                subthread={sub}
                isDefault={sub.id === defaultSubthreadId}
                isSelected={selectedId === sub.id}
                onSelect={() => onSelect(sub.id)}
                onEdit={() => onEdit(sub)}
                onDelete={() => onDelete(sub)}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>

      <div className="border-t border-border p-2">
        <button
          type="button"
          onClick={onCreate}
          className="flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-border py-2 text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          添加子贴
        </button>
      </div>
    </div>
  );
}

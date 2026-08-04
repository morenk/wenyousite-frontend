/** 子贴列表容器：渲染子贴卡片列表 + 添加/编辑/删除操作 */

"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SubthreadCard } from "@/components/thread/subthread-card";
import { SubthreadForm, type SubthreadFormData } from "@/components/forms/subthread-form";
import type { SubthreadDetail } from "@/api/hooks/use-thread-detail";

interface SubthreadListProps {
  subthreads: SubthreadDetail[];
  defaultSubthreadId: string;
  /** 是否显示操作按钮（编辑/删除/添加）。草稿/OWNER 时启用 */
  showActions?: boolean;
  isSubmitting?: boolean;
  onCreate?: (data: SubthreadFormData) => void | Promise<void>;
  onUpdate?: (subthreadId: string, data: SubthreadFormData) => void | Promise<void>;
  onDelete?: (subthreadId: string) => void;
  /** 展开的子贴渲染其楼层内容 */
  renderFloors?: (subthread: SubthreadDetail) => React.ReactNode;
}

type FormMode = { mode: "create" } | {
  mode: "edit";
  subthreadId: string;
  defaultValues: SubthreadFormData;
};

export function SubthreadList({
  subthreads,
  defaultSubthreadId,
  showActions = false,
  isSubmitting = false,
  onCreate,
  onUpdate,
  onDelete,
  renderFloors,
}: SubthreadListProps) {
  const [formMode, setFormMode] = useState<FormMode | null>(null);

  async function handleCreate(data: SubthreadFormData) {
    await onCreate?.(data);
    setFormMode(null);
  }

  async function handleUpdate(data: SubthreadFormData) {
    if (formMode?.mode === "edit") {
      await onUpdate?.(formMode.subthreadId, data);
    }
    setFormMode(null);
  }

  function handleDelete(subthreadId: string) {
    if (confirm("确定要删除该子贴吗？子贴及其所有楼层将被删除。")) {
      onDelete?.(subthreadId);
    }
  }

  return (
    <div className="space-y-2">
      {subthreads.map((sub, index) => (
        <SubthreadCard
          key={sub.id}
          subthread={sub}
          isDefault={sub.id === defaultSubthreadId}
          showActions={showActions}
          defaultExpanded={index === 0}
          onEdit={() =>
            setFormMode({
              mode: "edit",
              subthreadId: sub.id,
              defaultValues: {
                title: sub.title,
                postingPolicy: sub.postingPolicy,
                tagNames: sub.tags.map(({ tag }) => tag.name),
              },
            })
          }
          onDelete={() => handleDelete(sub.id)}
        >
          {renderFloors?.(sub)}
        </SubthreadCard>
      ))}

      {showActions && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => setFormMode({ mode: "create" })}
          disabled={isSubmitting}
        >
          <Plus className="mr-1.5 h-4 w-4" />
          添加子贴
        </Button>
      )}

      {formMode && (
        <SubthreadForm
          mode={formMode.mode}
          defaultValues={formMode.mode === "edit" ? formMode.defaultValues : undefined}
          isSubmitting={isSubmitting}
          onSubmit={formMode.mode === "create" ? handleCreate : handleUpdate}
          onCancel={() => setFormMode(null)}
        />
      )}
    </div>
  );
}

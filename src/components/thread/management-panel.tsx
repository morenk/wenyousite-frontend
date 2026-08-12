/** ManagementPanel：帖主管理面板 — 左子贴目录树 + 右单例编辑器 + 成员管理 */

"use client";

import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MilkdownEditor } from "@/components/editor/milkdown-editor";
import { SubthreadTree } from "@/components/thread/subthread-tree";
import { MemberManager } from "@/components/thread/member-manager";
import { ThreadEditForm } from "@/components/forms/thread-edit-form";
import { SubthreadForm } from "@/components/forms/subthread-form";
import { POSTING_POLICY_LABEL } from "@/lib/post-policy";
import type { ThreadDetail } from "@/api/hooks/use-thread-detail";
import {
  useManagementPanelController,
  type ManagementView,
} from "@/components/thread/use-management-panel-controller";

interface ManagementPanelProps {
  thread: ThreadDetail;
  onExit: () => void;
  onRefetch: () => Promise<unknown>;
  initialView?: ManagementView;
}

export type { ManagementView } from "@/components/thread/use-management-panel-controller";

export function ManagementPanel({
  thread,
  onExit,
  onRefetch,
  initialView = "thread",
}: ManagementPanelProps) {
  const controller = useManagementPanelController({
    thread,
    initialView,
    onExit,
    onRefetch,
  });

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ManagementToolbar
        title={thread.title}
        view={controller.view}
        disabled={controller.isNavigationLocked}
        onExit={() => void controller.handleExit()}
        onViewChange={(view) => void controller.handleViewChange(view)}
      />

      {controller.view === "thread" && (
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="mx-auto max-w-4xl">
            <ThreadEditForm
              thread={thread}
              isOwner={controller.isOwner}
              onDirtyChange={controller.setThreadDirty}
              onSavingChange={controller.setThreadSaving}
            />
          </div>
        </div>
      )}

      {controller.view === "members" && (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <MemberManager
            threadId={thread.id}
            isOwner={controller.isOwner}
            isCollaborator={controller.isCollaborator}
          />
        </div>
      )}

      {controller.view === "subthreads" && (
        <div className="flex min-h-0 flex-1">
          <aside className="flex min-h-0 w-64 shrink-0 flex-col border-r border-border bg-muted/30">
            <div className="px-3 pb-1 pt-3 text-xs font-medium text-muted-foreground">
              子贴目录
            </div>
            <SubthreadTree
              subthreads={controller.subthreads}
              selectedId={controller.selectedId}
              onSelect={(id) => void controller.handleSelect(id)}
              onEdit={(sub) => controller.setSubFormMode({ mode: "edit", sub })}
              onDelete={(sub) => void controller.handleDeleteSubthread(sub)}
              onReorder={(ids) => void controller.handleReorder(ids)}
              onCreate={() => controller.setSubFormMode({ mode: "create" })}
            />
          </aside>

          <section className="flex min-w-0 flex-1 flex-col p-4">
            {controller.selectedSub ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    正在编辑：{controller.selectedSub.title}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    发帖权限：
                    {POSTING_POLICY_LABEL[controller.selectedSub.postingPolicy]
                      ?? controller.selectedSub.postingPolicy}
                  </span>
                </div>

                <MilkdownEditor
                  key={`${controller.selectedSub.id}-${controller.resetKey}`}
                  threadId={thread.id}
                  defaultValue={controller.selectedSub.bodyPost?.content ?? ""}
                  onChange={controller.setContent}
                  onUploadImage={controller.uploadImage}
                  disabled={controller.isSaving}
                  diceRolls={controller.selectedSub.bodyPost?.diceRolls}
                />

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={controller.resetSubthreadEditor}
                    disabled={controller.isSaving}
                  >
                    取消
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void controller.handleSave()}
                    disabled={controller.isSaving}
                  >
                    {controller.isSaving && (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    )}
                    保存修改
                  </Button>
                </div>
              </div>
            ) : (
              <p className="py-16 text-center text-sm text-muted-foreground">
                暂无子贴，请先添加子贴
              </p>
            )}
          </section>
        </div>
      )}

      {controller.subFormMode && (
        <SubthreadForm
          mode={controller.subFormMode.mode}
          defaultValues={
            controller.subFormMode.mode === "edit"
              ? {
                  title: controller.subFormMode.sub.title,
                  postingPolicy: controller.subFormMode.sub.postingPolicy,
                }
              : undefined
          }
          isSubmitting={
            controller.isSaving || controller.createPending || controller.updatePending
          }
          onSubmit={
            controller.subFormMode.mode === "create"
              ? controller.handleCreateSubthread
              : controller.handleUpdateSubthread
          }
          onCancel={() => controller.setSubFormMode(null)}
        />
      )}
    </div>
  );
}

function ManagementToolbar({
  title,
  view,
  disabled,
  onExit,
  onViewChange,
}: {
  title: string;
  view: ManagementView;
  disabled: boolean;
  onExit: () => void;
  onViewChange: (view: ManagementView) => void;
}) {
  const views: Array<{ value: ManagementView; label: string }> = [
    { value: "thread", label: "主题帖" },
    { value: "subthreads", label: "子贴" },
    { value: "members", label: "成员" },
  ];
  return (
    <div className="flex items-center gap-3 border-b border-border px-4 py-3">
      <Button type="button" variant="ghost" size="sm" onClick={onExit} disabled={disabled}>
        <ArrowLeft className="mr-1.5 h-4 w-4" />
        返回浏览
      </Button>
      <span className="truncate text-sm font-medium">管理帖子：{title}</span>
      <div className="ml-auto flex items-center gap-1">
        {views.map((item) => (
          <Button
            key={item.value}
            type="button"
            variant={view === item.value ? "secondary" : "ghost"}
            size="sm"
            onClick={() => onViewChange(item.value)}
            disabled={disabled}
          >
            {item.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

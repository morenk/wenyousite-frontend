/** ManagementPanel：帖主管理面板 — 左子贴目录树 + 右单例编辑器 + 成员管理 */

"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";

import { Button } from "@/components/ui/button";
import { MilkdownEditor } from "@/components/editor/milkdown-editor";
import { SubthreadTree } from "@/components/thread/subthread-tree";
import { MemberManager } from "@/components/thread/member-manager";
import { ThreadEditForm } from "@/components/forms/thread-edit-form";
import {
  SubthreadForm,
  type SubthreadFormData,
} from "@/components/forms/subthread-form";
import { useCreateSubthread } from "@/api/hooks/use-create-subthread";
import { useUpdateSubthread } from "@/api/hooks/use-update-subthread";
import { useDeleteSubthread } from "@/api/hooks/use-delete-subthread";
import { useReorderSubthreads } from "@/api/hooks/use-reorder-subthreads";
import { useSyncSubthreadTags } from "@/api/hooks/use-sync-subthread-tags";
import { useUpsertBody } from "@/api/hooks/use-upsert-body";
import { useUploadImage } from "@/api/hooks/use-upload-image";
import { getApiError, getApiErrorMessage } from "@/api/errors";
import { POSTING_POLICY_LABEL } from "@/lib/post-policy";
import type { ThreadDetail, SubthreadDetail } from "@/api/hooks/use-thread-detail";
import { useThreadPermissions } from "@/components/thread/thread-permissions-context";
import { useConfirm } from "@/components/ui/confirm-provider";

interface ManagementPanelProps {
  thread: ThreadDetail;
  onExit: () => void;
  onRefetch: () => Promise<unknown>;
  initialView?: ManagementView;
}

export type ManagementView = "thread" | "subthreads" | "members";

type SubFormMode =
  | { mode: "create" }
  | { mode: "edit"; sub: SubthreadDetail }
  | null;

export function ManagementPanel({
  thread,
  onExit,
  onRefetch,
  initialView = "thread",
}: ManagementPanelProps) {
  const { user } = useAuth();
  const permissions = useThreadPermissions();
  const isOwner = permissions.isOwner || user?.id === thread.ownerId;
  const isCollaborator = permissions.isCollaborator;
  const subthreads = thread.subthreads.filter(
    (subthread) => subthread.id !== thread.defaultSubthreadId,
  );
  const [view, setView] = useState<ManagementView>(initialView);
  const [selectedId, setSelectedId] = useState(subthreads[0]?.id ?? "");
  const [content, setContent] = useState(
    subthreads[0]?.bodyPost?.content ?? "",
  );
  const [savedContent, setSavedContent] = useState(
    subthreads[0]?.bodyPost?.content ?? "",
  );
  const [resetKey, setResetKey] = useState(0);
  const [subFormMode, setSubFormMode] = useState<SubFormMode>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isThreadDirty, setIsThreadDirty] = useState(false);
  const [isThreadSaving, setIsThreadSaving] = useState(false);
  const confirmAction = useConfirm();

  const createSubthread = useCreateSubthread();
  const updateSubthread = useUpdateSubthread();
  const deleteSubthread = useDeleteSubthread();
  const reorderSubthreads = useReorderSubthreads();
  const syncSubthreadTags = useSyncSubthreadTags();
  const upsertBody = useUpsertBody();
  const uploadImage = useUploadImage();

  const selectedSub = subthreads.find((subthread) => subthread.id === selectedId);
  const isSubthreadDirty = Boolean(selectedSub) && content !== savedContent;
  const isNavigationLocked =
    isSaving || isThreadSaving || uploadImage.isPending;

  function hasUnsavedChanges() {
    return view === "thread"
      ? isThreadDirty
      : view === "subthreads" && isSubthreadDirty;
  }

  async function confirmDiscardChanges() {
    if (!hasUnsavedChanges()) return true;
    return confirmAction({
      title: "放弃未保存修改",
      description: "当前修改尚未保存，确定要放弃吗？",
      confirmLabel: "放弃修改",
      destructive: true,
    });
  }

  function resetSubthreadEditor() {
    setContent(savedContent);
    setResetKey((key) => key + 1);
  }

  async function handleViewChange(nextView: ManagementView) {
    if (nextView === view || isNavigationLocked) return;
    if (!(await confirmDiscardChanges())) return;
    if (view === "thread") setIsThreadDirty(false);
    if (view === "subthreads") resetSubthreadEditor();
    setView(nextView);
  }

  async function handleExit() {
    if (isNavigationLocked || !(await confirmDiscardChanges())) return;
    onExit();
  }

  async function handleSelect(id: string) {
    if (id === selectedId || isNavigationLocked) return;
    if (isSubthreadDirty && !(await confirmAction({
      title: "切换子贴",
      description: "当前修改尚未保存，确定要放弃吗？",
      confirmLabel: "放弃并切换",
      destructive: true,
    }))) {
      return;
    }
    setSelectedId(id);
    const sub = thread.subthreads.find((s) => s.id === id);
    const nextContent = sub?.bodyPost?.content ?? "";
    setContent(nextContent);
    setSavedContent(nextContent);
    setResetKey((k) => k + 1);
  }

  function handleCancel() {
    resetSubthreadEditor();
  }

  async function handleSave() {
    if (!selectedSub) return;
    const trimmed = content.trim();
    if (!trimmed) {
      toast.error("请输入正文内容");
      return;
    }

    try {
      setIsSaving(true);
      await upsertBody.mutateAsync({
        subthreadId: selectedSub.id,
        threadId: thread.id,
        content: trimmed,
        version: selectedSub.bodyPost?.version,
      });
      setContent(trimmed);
      setSavedContent(trimmed);
      setResetKey((key) => key + 1);
      toast.success("正文已保存");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "保存失败，请稍后重试"));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCreateSubthread(data: SubthreadFormData) {
    let created = false;
    try {
      const subthread = await createSubthread.mutateAsync({
        threadId: thread.id,
        body: {
          title: data.title,
          postingPolicy: data.postingPolicy,
        },
      });
      created = true;
      await syncSubthreadTags.mutateAsync({
        subthreadId: subthread.id,
        existingTags: [],
        targetNames: data.tagNames,
      });
      await onRefetch();
      setSubFormMode(null);
      toast.success("子贴已创建");
    } catch {
      if (created) {
        await onRefetch().catch(() => undefined);
        setSubFormMode(null);
        toast.error("子贴已创建，但标签同步失败，请重新编辑标签");
      } else {
        toast.error("创建子贴失败");
      }
    }
  }

  async function handleUpdateSubthread(data: SubthreadFormData) {
    if (subFormMode?.mode !== "edit") return;
    const sub = subFormMode.sub;
    let updated = false;
    try {
      await updateSubthread.mutateAsync({
        subthreadId: sub.id,
        body: {
          title: data.title,
          postingPolicy: data.postingPolicy,
          version: sub.version,
        },
      });
      updated = true;
      await syncSubthreadTags.mutateAsync({
        subthreadId: sub.id,
        existingTags: sub.tags.map(({ tag }) => ({
          id: tag.id,
          name: tag.name,
          color: tag.color,
        })),
        targetNames: data.tagNames,
      });
      await onRefetch();
      setSubFormMode(null);
      toast.success("子贴已更新");
    } catch {
      if (updated) {
        await onRefetch().catch(() => undefined);
        setSubFormMode(null);
        toast.error("子贴已更新，但标签同步失败，请重新编辑标签");
      } else {
        toast.error("更新子贴失败");
      }
    }
  }

  async function handleDeleteSubthread(sub: SubthreadDetail) {
    if (!(await confirmAction({
      title: "删除子贴",
      description: "确定要删除该子贴吗？子贴及其所有楼层将被删除。",
      confirmLabel: "删除",
      destructive: true,
    }))) return;
    try {
      await deleteSubthread.mutateAsync(sub.id);
      if (selectedId === sub.id) {
        const next = subthreads.find((item) => item.id !== sub.id);
        setSelectedId(next?.id ?? "");
        const nextContent = next?.bodyPost?.content ?? "";
        setContent(nextContent);
        setSavedContent(nextContent);
      }
      await onRefetch();
      toast.success("子贴已删除");
    } catch {
      toast.error("删除子贴失败");
    }
  }

  async function handleReorder(ids: string[]) {
    try {
      await reorderSubthreads.mutateAsync({
        threadId: thread.id,
        ids: [thread.defaultSubthreadId, ...ids],
      });
      await onRefetch();
    } catch (error) {
      const err = getApiError(error);
      if (err.message?.includes("默认子贴") || err.message?.includes("第一位")) {
        toast.error("主帖必须保持在第一位，不能与其他子帖交换顺序");
      } else {
        toast.error("排序保存失败，请稍后重试");
      }
    }
  }

  async function handleUploadImage(file: File) {
    const url = await uploadImage.mutateAsync(file);
    return url;
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* 顶部工具条 */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleExit}
          disabled={isNavigationLocked}
        >
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          返回浏览
        </Button>
        <span className="text-sm font-medium truncate">
          管理帖子：{thread.title}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <Button
            type="button"
            variant={view === "thread" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => handleViewChange("thread")}
            disabled={isNavigationLocked}
          >
            主题帖
          </Button>
          <Button
            type="button"
            variant={view === "subthreads" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => handleViewChange("subthreads")}
            disabled={isNavigationLocked}
          >
            子贴
          </Button>
          <Button
            type="button"
            variant={view === "members" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => handleViewChange("members")}
            disabled={isNavigationLocked}
          >
            成员
          </Button>
        </div>
      </div>

      {/* 主题帖信息与主帖正文 */}
      {view === "thread" && (
        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-4xl">
            <ThreadEditForm
              thread={thread}
              isOwner={isOwner}
              onDirtyChange={setIsThreadDirty}
              onSavingChange={setIsThreadSaving}
            />
          </div>
        </div>
      )}

      {/* 成员管理 */}
      {view === "members" && (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <MemberManager
            threadId={thread.id}
            isOwner={isOwner}
            isCollaborator={isCollaborator}
          />
        </div>
      )}

      {/* 左树 + 右编辑 */}
      {view === "subthreads" && (
        <div className="flex min-h-0 flex-1">
          {/* 左栏：子贴目录树 */}
          <aside className="flex w-64 min-h-0 shrink-0 flex-col border-r border-border bg-muted/30">
            <div className="px-3 pt-3 pb-1 text-xs font-medium text-muted-foreground">
              子贴目录
            </div>
            <SubthreadTree
              subthreads={subthreads}
              selectedId={selectedId}
              onSelect={handleSelect}
              onEdit={(sub) => setSubFormMode({ mode: "edit", sub })}
              onDelete={(sub) => handleDeleteSubthread(sub)}
              onReorder={handleReorder}
              onCreate={() => setSubFormMode({ mode: "create" })}
            />
          </aside>

          {/* 右栏：子贴正文编辑器 */}
          <section className="flex min-w-0 flex-1 flex-col p-4">
            {selectedSub ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    正在编辑：{selectedSub.title}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    发帖权限：{POSTING_POLICY_LABEL[selectedSub.postingPolicy] ?? selectedSub.postingPolicy}
                  </span>
                </div>

                <MilkdownEditor
                  key={`${selectedSub.id}-${resetKey}`}
                  threadId={thread.id}
                  defaultValue={selectedSub.bodyPost?.content ?? ""}
                  onChange={setContent}
                  onUploadImage={handleUploadImage}
                  disabled={isSaving}
                  diceRolls={selectedSub.bodyPost?.diceRolls}
                />

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleCancel}
                    disabled={isSaving}
                  >
                    取消
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleSave}
                    disabled={isSaving}
                  >
                    {isSaving && (
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

      {/* 子贴元数据表单弹窗 */}
      {subFormMode && (
        <SubthreadForm
          mode={subFormMode.mode}
          defaultValues={
            subFormMode.mode === "edit"
              ? {
                  title: subFormMode.sub.title,
                  postingPolicy: subFormMode.sub.postingPolicy,
                  tagNames: subFormMode.sub.tags.map(({ tag }) => tag.name),
                }
              : undefined
          }
          isSubmitting={
            isSaving ||
            createSubthread.isPending ||
            updateSubthread.isPending ||
            syncSubthreadTags.isPending
          }
          onSubmit={
            subFormMode.mode === "create"
              ? handleCreateSubthread
              : handleUpdateSubthread
          }
          onCancel={() => setSubFormMode(null)}
        />
      )}
    </div>
  );
}

/** 楼主/协作者桌面管理工作台：帖子设置、章节目录与成员权限。 */

"use client";

import { useEffect } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CircleAlert,
  ClipboardCopy,
  Loader2,
  RotateCcw,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MilkdownEditor } from "@/components/editor/milkdown-editor";
import { SubthreadTree } from "@/components/thread/subthread-tree";
import { MemberManager } from "@/components/thread/member-manager";
import { ThreadEditForm } from "@/components/forms/thread-edit-form";
import { SubthreadForm } from "@/components/forms/subthread-form";
import { POSTING_POLICY_OPTIONS } from "@/lib/post-policy";
import type { ThreadDetail } from "@/api/hooks/use-thread-detail";
import {
  useManagementPanelController,
  type ManagementView,
} from "@/components/thread/use-management-panel-controller";
import type { ManagementEditorStatus } from "@/components/thread/management-types";

const THREAD_SETTINGS_FORM_ID = "thread-management-settings-form";

const POSTING_POLICY_HELP: Record<string, string> = {
  PARTICIPANTS: "回复过该帖的参与人可以发帖，楼主和协作者始终可以发帖。",
  COLLABORATORS: "仅楼主和协作者可以发帖。",
  PLAYERS: "已标记为玩家的成员可以发帖，楼主和协作者始终可以发帖。",
};

interface ManagementPanelProps {
  thread: ThreadDetail;
  onExit: () => void;
  onRefetch: () => Promise<ThreadDetail | undefined>;
}

export type { ManagementView } from "@/lib/management-url-state";

export function ManagementPanel({
  thread,
  onExit,
  onRefetch,
}: ManagementPanelProps) {
  const controller = useManagementPanelController({ thread, onExit, onRefetch });
  const canSave =
    controller.view !== "members" &&
    controller.currentStatus.dirty &&
    !controller.currentStatus.busy &&
    !controller.isNavigationLocked;

  const requestSave = () => {
    if (!canSave) return;
    if (controller.view === "settings") {
      const form = document.getElementById(THREAD_SETTINGS_FORM_ID);
      if (form instanceof HTMLFormElement) form.requestSubmit();
      return;
    }
    if (controller.view === "subthreads") {
      void controller.handleSaveSubthread();
    }
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "s") return;
      if (!canSave) return;
      event.preventDefault();
      requestSave();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  });

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card">
      <ManagementToolbar
        title={thread.title}
        role={controller.isOwner ? "楼主" : "协作者"}
        view={controller.view}
        status={controller.currentStatus}
        subthreadCount={controller.subthreads.length}
        memberCount={thread._count.members}
        settingsDirty={controller.threadStatus.dirty}
        subthreadsDirty={controller.subthreadStatus.dirty}
        disabled={controller.isNavigationLocked}
        canSave={canSave}
        onSave={requestSave}
        onExit={() => void controller.handleExit()}
        onViewChange={(view) => void controller.handleViewChange(view)}
      />

      {controller.view === "settings" ? (
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <ThreadEditForm
            thread={thread}
            isOwner={controller.isOwner}
            formId={THREAD_SETTINGS_FORM_ID}
            onStatusChange={controller.setThreadStatus}
            onReloadLatest={onRefetch}
          />
        </div>
      ) : null}

      {controller.view === "members" ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <MemberManager
            threadId={thread.id}
            isOwner={controller.isOwner}
            isCollaborator={controller.isCollaborator}
          />
        </div>
      ) : null}

      {controller.view === "subthreads" ? (
        <div className="flex min-h-0 flex-1">
          <aside className="flex min-h-0 w-72 shrink-0 flex-col border-r border-border bg-muted/30">
            <div className="flex items-end justify-between gap-3 px-4 pb-2 pt-4">
              <div>
                <p className="font-utility text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-brand-strong">
                  章节目录
                </p>
                <h2 className="mt-0.5 font-display text-lg font-bold text-foreground">子贴内容</h2>
              </div>
              <span className="font-utility text-xs tabular-nums text-muted-foreground">
                {controller.subthreads.length} 篇
              </span>
            </div>
            <SubthreadTree
              subthreads={controller.subthreads}
              selectedId={controller.selectedId}
              disabled={controller.isNavigationLocked}
              onSelect={(id) => void controller.handleSelect(id)}
              onDelete={(subthread) => void controller.handleDeleteSubthread(subthread)}
              onReorder={(ids) => void controller.handleReorder(ids)}
              onCreate={() => controller.setSubFormMode({ mode: "create" })}
            />
          </aside>

          <section className="min-w-0 flex-1 overflow-y-auto p-5">
            {controller.selectedSub ? (
              <div className="mx-auto max-w-[52rem] space-y-4">
                {controller.subthreadStatus.state === "conflict" ||
                controller.subthreadStatus.state === "error" ? (
                  <SubthreadSaveAlert
                    status={controller.subthreadStatus}
                    onCopy={() => void controller.handleCopyLocalContent()}
                    onReload={() => void controller.handleReloadSubthread()}
                  />
                ) : null}

                <div className="rounded-2xl border border-border bg-muted/20 p-4">
                  <div className="grid grid-cols-[minmax(0,1fr)_15rem] gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="management-subthread-title">子贴标题</Label>
                      <Input
                        id="management-subthread-title"
                        value={controller.title}
                        maxLength={100}
                        disabled={controller.currentStatus.busy}
                        onChange={(event) => controller.setTitle(event.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="management-subthread-policy">发帖权限</Label>
                      <Select
                        items={POSTING_POLICY_OPTIONS}
                        value={controller.postingPolicy}
                        onValueChange={(value) => {
                          if (value) controller.setPostingPolicy(value);
                        }}
                        disabled={controller.currentStatus.busy}
                      >
                        <SelectTrigger id="management-subthread-policy" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent align="start">
                          {POSTING_POLICY_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-muted-foreground">
                    {POSTING_POLICY_HELP[controller.postingPolicy]}
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <p className="font-utility text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-brand-strong">
                        正文画布
                      </p>
                      <h2 className="mt-0.5 font-display text-lg font-bold text-foreground">
                        {controller.title || "未命名子贴"}
                      </h2>
                    </div>
                    {controller.subthreadStatus.dirty ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="compact"
                        disabled={controller.currentStatus.busy}
                        onClick={controller.resetSubthreadEditor}
                      >
                        <RotateCcw />
                        撤销未保存修改
                      </Button>
                    ) : null}
                  </div>
                  <MilkdownEditor
                    key={`${controller.selectedSub.id}-${controller.resetKey}`}
                    threadId={thread.id}
                    defaultValue={controller.content}
                    onChange={controller.setContent}
                    onUploadImage={controller.uploadImage}
                    disabled={controller.currentStatus.busy}
                    minHeight={440}
                    maxHeight={580}
                    autoFocus={controller.focusRequestKey > 0}
                    diceRolls={controller.selectedSub.bodyPost?.diceRolls}
                    ariaLabel="子贴正文"
                  />
                  <p className="text-right font-utility text-[0.6875rem] text-muted-foreground">
                    按 Ctrl / ⌘ + S 保存当前子贴
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex min-h-[32rem] flex-col items-center justify-center text-center">
                <p className="font-display text-xl font-bold text-foreground">从第一篇子贴开始</p>
                <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                  子贴像章节一样组织设定、剧情和讨论。创建后会自动打开正文画布。
                </p>
                <Button
                  type="button"
                  className="mt-5"
                  onClick={() => controller.setSubFormMode({ mode: "create" })}
                >
                  添加子贴
                </Button>
              </div>
            )}
          </section>
        </div>
      ) : null}

      {controller.subFormMode ? (
        <SubthreadForm
          mode="create"
          isSubmitting={controller.createPending}
          onSubmit={controller.handleCreateSubthread}
          onCancel={() => controller.setSubFormMode(null)}
        />
      ) : null}
    </div>
  );
}

function ManagementToolbar({
  title,
  role,
  view,
  status,
  subthreadCount,
  memberCount,
  settingsDirty,
  subthreadsDirty,
  disabled,
  canSave,
  onSave,
  onExit,
  onViewChange,
}: {
  title: string;
  role: "楼主" | "协作者";
  view: ManagementView;
  status: ManagementEditorStatus;
  subthreadCount: number;
  memberCount: number;
  settingsDirty: boolean;
  subthreadsDirty: boolean;
  disabled: boolean;
  canSave: boolean;
  onSave: () => void;
  onExit: () => void;
  onViewChange: (view: ManagementView) => void;
}) {
  const views: Array<{
    value: ManagementView;
    label: string;
    count?: number;
    dirty?: boolean;
  }> = [
    { value: "settings", label: "帖子设置", dirty: settingsDirty },
    { value: "subthreads", label: "子贴内容", count: subthreadCount, dirty: subthreadsDirty },
    { value: "members", label: "成员权限", count: memberCount },
  ];
  const saveLabel = view === "settings" ? "保存帖子" : "保存子贴";

  return (
    <header className="shrink-0 border-b border-border bg-card">
      <div className="flex min-h-16 items-center gap-4 px-4 py-2.5">
        <Button type="button" variant="ghost" size="compact" onClick={onExit} disabled={disabled}>
          <ArrowLeft />
          返回帖子
        </Button>
        <div className="h-7 w-px bg-border" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate font-display text-lg font-bold text-foreground" title={title}>
              {title}
            </h1>
            <Badge tone={role === "楼主" ? "brand" : "info"}>{role}</Badge>
          </div>
          <p className="mt-0.5 font-utility text-[0.6875rem] text-muted-foreground">
            共同创作管理台
          </p>
        </div>
        <SaveStatus status={status} membersImmediate={view === "members"} />
        {view !== "members" ? (
          <Button type="button" onClick={onSave} disabled={!canSave}>
            {status.busy ? <Loader2 className="animate-spin" /> : <Save />}
            {saveLabel}
          </Button>
        ) : null}
      </div>

      <Tabs value={view} onValueChange={(value) => onViewChange(value as ManagementView)}>
        <TabsList variant="line" className="h-11 w-full justify-start rounded-none border-t border-border bg-muted/25 px-3 py-0">
          {views.map((item) => (
            <TabsTrigger
              key={item.value}
              value={item.value}
              disabled={disabled}
              className="h-11 flex-none px-4"
            >
              {item.label}
              {item.count !== undefined ? (
                <span className="rounded-full bg-muted px-1.5 font-utility text-[0.6875rem] tabular-nums text-muted-foreground">
                  {item.count}
                </span>
              ) : null}
              {item.dirty ? (
                <span className="size-1.5 rounded-full bg-warning" aria-label="有未保存修改" />
              ) : null}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </header>
  );
}

function SaveStatus({
  status,
  membersImmediate,
}: {
  status: ManagementEditorStatus;
  membersImmediate: boolean;
}) {
  if (membersImmediate) {
    return (
      <span className="font-utility text-xs text-muted-foreground" aria-live="polite">
        权限修改即时生效
      </span>
    );
  }
  const meta = {
    saved: { label: status.message ?? "已保存", icon: Check, className: "text-success" },
    dirty: { label: "有未保存修改", icon: CircleAlert, className: "text-warning" },
    saving: { label: status.message ?? "保存中…", icon: Loader2, className: "text-muted-foreground" },
    error: { label: status.message ?? "保存失败", icon: AlertTriangle, className: "text-destructive" },
    conflict: { label: "内容已被他人修改", icon: AlertTriangle, className: "text-warning" },
  }[status.state];
  const Icon = meta.icon;
  return (
    <span
      className={`inline-flex max-w-64 items-center gap-1.5 font-utility text-xs ${meta.className}`}
      aria-live="polite"
      title={meta.label}
    >
      <Icon className={`size-3.5 shrink-0 ${status.state === "saving" ? "animate-spin" : ""}`} />
      <span className="truncate">{meta.label}</span>
    </span>
  );
}

function SubthreadSaveAlert({
  status,
  onCopy,
  onReload,
}: {
  status: ManagementEditorStatus;
  onCopy: () => void;
  onReload: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex items-start justify-between gap-5 rounded-xl border border-warning/35 bg-warning-soft/45 px-4 py-3"
    >
      <div className="flex min-w-0 gap-3">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
        <div>
          <p className="text-sm font-semibold text-foreground">
            {status.state === "conflict" ? "检测到内容版本冲突" : "子贴尚未保存"}
          </p>
          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{status.message}</p>
        </div>
      </div>
      {status.state === "conflict" ? (
        <div className="flex shrink-0 gap-2">
          <Button type="button" variant="outline" size="compact" onClick={onCopy}>
            <ClipboardCopy />
            复制本地正文
          </Button>
          <Button type="button" variant="outline" size="compact" onClick={onReload}>
            <RotateCcw />
            载入最新版本
          </Button>
        </div>
      ) : null}
    </div>
  );
}

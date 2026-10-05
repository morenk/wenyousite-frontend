"use client";

import { useCallback, useState } from "react";
import { useRpIdentities, useRpIdentity, useMutateRpIdentity, type RpIdentityState, type CreateRpIdentity } from "@/api/hooks/use-rp-identities";
import { getApiError, isContentUnavailableError } from "@/api/errors";
import { ThreadIdentityEditor } from "@/components/thread/thread-identity-editor";
import { AvatarUploader } from "@/components/user/avatar-uploader";
import { SettingsDialog } from "@/components/user/settings-controls";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-provider";

export interface NewThreadIdentityDraft { nickname: string; avatarMediaId?: string; avatar?: string; uncertain?: boolean; reviewed?: boolean }

export function ThreadIdentityControls({ threadId, identityId, onCreated, onClose, draft, onDraftChange }: {
  threadId: string; identityId: string | null; onCreated?: (role: RpIdentityState) => void; onClose: () => void;
  draft: NewThreadIdentityDraft; onDraftChange: (draft: NewThreadIdentityDraft) => void;
}) {
  const collection = useRpIdentities(threadId);
  const confirm = useConfirm();
  const [reviewFailure, setReviewFailure] = useState<string>();
  const [baseline, setBaseline] = useState<RpIdentityState>();
  const roleId = identityId ?? baseline?.identityId;
  const query = useRpIdentity(threadId, roleId);
  const { create, update, remove } = useMutateRpIdentity(threadId);
  const [avatarOpen, setAvatarOpen] = useState(false);
  if (!baseline && query.data) setBaseline(query.data);
  const state = query.data ?? baseline;
  const account = collection.data?.account ?? state?.account;
  const canEdit = Boolean(collection.data?.canEdit && (!roleId || state?.canEdit));
  const nicknameChanged = useCallback((nickname: string) => { if (!roleId && nickname !== draft.nickname) onDraftChange({ ...draft, nickname }); }, [roleId, draft, onDraftChange]);
  const close = () => { setAvatarOpen(false); onClose(); };
  const save = async (body: CreateRpIdentity, nextDraft = draft) => {
    if (!canEdit) throw new Error("帖内身份当前不可修改");
    if (roleId && !baseline?.identity) throw new Error("该身份已不可修改，请重新查看列表");
    const payload = roleId ? body : { nickname: nextDraft.nickname || null, avatarMediaId: nextDraft.avatarMediaId, ...body };
    if (!roleId && !payload.nickname && !payload.avatarMediaId) throw new Error("请至少设置昵称或头像");
    if (!roleId && draft.uncertain) {
      if (!draft.reviewed) throw new Error("上次创建结果未确认，请先查看身份列表。");
      if (!await confirm({ title: "再次创建身份", description: "上次请求可能已创建角色，再次创建会新增一个身份。确认已经查看列表？",
        confirmLabel: "确认再次创建", cancelLabel: "保留输入" })) return false;
    }
    let saved: RpIdentityState;
    try {
      saved = roleId
        ? await update.mutateAsync({ identityId: roleId, body: { ...payload, version: baseline!.identity!.version } })
        : await create.mutateAsync(payload);
    } catch (error) {
      const info = getApiError(error);
      const rejected = (info.status !== undefined && info.status >= 400 && info.status < 500) || (info.code !== undefined && info.code >= 40000 && info.code < 50000);
      if (!roleId && !rejected) {
        onDraftChange({ ...nextDraft, nickname: payload.nickname ?? "", avatarMediaId: payload.avatarMediaId ?? undefined, uncertain: true, reviewed: false });
        void collection.refetch();
        throw new Error("创建结果未确认，输入已保留。请查看身份列表后再决定是否新建。");
      }
      throw error;
    }
    setBaseline(saved);
    if (!roleId) { onCreated?.(saved); onDraftChange({ nickname: "" }); }
    return saved;
  };
  if ((query.isError && isContentUnavailableError(query.error)) || (collection.isError && isContentUnavailableError(collection.error))) {
    return <SettingsDialog title="帖内身份" onClose={close}><p role="alert">该身份暂不可访问。</p></SettingsDialog>;
  }
  if (!account || (identityId && !baseline)) return <SettingsDialog title="帖内身份" onClose={close}>
    {collection.isError || query.isError ? <Button variant="outline" onClick={() => { void collection.refetch(); if (roleId) void query.refetch(); }}>身份加载失败，重试</Button> : <p role="status">正在加载帖内身份…</p>}
  </SettingsDialog>;
  const display = baseline?.display;
  return <>
    <ThreadIdentityEditor key={threadId + ":" + account.id + ":" + (identityId ?? "new")}
      accountUsername={account.username} nickname={baseline?.identity?.nickname ?? (roleId ? null : draft.nickname)}
      avatar={display?.avatar ?? (roleId ? account.avatar : draft.avatar ?? account.avatar)} avatarDisplay={display?.avatarDisplay}
      existingIdentity={Boolean(roleId)} disabled={!canEdit} canDelete={Boolean(state?.canDelete && baseline?.identity)}
      onSave={(nickname) => save({ nickname })}
      onDelete={async () => {
        if (!roleId || !baseline?.identity || !state?.canDelete) throw new Error("该身份当前不可删除");
        return remove.mutateAsync({ identityId: roleId, version: baseline.identity.version });
      }}
      onNicknameChange={nicknameChanged}
      feedback={!roleId && draft.uncertain ? <div>
        <Button type="button" variant="ghost" size="sm" onClick={async () => {
          const fresh = await collection.refetch();
          if (fresh.isError) { setReviewFailure("身份列表加载失败，请重试后再确认创建结果。"); return; }
          onDraftChange({ ...draft, reviewed: true });
          close();
        }}>创建结果待确认，查看身份列表</Button>
        {reviewFailure ? <p role="alert" className="text-sm text-destructive">{reviewFailure}</p> : null}
      </div> : null}
      onAvatar={() => setAvatarOpen(true)} onClose={close} />
    {avatarOpen ? <AvatarUploader key={"avatar:" + (roleId ?? "new")}
      username={display?.nickname ?? account.username}
      avatar={baseline?.identity?.avatarMediaId ? display?.avatar ?? null : null}
      avatarDisplay={baseline?.identity?.avatarMediaId ? display?.avatarDisplay : null}
      title="帖内头像" onSaveAvatar={async (avatarMediaId, uploaded) => {
        const nextDraft = { ...draft, avatarMediaId, avatar: uploaded?.url ?? draft.avatar };
        if (!roleId) onDraftChange(nextDraft);
        const result = await save({ avatarMediaId }, nextDraft);
        if (result === false) throw new Error("已取消再次创建，输入已保留");
        if (!roleId) close();
        return result;
      }}
      onRemoveAvatar={() => save({ clearAvatar: true })} onClose={() => setAvatarOpen(false)} /> : null}
  </>;
}

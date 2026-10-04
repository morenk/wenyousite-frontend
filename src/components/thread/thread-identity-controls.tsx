"use client";

import { useState } from "react";
import { useThreadIdentity, useUpdateThreadIdentity } from "@/api/hooks/use-thread-identity";
import { ThreadIdentityEditor } from "@/components/thread/thread-identity-editor";
import { AvatarUploader } from "@/components/user/avatar-uploader";
import { SettingsDialog } from "@/components/user/settings-controls";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/shared/user-avatar";

export function ThreadIdentityControls({ threadId, compact = false, opened, onClose }: { threadId: string; compact?: boolean; opened?: boolean; onClose?: () => void }) {
  const query = useThreadIdentity(threadId);
  const { save, clear } = useUpdateThreadIdentity(threadId);
  const [localOpen, setLocalOpen] = useState(false);
  const open = opened ?? localOpen;
  const close = () => { setLocalOpen(false); setAvatarOpen(false); onClose?.(); };
  const [avatarOpen, setAvatarOpen] = useState(false);
  const state = query.data;
  const display = state?.display;
  const canEdit = state?.canEdit ?? false;
  return (
    <>
      {opened !== undefined ? null : query.isError ? <Button type="button" variant="ghost" size="sm" onClick={() => void query.refetch()}>身份加载失败，重试</Button> : (
        <Button type="button" variant="ghost" size="sm" disabled={query.isPending || !canEdit} onClick={() => setLocalOpen(true)}
          className="max-w-full justify-start gap-2 text-muted-foreground">
          {state ? <UserAvatar name={display?.nickname ?? state.account.username} src={(display ? display.avatar : state.account.avatar)} display={display?.avatarDisplay} className="size-6" textClassName="text-xs" /> : null}
          <span className="truncate">{query.isPending ? "正在加载发言身份…" : compact ? "设置帖内身份" : `以「${display?.nickname ?? state?.account.username ?? "站内账号"}」发表`}</span>
        </Button>
      )}
      {open && !state ? <SettingsDialog title="设置帖内身份" onClose={close}>
        {query.isError ? <Button type="button" variant="outline" onClick={() => void query.refetch()}>身份加载失败，重试</Button> : <p role="status">正在加载帖内身份…</p>}
      </SettingsDialog> : null}
      {open && state ? <ThreadIdentityEditor key={"editor:" + state.threadId + ":" + state.userId}
        accountUsername={state.account.username}
        nickname={state.identity?.nickname ?? null}
        avatar={(display ? display.avatar : state.account.avatar)}
        avatarDisplay={display?.avatarDisplay}
        hasCustomIdentity={Boolean(state.identity?.nickname || state.identity?.avatarMediaId)}
        disabled={!canEdit}
        onSave={(nickname) => save.mutateAsync({ nickname, version: state.identity?.version })}
        onClear={() => clear.mutateAsync()}
        onAvatar={() => setAvatarOpen(true)}
        onClose={close}
      /> : null}
      {open && avatarOpen && state ? <AvatarUploader key={"avatar:" + state.threadId + ":" + state.userId}
        username={display?.nickname ?? state.account.username}
        avatar={state.identity?.avatarMediaId ? display?.avatar ?? null : null}
        avatarDisplay={state.identity?.avatarMediaId ? display?.avatarDisplay : null}
        title="帖内头像"
        onSaveAvatar={(avatarMediaId) => save.mutateAsync({ avatarMediaId, version: state.identity?.version })}
        onRemoveAvatar={() => save.mutateAsync({ clearAvatar: true, version: state.identity?.version })}
        onClose={() => setAvatarOpen(false)}
      /> : null}
    </>
  );
}

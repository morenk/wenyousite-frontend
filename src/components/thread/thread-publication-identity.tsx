"use client";

import { useState } from "react";
import { ThreadIdentityControls, type NewThreadIdentityDraft } from "@/components/thread/thread-identity-controls";
import { ThreadPublicationIdentityChoice } from "./thread-publication-identity-choice";
import type { useThreadIdentitySubmission } from "@/components/thread/use-thread-identity-submission";
import { canPublishAsIdentity } from "@/api/hooks/use-rp-identities";
import { Button } from "@/components/ui/button";

export function ThreadPublicationIdentity({
  controller, threadId, disabled,
}: {
  controller: ReturnType<typeof useThreadIdentitySubmission>;
  threadId: string;
  disabled?: boolean;
}) {
  const { query, mode, identityId, choose, chooseCreated } = controller;
  const [editing, setEditing] = useState<{ id: string | null } | null>(null);
  const [newDraft, setNewDraft] = useState<NewThreadIdentityDraft>({ nickname: "" });
  if (query.isPending) return <p role="status" className="text-xs text-muted-foreground">正在加载发言身份…</p>;
  if (query.isError && !query.data) return <Button variant="ghost" type="button" size="sm" onClick={() => void query.refetch()}>身份加载失败，重试</Button>;
  const state = query.data;
  const account = state?.account;
  const identities = (state?.identities ?? []).map((role) => ({
    id: role.identityId,
    appearance: {
      name: role.display?.nickname ?? role.identity?.nickname ?? (role.identity?.avatarMediaId ? "帖内身份" : "未设置"),
      avatar: role.display?.avatar ?? null, avatarDisplay: role.display?.avatarDisplay,
    },
    selectable: canPublishAsIdentity(role),
    editable: role.canEdit || role.canDelete,
  }));
  return <><ThreadPublicationIdentityChoice value={mode === "RP" ? { mode, id: identityId ?? null } : { mode }} disabled={disabled}
    account={{ name: account?.username ?? "站内账号", avatar: account?.avatar ?? null }}
    identities={identities} activeCount={state?.activeCount} limit={state?.limit}
    onChange={(value) => choose(value.mode, value.mode === "RP" ? value.id ?? undefined : undefined)}
    onEdit={!disabled ? (id) => setEditing({ id }) : undefined}
    onCreate={!disabled && state?.canEdit ? () => setEditing({ id: null }) : undefined} />
    {editing ? <ThreadIdentityControls key={threadId + ":" + (editing.id ?? "new")} threadId={threadId} identityId={editing.id}
      draft={newDraft} onDraftChange={setNewDraft} onCreated={chooseCreated} onClose={() => setEditing(null)} /> : null}
  </>;
}

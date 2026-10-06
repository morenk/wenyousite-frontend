"use client";

import { useEffect, useState, type ReactNode } from "react";
import { getApiError, isContentUnavailableError } from "@/api/errors";
import { useContentAccessCache } from "@/api/hooks/use-content-access-cache";
import { useRpIdentity } from "@/api/hooks/use-rp-identities";
import { RpIdentityProfile } from "./rp-identity-profile";
import type { PostDetail } from "@/api/hooks/use-post";
import { ContentLink } from "@/components/ui/content-link";
import { ThreadIdentityCard } from "./thread-identity-card";
import type { MentionIdentity } from "@/lib/thread-identity";
import type { MentionTarget } from "@/lib/mention";

export function RoleMentionLink({ target, label, projection, children, renderProfileBody }: {
  target: MentionTarget; label: string; projection: MentionIdentity; children?: ReactNode;
  renderProfileBody?: (post: PostDetail) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [revoked, setRevoked] = useState(false);
  const { clearThread } = useContentAccessCache();
  const current = useRpIdentity(projection.threadId!, target.targetIdentityId ?? undefined, open && !revoked);
  const error = getApiError(current.error);
  const unavailable = current.isError && (isContentUnavailableError(current.error) || error.status === 403
    || (error.code !== undefined && error.code >= 40300 && error.code < 40400));
  useEffect(() => { if (unavailable) clearThread(projection.threadId!); }, [clearThread, projection.threadId, unavailable]);
  if (unavailable && !revoked) setRevoked(true);
  if (revoked || unavailable) return <span>不可用用户</span>;
  const data = current.data;
  const showRole = data?.enabled !== false && Boolean(projection.identityId);
  const name = !showRole && data ? data.account.username : projection.displayName;
  const link = (show: () => void) => <ContentLink
    href={"/users/" + target.userId} mention
    data-wenyou-mention-source-href={target.sourceHref}
    data-wenyou-mention-source-label={label}
    onClick={(event) => { event.preventDefault(); show(); if (open) void current.refetch(); }}>
    {name === label.slice(1) && children ? children : "@" + name}
  </ContentLink>;
  if (!data) return <>{link(() => setOpen(true))}
    {open ? <span role={current.isError ? "alert" : "status"} className="ml-1 text-xs text-muted-foreground">
      {current.isError ? "身份加载失败，请重试" : "正在加载身份…"}
    </span> : null}</>;
  const appearance = showRole ? {
    name, avatar: data.display?.avatar ?? data.account.avatar, avatarDisplay: data.display?.avatarDisplay,
  } : { name: data.account.username, avatar: data.account.avatar };
  return <ThreadIdentityCard account={{ ...data.account, id: target.userId }}
    appearance={appearance} isRoleplay={showRole}

    profile={renderProfileBody && data.profilePostStatus ? <RpIdentityProfile threadId={projection.threadId!} identityId={target.targetIdentityId!}
      state={data} identityPending={current.isFetching} identityError={current.isError}
      renderBody={renderProfileBody} onNavigate={() => setOpen(false)} /> : undefined}
    trigger={link} open={open} onOpenChange={setOpen}
    loading={open && current.isFetching} error={current.isError} onRetry={() => void current.refetch()} />;
}

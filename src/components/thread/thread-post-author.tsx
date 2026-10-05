"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getApiError, isContentUnavailableError } from "@/api/errors";
import { useContentAccessCache } from "@/api/hooks/use-content-access-cache";
import { cn } from "@/lib/utils";
import { threadAppearance, type ThreadAccountAppearance } from "@/lib/thread-identity";
import { useRpIdentity } from "@/api/hooks/use-rp-identities";
import { UserAvatarLink } from "@/components/shared/user-avatar";
import { RpIdentityProfile } from "./rp-identity-profile";
import { renderPostBody } from "./markdown-content";
import { ThreadIdentityCard } from "@/components/thread/thread-identity-card";
import { useThreadPermissions } from "@/components/thread/thread-permissions-context";
import { Badge } from "@/components/ui/badge";
import { LevelBadge } from "@/components/shared/level-badge";

interface ThreadPostAuthorProps {
  author: ThreadAccountAppearance & { level?: number };
  threadId: string;
  avatarClassName?: string;
  avatarTextClassName?: string;
  textClassName?: string;
}

function RoleplayAuthor(props: ThreadPostAuthorProps) {
  const { author, threadId } = props;
  const [opened, setOpened] = useState(false);
  const [accessRevoked, setAccessRevoked] = useState(false);
  const { clearThread } = useContentAccessCache();
  const current = useRpIdentity(threadId, author.rpIdentity?.id, opened && !accessRevoked);
  const error = getApiError(current.error);
  const unavailable = current.isError && (isContentUnavailableError(current.error)
    || error.status === 403 || (error.code !== undefined && error.code >= 40300 && error.code < 40400));
  useEffect(() => { if (unavailable) clearThread(threadId); }, [clearThread, threadId, unavailable]);
  if (unavailable && !accessRevoked) setAccessRevoked(true);
  const { ownerId } = useThreadPermissions();
  if (unavailable || accessRevoked) return null;
  if (current.data?.enabled === false) return <AccountAuthor {...props} author={{ ...(current.data.account ?? author), id: author.id }} />;
  const appearance = threadAppearance(author);
  return <ThreadIdentityCard
    account={{ ...(current.data?.account ?? author), id: author.id }} appearance={appearance}
    badges={<>{author.id === ownerId ? <Badge tone="brand" size="compact">楼主</Badge> : null}<LevelBadge level={author.level} /></>}

    open={opened} onOpenChange={setOpened}
    profile={current.data?.profilePostStatus ? <RpIdentityProfile threadId={threadId} identityId={author.rpIdentity!.id} state={current.data}
      identityPending={current.isFetching} identityError={current.isError} renderBody={renderPostBody} onNavigate={() => setOpened(false)} /> : undefined}
    loading={opened && current.isFetching} error={current.isError}
    onRetry={() => void current.refetch()} onOpen={() => { if (opened) void current.refetch(); setOpened(true); }}
    avatarClassName={props.avatarClassName} avatarTextClassName={props.avatarTextClassName} textClassName={props.textClassName}
  />;
}

function AccountAuthor({ author, avatarClassName = "size-8", avatarTextClassName = "text-sm", textClassName = "text-sm" }: ThreadPostAuthorProps) {
  return <>
    <UserAvatarLink userId={author.id} name={author.username} src={author.avatar ?? null}
      display={author.avatarDisplay} className={avatarClassName} textClassName={avatarTextClassName} />
    <Link href={`/users/${author.id}`} className={cn(textClassName, "font-medium text-foreground hover:text-brand-strong")}>
      {author.username}
    </Link>
  </>;
}

/** 导航由本条快照决定，作者当前有 RP 也不改变站内身份发言的入口。 */
export function ThreadPostAuthor(props: ThreadPostAuthorProps) {
  const { rpIdentityEnabled } = useThreadPermissions();
  return props.author.rpIdentity && rpIdentityEnabled !== false
    ? <RoleplayAuthor {...props} /> : <AccountAuthor {...props} />;
}

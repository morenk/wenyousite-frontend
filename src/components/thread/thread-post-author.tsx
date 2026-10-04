"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getApiError, isContentUnavailableError } from "@/api/errors";
import { useContentAccessCache } from "@/api/hooks/use-content-access-cache";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { threadAppearance, type ThreadAccountAppearance } from "@/lib/thread-identity";
import { useThreadUserIdentity } from "@/api/hooks/use-thread-identity";
import { UserAvatarLink } from "@/components/shared/user-avatar";
import { ThreadIdentityCard } from "@/components/thread/thread-identity-card";
import { useThreadPermissions } from "@/components/thread/thread-permissions-context";
import { useThreadComposerSession } from "@/components/thread/thread-composer-context";

interface ThreadPostAuthorProps {
  author: ThreadAccountAppearance;
  threadId: string;
  subthreadId: string;
  postId: string;
  parentPostId?: string;
  filterReplies?: boolean;
  body?: boolean;
  avatarClassName?: string;
  avatarTextClassName?: string;
  textClassName?: string;
}

function RoleplayAuthor(props: ThreadPostAuthorProps) {
  const { author, threadId, subthreadId, postId, parentPostId, filterReplies } = props;
  const [opened, setOpened] = useState(false);
  const [accessRevoked, setAccessRevoked] = useState(false);
  const { clearThread } = useContentAccessCache();
  const current = useThreadUserIdentity(threadId, author.id, opened && !accessRevoked);
  const error = getApiError(current.error);
  const unavailable = current.isError && (isContentUnavailableError(current.error)
    || error.status === 403 || (error.code !== undefined && error.code >= 40300 && error.code < 40400));
  useEffect(() => { if (unavailable) clearThread(threadId); }, [clearThread, threadId, unavailable]);
  if (unavailable && !accessRevoked) setAccessRevoked(true);
  const { user } = useAuth();
  const { open, close } = useThreadComposerSession();
  const { setAuthorFilter } = useThreadPermissions();
  const appearance = threadAppearance(current.data?.enabled === false ? { ...author, rpIdentity: null } : author);
  if (unavailable || accessRevoked) return null;
  return <ThreadIdentityCard
    account={author} appearance={appearance} historical
    currentName={current.data?.display?.nickname ?? current.data?.account.username}
    loading={opened && current.isFetching} error={current.isError}
    onRetry={() => void current.refetch()} onOpen={() => { if (opened) void current.refetch(); setOpened(true); }}
    avatarClassName={props.avatarClassName} avatarTextClassName={props.avatarTextClassName} textClassName={props.textClassName}
    onFilter={async () => {
      if (await close()) setAuthorFilter({ subthreadId, parentPostId: filterReplies ? parentPostId : undefined, authorId: author.id });
    }}
    onMention={user && current.data && !current.isFetching && !current.isError ? async () => {
      const name = current.data?.display?.nickname ?? author.username;
      const label = name.replace(/([\\`*_[\]<>])/gu, "\\$1");
      if (props.body) {
        await open({ key: "mention-body:" + postId + ":" + author.id, anchorId: "create-floor:" + subthreadId,
          type: "create-floor", subthreadId, label: "提及 @" + name,
          initialContent: "[@" + label + "](/users/" + author.id + ") " });
        return;
      }
      await open({
        key: `mention:${postId}:${author.id}`,
        anchorId: parentPostId === postId ? `create-reply:${postId}` : `reply:${postId}`,
        type: "reply", subthreadId, parentPostId: parentPostId ?? postId,
        replyToPostId: postId, label: `提及 @${name}`,
        initialContent: `[@${label}](/users/${author.id}) `,
      });
    } : undefined}
  />;
}

export function ThreadPostAuthor(props: ThreadPostAuthorProps) {
  const { author, avatarClassName = "size-8", avatarTextClassName = "text-sm", textClassName = "text-sm" } = props;
  const { rpIdentityEnabled } = useThreadPermissions();
  if (rpIdentityEnabled !== false && (author.rpIdentity || rpIdentityEnabled)) return <RoleplayAuthor {...props} />;
  return <>
    <UserAvatarLink userId={author.id} name={author.username} src={author.avatar ?? null}
      display={author.avatarDisplay} className={avatarClassName} textClassName={avatarTextClassName} />
    <Link href={`/users/${author.id}`} className={cn(textClassName, "font-medium text-foreground hover:text-brand-strong")}>
      {author.username}
    </Link>
  </>;
}

"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useApiMeta } from "@/api/hooks/use-api-meta";
import { useRpProfilePost, isProfilePostUnavailable } from "@/api/hooks/use-rp-profile-post";
import type { RpIdentityState } from "@/api/hooks/use-rp-identities";
import type { PostDetail } from "@/api/hooks/use-post";
import { getPostHref } from "@/lib/post-navigation";
import { Button } from "@/components/ui/button";

export function RpIdentityProfile({ threadId, identityId, state, identityPending, identityError, renderBody, onNavigate }: {
  threadId: string; identityId: string; state?: RpIdentityState; identityPending?: boolean; identityError?: boolean;
  renderBody: (post: PostDetail) => ReactNode; onNavigate: () => void;
}) {
  const meta = useApiMeta();
  const supported = meta.data?.capabilities?.rpIdentityProfileSupported === true;
  const ready = supported && !identityPending && !identityError;
  const postId = ready && state?.profilePostStatus === "AVAILABLE" ? state.profilePostId ?? undefined : undefined;
  const post = useRpProfilePost(threadId, identityId, postId, supported);
  if (!ready || !state?.profilePostStatus || state.profilePostStatus === "NONE") return null;
  if (state.profilePostStatus === "UNAVAILABLE" || (post.isError && isProfilePostUnavailable(post.error))) {
    return <p className="mt-4 text-sm text-muted-foreground">资料暂不可用</p>;
  }
  if (post.isError) return <div role="alert" className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
    资料加载失败<Button variant="ghost" size="compact" onClick={() => void post.refetch()}>重试</Button>
  </div>;
  if (!post.data) return <p role="status" className="mt-4 text-sm text-muted-foreground">正在加载资料…</p>;
  const source = post.data;
  const coordinate = source.kind === "BODY" ? "正文" : source.parentPostId
    ? (source.parentPost?.floorNumber ?? "—") + "楼 · " + (source.replyNumber ?? "—") + "回复"
    : (source.floorNumber ?? "—") + "楼";
  return <section className="mt-5 min-w-0 space-y-3" aria-label="角色资料">
    {renderBody(source)}
    <Link href={getPostHref({ threadId, postId: source.id, parentPostId: source.parentPostId })} onClick={onNavigate}
      className="flex min-h-9 min-w-0 items-center gap-1 text-sm text-muted-foreground hover:text-brand-strong">
      <span className="min-w-0 truncate">{source.subthread.title} · {coordinate}</span>
      <ChevronRight className="size-4 shrink-0" aria-hidden />
    </Link>
  </section>;
}

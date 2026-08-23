"use client";

import Link from "next/link";
import { CONTENT_PRESENTATION } from "@wenyousite/foundation/collections";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import type { MomentCard as MomentCardData } from "@/api/hooks/use-moments";
import { useMomentLike } from "@/api/hooks/use-moments";
import { getApiErrorMessage } from "@/api/errors";
import { UserAvatar } from "@/components/shared/user-avatar";
import { WenyouCount } from "@/components/shared/wenyou-count";
import { MomentCover } from "@/components/moment/moment-cover";
import { InteractionToggle } from "@/components/ui/interaction-toggle";
import { useAuth } from "@/lib/auth";
import { markMomentFeedReturn } from "@/lib/moment-navigation";
import { useLoginRedirect } from "@/hooks/use-login-redirect";

export function MomentCard({ moment, priority = false }: { moment: MomentCardData; priority?: boolean }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const redirectToLogin = useLoginRedirect();
  const like = useMomentLike(moment.id, moment.viewerLiked);
  const canToggleLike = moment.canInteract !== false || moment.viewerLiked;

  const requireLogin = () => {
    if (user) return true;
    redirectToLogin();
    return false;
  };

  const toggleLike = async () => {
    if (!canToggleLike || like.isPending || !requireLogin()) return;
    try {
      await like.mutateAsync();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "点赞失败，请稍后重试"));
    }
  };

  return (
    <article
      className="group/moment min-w-0 pb-3"
      data-moment-id={moment.id}
      data-content-purpose={CONTENT_PRESENTATION.list.purpose}
      data-content-surface={CONTENT_PRESENTATION.list.surface}
    >
      <Link
        href={`/moments/${moment.id}`}
        onNavigate={() => markMomentFeedReturn(moment.id, pathname)}
        className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
      >
        <MomentCover moment={moment} priority={priority} />
        <div className="px-0.5 pt-2.5">
          <h2 className="line-clamp-2 text-[0.9375rem] font-semibold leading-6 text-foreground">
            {moment.title}
          </h2>
        </div>
      </Link>

      <div className="mt-1.5 flex min-w-0 items-center gap-2 px-0.5">
        <Link
          href={`/users/${moment.author.id}`}
          className="flex min-w-0 flex-1 items-center gap-1.5 rounded-lg py-1 text-muted-foreground hover:text-foreground"
        >
          <UserAvatar name={moment.author.username} src={moment.author.avatar} className="size-5" textClassName="text-[0.5625rem]" />
          <span className="truncate text-[0.75rem]">{moment.author.username}</span>
        </Link>
        <InteractionToggle
          tone="like"
          pressed={moment.viewerLiked}
          pending={like.isPending}
          disabled={!canToggleLike}
          icon="action.like"
          accessibleName="点赞"
          accessibleDescription={`当前 ${moment.likeCount} 个赞`}
          actionTitle={
            canToggleLike
              ? moment.viewerLiked ? "取消点赞" : "点赞"
              : "作者已注销，历史动态仅供阅读"
          }
          size="compact"
          className="min-h-8 gap-1 rounded-lg px-1.5 text-xs"
          onClick={() => void toggleLike()}
        >
          {moment.likeCount > 0 ? (
            <WenyouCount value={moment.likeCount} label="点赞" />
          ) : null}
        </InteractionToggle>
      </div>
    </article>
  );
}

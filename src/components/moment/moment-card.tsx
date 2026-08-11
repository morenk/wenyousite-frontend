"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { toast } from "sonner";
import type { MomentCard as MomentCardData } from "@/api/hooks/use-moments";
import { useMomentLike } from "@/api/hooks/use-moments";
import { getApiErrorMessage } from "@/api/errors";
import { UserAvatar } from "@/components/shared/user-avatar";
import { MomentCover } from "@/components/moment/moment-cover";
import { useAuth } from "@/lib/auth";
import { markMomentFeedReturn } from "@/lib/moment-navigation";
import { cn } from "@/lib/utils";
import { LIKED_ACTIVE_CLASS_NAME } from "@/lib/like-state";

export function MomentCard({ moment, priority = false }: { moment: MomentCardData; priority?: boolean }) {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const like = useMomentLike(moment.id, moment.viewerLiked);

  const requireLogin = () => {
    if (user) return true;
    router.push(`/login?next=${encodeURIComponent(pathname)}`);
    return false;
  };

  const toggleLike = async () => {
    if (like.isPending || !requireLogin()) return;
    try {
      await like.mutateAsync();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "点赞失败，请稍后重试"));
    }
  };

  return (
    <article className="group/moment min-w-0 pb-3" data-moment-id={moment.id}>
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
        <ActionButton
          label={moment.viewerLiked ? "取消点赞" : "点赞"}
          count={moment.likeCount}
          active={moment.viewerLiked}
          pending={like.isPending}
          onClick={() => void toggleLike()}
        >
          <Heart className={cn(
            "size-4 transition-[color,fill,transform] duration-[var(--motion-fast)] ease-[var(--ease-standard)] motion-safe:group-active/like:scale-90",
            moment.viewerLiked && "fill-current",
          )} />
        </ActionButton>
      </div>
    </article>
  );
}

function ActionButton({
  label,
  count,
  active,
  pending,
  onClick,
  children,
}: {
  label: string;
  count: number;
  active: boolean;
  pending: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={`${label}${count > 0 ? `，${count}` : ""}`}
      aria-pressed={active}
      title={label}
      aria-disabled={pending}
      onClick={() => { if (!pending) onClick(); }}
      className={cn(
        "group/like inline-flex min-h-8 shrink-0 items-center gap-1 rounded-lg px-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground aria-disabled:cursor-wait",
        active && LIKED_ACTIVE_CLASS_NAME,
      )}
    >
      {children}
      {count > 0 ? <span className="font-utility">{count}</span> : null}
    </button>
  );
}

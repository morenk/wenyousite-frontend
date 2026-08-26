import { cn } from "@/lib/utils";
import type { MomentCard } from "@/api/hooks/use-moments";
import { getMomentFeedAspectRatio } from "@/lib/moment-image";

interface MomentCoverProps {
  moment: Pick<MomentCard, "title" | "coverType" | "coverMedia" | "textCoverTheme" | "imageCount">;
  priority?: boolean;
  className?: string;
}

export function MomentCover({ moment, priority = false, className }: MomentCoverProps) {
  if (moment.coverType === "IMAGE" && moment.coverMedia) {
    return (
      <div
        className={cn("relative overflow-hidden rounded-xl bg-muted", className)}
        style={{
          aspectRatio: getMomentFeedAspectRatio(
            moment.coverMedia.width,
            moment.coverMedia.height,
          ),
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- COS 已生成专用信息流图，保留后端尺寸协议 */}
        <img
          src={moment.coverMedia.feedUrl ?? moment.coverMedia.mediumUrl ?? moment.coverMedia.url}
          alt={moment.title}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
          width={moment.coverMedia.width ?? undefined}
          height={moment.coverMedia.height ?? undefined}
          className="h-full w-full object-cover transition-transform duration-[var(--motion-slow)] ease-[var(--ease-standard)] group-hover/moment:scale-[1.025]"
        />
        {moment.imageCount > 1 ? (
          <span className="absolute right-2.5 top-2.5 rounded-full bg-foreground/60 px-2 py-0.5 font-utility text-[0.6875rem] font-bold text-background backdrop-blur-sm">
            {moment.imageCount} 图
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div
      data-cover-theme={moment.textCoverTheme}
      className={cn(
        "moment-text-cover flex aspect-[3/4] items-center overflow-hidden rounded-xl px-4 py-5",
        className,
      )}
    >
      <p className="line-clamp-5 font-display text-[clamp(1.125rem,2vw,1.5rem)] font-medium leading-[1.5] tracking-wide">
        {moment.title}
      </p>
    </div>
  );
}

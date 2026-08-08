import { cn } from "@/lib/utils";
import type { MomentCard } from "@/api/hooks/use-moments";
import { getMomentFeedAspectRatio } from "@/lib/moment-image";

const themeClass = {
  ROSE: "bg-[linear-gradient(145deg,#fff8fb_0%,#f3c6dd_100%)] text-[#67465a]",
  LILAC: "bg-[linear-gradient(145deg,#fafaff_0%,#c7ccff_100%)] text-[#464d78]",
  MINT: "bg-[linear-gradient(145deg,#fbfffc_0%,#c8e8d6_100%)] text-[#365d49]",
  AMBER: "bg-[linear-gradient(145deg,#fffdf7_0%,#f7e7a9_100%)] text-[#66551b]",
} satisfies Record<MomentCard["textCoverTheme"], string>;

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
          <span className="absolute right-2.5 top-2.5 rounded-full bg-black/55 px-2 py-0.5 font-utility text-[0.6875rem] font-bold text-white backdrop-blur-sm">
            {moment.imageCount} 图
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative flex aspect-[3/4] items-center overflow-hidden rounded-xl px-6 py-7",
        themeClass[moment.textCoverTheme],
        className,
      )}
    >
      <span className="absolute left-5 top-5 font-display text-xs font-medium tracking-[0.18em] opacity-55">
        温油便笺
      </span>
      <p className="line-clamp-5 font-display text-[clamp(1.35rem,2.2vw,1.8rem)] font-bold leading-[1.55] tracking-wide">
        {moment.title}
      </p>
      <span className="absolute bottom-5 right-5 size-3 rounded-full bg-current opacity-25" aria-hidden="true" />
    </div>
  );
}

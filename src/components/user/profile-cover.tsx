"use client";

import { useState } from "react";
import { ImageOff } from "lucide-react";
import type { components } from "@/api/types";
import { cn } from "@/lib/utils";

export type ProfileCoverMedia = components["schemas"]["ProfileCoverResponseDto"];
export type ProfileCoverVariantMedia =
  components["schemas"]["ProfileCoverVariantResponseDto"];

export type ProfileCoverSurface = "web" | "mobile";

const PROFILE_COVER_SIZES =
  "(min-width: 672px) 648px, (min-width: 640px) calc(100vw - 24px), calc(100vw - 16px)";

interface ProfileCoverProps {
  cover: ProfileCoverVariantMedia | null;
  username: string;
  surface?: ProfileCoverSurface;
  className?: string;
}

/** 个人主页背景墙；按展示端使用对应画幅，并按 DPR 自适应选择中图或高清原图。 */
export function ProfileCover({
  cover,
  username,
  surface = "web",
  className,
}: ProfileCoverProps) {
  const source = cover?.url ?? null;
  const originalWidth = cover?.width ?? null;
  const responsiveSource =
    cover?.mediumUrl && originalWidth !== null && originalWidth > 800
      ? `${cover.mediumUrl} 800w, ${cover.url} ${originalWidth}w`
      : undefined;
  const [originalFallbackSource, setOriginalFallbackSource] = useState<string | null>(null);
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const usesOriginalFallback = source !== null && source === originalFallbackSource;
  const failed = source !== null && source === failedSource;

  return (
    <div
      data-slot="profile-cover"
      data-surface={surface}
      className={cn(
        "relative w-full overflow-hidden bg-secondary/70",
        surface === "mobile" ? "aspect-2/1" : "aspect-3/1",
        className,
      )}
    >
      {source && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={source}
          srcSet={usesOriginalFallback ? undefined : responsiveSource}
          sizes={responsiveSource && !usesOriginalFallback ? PROFILE_COVER_SIZES : undefined}
          alt={
            surface === "mobile"
              ? `${username} 的移动端主页背景`
              : `${username} 的主页背景`
          }
          width={cover?.width ?? undefined}
          height={cover?.height ?? undefined}
          className="h-full w-full object-cover"
          onError={() => {
            if (responsiveSource && !usesOriginalFallback) {
              setOriginalFallbackSource(source);
              return;
            }
            setFailedSource(source);
          }}
        />
      ) : failed ? (
        <div
          role="status"
          className="flex h-full items-center justify-center gap-2 text-xs text-muted-foreground"
        >
          <ImageOff className="size-4" aria-hidden="true" />
          背景图加载失败
        </div>
      ) : (
        <div className="h-full w-full bg-secondary/70" aria-hidden="true" />
      )}
    </div>
  );
}

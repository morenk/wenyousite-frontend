"use client";

import { useState } from "react";
import { ImageOff } from "lucide-react";
import type { components } from "@/api/types";
import { cn } from "@/lib/utils";

export type ProfileCoverMedia = components["schemas"]["ProfileCoverResponseDto"];

const PROFILE_COVER_SIZES =
  "(min-width: 672px) 648px, (min-width: 640px) calc(100vw - 24px), calc(100vw - 16px)";

interface ProfileCoverProps {
  cover: ProfileCoverMedia | null;
  username: string;
  className?: string;
}

/** 固定 3:1 的个人主页背景墙；按视口与 DPR 自适应选择中图或高清原图。 */
export function ProfileCover({ cover, username, className }: ProfileCoverProps) {
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
      className={cn(
        "relative aspect-3/1 w-full overflow-hidden bg-secondary/70",
        className,
      )}
    >
      {source && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={source}
          srcSet={usesOriginalFallback ? undefined : responsiveSource}
          sizes={responsiveSource && !usesOriginalFallback ? PROFILE_COVER_SIZES : undefined}
          alt={`${username} 的主页背景`}
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

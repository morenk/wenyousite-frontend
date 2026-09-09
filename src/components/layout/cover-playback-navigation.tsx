"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { coverPlayback } from "@/hooks/cover-playback";

/** 提交后的路径/筛选变化撤销旧定时器，重新等待列表停稳。 */
export function CoverPlaybackNavigation() {
  const pathname = usePathname();
  const search = useSearchParams();
  useEffect(() => {
    coverPlayback.resumeRoute();
    return () => coverPlayback.suspendRoute();
  }, [pathname, search]);
  return null;
}

"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { coverPlayback } from "@/hooks/cover-playback";

/** 路径/筛选提交时释放旧页实例，新页按可见性播放；网络等待期间可见旧页保持。 */
export function CoverPlaybackNavigation() {
  const pathname = usePathname();
  const search = useSearchParams();
  useEffect(() => {
    coverPlayback.resumeRoute();
    return () => coverPlayback.suspendRoute();
  }, [pathname, search]);
  return null;
}

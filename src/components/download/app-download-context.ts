"use client";

import { createContext, useContext } from "react";
import type { useAppDownload } from "@/api/hooks/use-app-download";

export const AppDownloadContext = createContext<ReturnType<typeof useAppDownload> | null>(null);

export function useAppDownloadContext() {
  const context = useContext(AppDownloadContext);
  if (!context) throw new Error("APP 下载入口必须位于 AppDownloadProvider 内");
  return context;
}

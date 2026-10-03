"use client";

import { QueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { useAppDownload } from "@/api/hooks/use-app-download";

import { MobileDownloadPrompt } from "./mobile-download-prompt";
import { AppDownloadContext } from "./app-download-context";

/** 公开下载独立于登录身份缓存和菜单生命周期，SPA 导航不会移除下载框架。 */
export function AppDownloadProvider({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient());
  const download = useAppDownload(client);
  return <AppDownloadContext.Provider value={download}>
    {children}
    <MobileDownloadPrompt />
    {download.downloads.map(({ id, path }) => <iframe key={id} title={`Android 安装包下载 ${id}`} src={path} sandbox="allow-downloads allow-same-origin" hidden />)}
  </AppDownloadContext.Provider>;
}

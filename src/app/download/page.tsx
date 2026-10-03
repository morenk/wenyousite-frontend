import type { Metadata } from "next";
import { DownloadPage } from "@/components/download/download-page";

export const metadata: Metadata = {
  title: "下载 APP · 温油站",
  description: "下载温油站 Android APP，查看最新版本、安装包大小与安装说明。",
};

export default function AppDownloadPage() {
  return <DownloadPage />;
}

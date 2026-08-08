import type { Metadata } from "next";
import "@fontsource/lxgw-wenkai/500.css";
import "@fontsource/lxgw-wenkai/700.css";
import "@fontsource-variable/noto-sans-sc/wght.css";
import "@fontsource-variable/nunito/wght.css";
import "./globals.css";
import { Providers } from "./providers";
import { AppChrome } from "@/components/layout/app-chrome";

export const metadata: Metadata = {
  title: "温油站",
  description: "演绎、国策与 RPG 主题帖社区",
};

export default function RootLayout({
  children,
  modal,
}: Readonly<{
  children: React.ReactNode;
  modal?: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-screen">
        <Providers>
          <AppChrome>{children}</AppChrome>
          {modal}
        </Providers>
      </body>
    </html>
  );
}

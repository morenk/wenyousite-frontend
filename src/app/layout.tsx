import type { Metadata } from "next";
import "@wenyousite/foundation/web/fonts.css";
import "@wenyousite/foundation/web/tokens.css";
import "yet-another-react-lightbox/styles.css";
import "./globals.css";
import { Providers } from "./providers";
import { AppChrome } from "@/components/layout/app-chrome";

export const metadata: Metadata = {
  title: "温油站",
  description: "面向文字共同创作的主题帖社区",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-screen">
        <Providers>
          <AppChrome>{children}</AppChrome>
        </Providers>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { headers } from "next/headers";
import { BRAND_NAME, BRAND_TAGLINE } from "@wenyousite/foundation/brand";
import "@wenyousite/foundation/web/tokens.css";
import "yet-another-react-lightbox/styles.css";
import "./globals.css";
import { previewBootstrap } from "@/lib/preview-session";
import { PreviewBoundary } from "@/components/layout/preview-boundary";
import { PreviewBadge } from "@/components/layout/preview-badge";
import { Providers } from "./providers";
import { AppChrome } from "@/components/layout/app-chrome";
import { THEME_BOOTSTRAP_SCRIPT } from "@/lib/theme-bootstrap";
import { FOUNDATION_FONT_VARIABLES } from "@/lib/typography";

export const metadata: Metadata = {
  applicationName: BRAND_NAME,
  title: BRAND_NAME,
  description: BRAND_TAGLINE,
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-48x48.png", sizes: "48x48", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html lang="zh-CN" className="h-full antialiased" style={FOUNDATION_FONT_VARIABLES} suppressHydrationWarning>
      <head>
        {process.env.WENYOU_PREVIEW_RUN ? <script id="preview-bootstrap" nonce={nonce} dangerouslySetInnerHTML={{ __html: previewBootstrap({
          runId: process.env.WENYOU_PREVIEW_RUN,
          webSessionId: process.env.WENYOU_PREVIEW_WEB_SESSION ?? "",
          sessionId: process.env.WENYOU_PREVIEW_SESSION ?? "",
          task: process.env.WENYOU_PREVIEW_TASK ?? "",
          webOrigin: "http://127.0.0.1:14310",
          mediaOrigin: process.env.WENYOU_PREVIEW_MEDIA_ORIGIN ?? "",
        }) }} /> : null}
        <script
          id="theme-bootstrap"
          nonce={nonce}
          dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }}
        />
      </head>
      <body className="min-h-screen">
        {process.env.WENYOU_PREVIEW_RUN ? <PreviewBadge snapshot={process.env.WENYOU_PREVIEW_SNAPSHOT} /> : null}
        <PreviewBoundary><Providers>
          <AppChrome>{children}</AppChrome>
        </Providers></PreviewBoundary>
      </body>
    </html>
  );
}

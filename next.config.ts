import type { NextConfig } from "next";
import { candidateHeaders, candidateOptions } from "./scripts/e2e-candidate-policy.mjs";

import { previewConfig } from "./scripts/dev-preview-policy.mjs";

const preview = previewConfig(process.env);
const backendUrl = process.env.BACKEND_URL || "http://127.0.0.1:3000";
const isDevelopment = process.env.NODE_ENV === "development";

const securityHeaders = [
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ...candidateHeaders(process.env),
  ...(preview ? [{ key: "X-Wenyou-Preview-Run", value: preview.runId }] : []),
  ...(isDevelopment
    ? []
    : [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]),
];

const nextConfig: NextConfig = {
  ...candidateOptions(process.env),
  ...(preview ? { distDir: ".next-preview", typescript: { tsconfigPath: "tsconfig.preview.json" } } : {}),
  env: {
    NEXT_PUBLIC_WENYOU_PREVIEW_RUN: preview?.runId ?? "",
    NEXT_PUBLIC_WENYOU_PREVIEW_MEDIA_ORIGIN: preview?.mediaOrigin ?? "",
  },
  output: "standalone",
  devIndicators: process.env.DISABLE_NEXT_DEV_INDICATORS === "true" ? false : undefined,
  allowedDevOrigins: ["wenyou.site", "127.0.0.1", "localhost"],
  images: {
    unoptimized: true,
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
  async rewrites() {
    return [
      ...(preview ? [{ source: "/__preview/identity", destination: `${backendUrl}/__preview/identity` }] : []),
      {
        source: "/api/v1/:path*",
        destination: `${backendUrl}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;

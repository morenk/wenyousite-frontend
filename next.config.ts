import type { NextConfig } from "next";
import { candidateHeaders, candidateOptions } from "./scripts/e2e-candidate-policy.mjs";

// 旧会话必须停止后以普通开发入口重新启动，不能静默丢失原来的隔离身份。
if (Object.keys(process.env).some((key) => /^(NEXT_PUBLIC_)?WENYOU_PREVIEW_/.test(key))) {
  throw new Error("隔离开发预览已退役；请移除旧 WENYOU_PREVIEW_* 配置并明确 BACKEND_URL 后重新启动");
}

const isDevelopment = process.env.NODE_ENV === "development";
const backendUrl = process.env.BACKEND_URL || (isDevelopment ? undefined : "http://127.0.0.1:3000");
if (!backendUrl) {
  throw new Error("开发服务需要显式设置 BACKEND_URL；请确认实际后端与数据环境");
}

const securityHeaders = [
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ...candidateHeaders(process.env),
  ...(isDevelopment
    ? []
    : [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]),
];

const nextConfig: NextConfig = {
  ...candidateOptions(process.env),
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
      {
        source: "/api/v1/:path*",
        destination: `${backendUrl}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;

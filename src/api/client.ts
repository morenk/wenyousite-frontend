import createClient from "openapi-fetch";
import type { paths } from "./types";

function getBaseUrl() {
  if (typeof window === "undefined") {
    return process.env.BACKEND_URL || "http://127.0.0.1:3000";
  }
  return "";
}

export const apiClient = createClient<paths>({ baseUrl: getBaseUrl() });

apiClient.use({
  onRequest({ request }) {
    if (typeof window === "undefined") return;

    const token = localStorage.getItem("accessToken");
    if (token) {
      request.headers.set("Authorization", `Bearer ${token}`);
    }
    request.headers.set("X-Client-Platform", "web");
  },
});

/** 这些端点用 HTTP 401 表示业务错误（凭证/验证码错误），需由页面 toast 提示，不能当会话过期处理 */
const BUSINESS_401_PATHS = new Set([
  "/api/v1/auth/login",
  "/api/v1/auth/register/verify-and-complete",
  "/api/v1/auth/reset-password",
  "/api/v1/auth/verify-email",
  "/api/v1/auth/change-password",
  "/api/v1/auth/change-email/request-code",
  "/api/v1/auth/change-email/verify",
]);

/**
 * 401 时判断是否应按会话过期处理（清除登录态并跳转登录页）。
 * 业务 401（如密码错误）或未携带 accessToken 的请求交由页面自行处理。
 */
export function isSessionExpired401(
  status: number,
  schemaPath: string,
  authHeader: string | null,
): boolean {
  return status === 401 && !BUSINESS_401_PATHS.has(schemaPath) && authHeader !== null;
}

apiClient.use({
  onResponse({ response, request, schemaPath }) {
    if (typeof window === "undefined") return;
    if (isSessionExpired401(response.status, schemaPath, request.headers.get("Authorization"))) {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("user");
      window.dispatchEvent(new Event("auth-change"));
      window.location.href = "/login";
    }
  },
});

export type ApiClient = typeof apiClient;

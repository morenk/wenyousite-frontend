import createClient from "openapi-fetch";
import type { paths } from "./types";

interface RefreshEnvelope {
  data?: {
    accessToken?: string;
    user?: unknown;
  };
}

function getBaseUrl() {
  if (typeof window === "undefined") {
    return process.env.BACKEND_URL || "http://127.0.0.1:3000";
  }
  return "";
}

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

/** 清除本地认证状态；仅浏览器执行。 */
function clearStoredAuth() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("accessToken");
  localStorage.removeItem("user");
  window.dispatchEvent(new Event("auth-change"));
}

/** 创建支持 refresh cookie 单飞轮换与原请求重放的 fetch。 */
export function createAuthenticatedFetch(fetchImpl: typeof fetch): typeof fetch {
  let refreshPromise: Promise<string | null> | null = null;

  const refreshAccessToken = async (origin: string): Promise<string | null> => {
    const response = await fetchImpl(`${origin}/api/v1/auth/refresh`, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        "X-Client-Platform": "web",
      },
      body: "{}",
    });
    if (!response.ok) return null;

    const envelope = (await response.json()) as RefreshEnvelope;
    const accessToken = envelope.data?.accessToken;
    if (!accessToken) return null;
    localStorage.setItem("accessToken", accessToken);
    if (envelope.data?.user) {
      localStorage.setItem("user", JSON.stringify(envelope.data.user));
    }
    window.dispatchEvent(new Event("auth-change"));
    return accessToken;
  };

  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    const retryRequest = request.clone();
    const response = await fetchImpl(request);
    if (typeof window === "undefined") return response;

    const schemaPath = new URL(request.url).pathname;
    if (
      !isSessionExpired401(
        response.status,
        schemaPath,
        request.headers.get("Authorization"),
      )
    ) {
      return response;
    }

    refreshPromise ??= refreshAccessToken(new URL(request.url).origin).finally(() => {
      refreshPromise = null;
    });
    const accessToken = await refreshPromise;
    if (!accessToken) {
      clearStoredAuth();
      window.location.href = "/login";
      return response;
    }

    const headers = new Headers(retryRequest.headers);
    headers.set("Authorization", `Bearer ${accessToken}`);
    return fetchImpl(new Request(retryRequest, { headers }));
  };
}

const authenticatedFetch = createAuthenticatedFetch(globalThis.fetch);

export const apiClient = createClient<paths>({
  baseUrl: getBaseUrl(),
  fetch: authenticatedFetch,
});

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

export type ApiClient = typeof apiClient;

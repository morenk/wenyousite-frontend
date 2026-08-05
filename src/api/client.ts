import createClient from "openapi-fetch";
import type { paths } from "./types";

interface RefreshEnvelope {
  data?: {
    accessToken?: string;
    user?: unknown;
  };
}

type RefreshOutcome =
  | { status: "ready"; accessToken: string; userId: string | null }
  | { status: "failed" }
  | { status: "identity-changed" };

function getStoredUserId(): string | null {
  try {
    const storedUser = localStorage.getItem("user");
    if (!storedUser) return null;
    const user = JSON.parse(storedUser) as { id?: unknown };
    return typeof user.id === "string" ? user.id : null;
  } catch {
    return null;
  }
}

function getResponseUserId(user: unknown): string | null {
  if (typeof user !== "object" || user === null || !("id" in user)) return null;
  return typeof user.id === "string" ? user.id : null;
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
  let refreshPromise: Promise<RefreshOutcome> | null = null;

  const refreshAccessToken = async (
    origin: string,
    expectedUserId: string | null,
  ): Promise<RefreshOutcome> => {
    const response = await fetchImpl(`${origin}/api/v1/auth/refresh`, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        "X-Client-Platform": "web",
      },
      body: "{}",
    });
    if (!response.ok) {
      return getStoredUserId() === expectedUserId
        ? { status: "failed" }
        : { status: "identity-changed" };
    }

    const envelope = (await response.json()) as RefreshEnvelope;
    if (getStoredUserId() !== expectedUserId) return { status: "identity-changed" };
    const accessToken = envelope.data?.accessToken;
    if (!accessToken) return { status: "failed" };
    const responseUserId = getResponseUserId(envelope.data?.user);
    if (
      expectedUserId !== null &&
      responseUserId !== null &&
      responseUserId !== expectedUserId
    ) {
      return { status: "identity-changed" };
    }
    localStorage.setItem("accessToken", accessToken);
    if (envelope.data?.user) {
      localStorage.setItem("user", JSON.stringify(envelope.data.user));
    }
    window.dispatchEvent(new Event("auth-change"));
    return {
      status: "ready",
      accessToken,
      userId: responseUserId ?? expectedUserId,
    };
  };

  const refreshAcrossTabs = async (
    origin: string,
    accessTokenAtFailure: string | null,
    expectedUserId: string | null,
  ): Promise<RefreshOutcome> => {
    const refresh = async () => {
      if (getStoredUserId() !== expectedUserId) {
        return { status: "identity-changed" } as const;
      }
      const latestAccessToken = localStorage.getItem("accessToken");
      if (
        accessTokenAtFailure &&
        latestAccessToken &&
        latestAccessToken !== accessTokenAtFailure
      ) {
        return {
          status: "ready",
          accessToken: latestAccessToken,
          userId: expectedUserId,
        } as const;
      }
      return refreshAccessToken(origin, expectedUserId);
    };

    if (!navigator.locks) return refresh();
    return navigator.locks.request("wenyousite-auth-refresh", refresh);
  };

  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    const retryRequest = request.clone();
    const userIdAtRequest = typeof window === "undefined" ? null : getStoredUserId();
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

    const failedAuthorization = request.headers.get("Authorization");
    const accessTokenAtFailure = failedAuthorization?.startsWith("Bearer ")
      ? failedAuthorization.slice("Bearer ".length)
      : null;
    refreshPromise ??= refreshAcrossTabs(
      new URL(request.url).origin,
      accessTokenAtFailure,
      userIdAtRequest,
    ).finally(() => {
      refreshPromise = null;
    });
    const refreshOutcome = await refreshPromise;
    if (
      refreshOutcome.status === "identity-changed" ||
      (refreshOutcome.status === "ready" &&
        ((userIdAtRequest !== null &&
          refreshOutcome.userId !== userIdAtRequest) ||
          getStoredUserId() !== refreshOutcome.userId))
    ) {
      return response;
    }
    if (refreshOutcome.status === "failed") {
      clearStoredAuth();
      window.location.href = "/login";
      return response;
    }

    const headers = new Headers(retryRequest.headers);
    headers.set("Authorization", `Bearer ${refreshOutcome.accessToken}`);
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

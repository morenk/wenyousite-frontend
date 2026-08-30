import createClient from "openapi-fetch";
import type { paths } from "./types";
import {
  clearAuthSession,
  getAuthAccessToken,
  getAuthSnapshot,
  getKnownUserId,
  isAuthUser,
  setAuthSession,
} from "@/lib/auth-store";
import { API_ERROR_CODE } from "@/api/errors";

interface RefreshEnvelope {
  data?: {
    accessToken?: string;
    user?: unknown;
  };
}

type RefreshOutcome =
  | { status: "ready"; accessToken: string; userId: string | null }
  | { status: "rejected" }
  | { status: "unavailable" }
  | { status: "identity-changed" };

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
  errorCode?: number,
): boolean {
  return status === 401 &&
    errorCode === API_ERROR_CODE.TOKEN_EXPIRED &&
    !BUSINESS_401_PATHS.has(schemaPath) &&
    authHeader !== null;
}

const TERMINAL_SESSION_CODES = new Set<number>([
  API_ERROR_CODE.TOKEN_INVALID,
  API_ERROR_CODE.TOKEN_REVOKED,
  API_ERROR_CODE.TOKEN_THEFT_DETECTED,
  API_ERROR_CODE.ACCOUNT_LOCKED,
  API_ERROR_CODE.ACCOUNT_DEACTIVATED,
]);

export function isTerminalSession401(
  status: number,
  authHeader: string | null,
  errorCode?: number,
): boolean {
  return status === 401 && authHeader !== null &&
    errorCode !== undefined && TERMINAL_SESSION_CODES.has(errorCode);
}

async function readErrorCode(response: Response): Promise<number | undefined> {
  if (response.status !== 401) return undefined;
  try {
    const body = await response.clone().json() as { code?: unknown };
    return typeof body.code === "number" ? body.code : undefined;
  } catch {
    return undefined;
  }
}

/** 清除本地认证状态；仅浏览器执行。 */
function clearStoredAuth() {
  if (typeof window === "undefined") return;
  clearAuthSession();
}

function redirectToLogin() {
  if (typeof window === "undefined") return;
  window.location.href = new URL("/login", window.location.origin).toString();
}

async function requestRefresh(
  fetchImpl: typeof fetch,
  origin: string,
  expectedUserId: string | null,
): Promise<RefreshOutcome> {
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
    if (getKnownUserId() !== expectedUserId) {
      return { status: "identity-changed" };
    }
    return response.status === 401
      ? { status: "rejected" }
      : { status: "unavailable" };
  }

  const envelope = (await response.json()) as RefreshEnvelope;
  if (getKnownUserId() !== expectedUserId) return { status: "identity-changed" };
  const accessToken = envelope.data?.accessToken;
  if (!accessToken) return { status: "unavailable" };

  const responseUserId = getResponseUserId(envelope.data?.user);
  if (
    expectedUserId !== null &&
    responseUserId !== null &&
    responseUserId !== expectedUserId
  ) {
    return { status: "identity-changed" };
  }
  const currentUser = getAuthSnapshot().user;
  const user = isAuthUser(envelope.data?.user)
    ? envelope.data.user
    : currentUser?.id === (responseUserId ?? expectedUserId)
      ? currentUser
      : null;
  if (!user) return { status: "unavailable" };

  setAuthSession(user, accessToken, { announce: false });
  return {
    status: "ready",
    accessToken,
    userId: user.id,
  };
}

async function refreshWithLock(
  fetchImpl: typeof fetch,
  origin: string,
  accessTokenAtFailure: string | null,
  expectedUserId: string | null,
): Promise<RefreshOutcome> {
  const refresh = async () => {
    if (getKnownUserId() !== expectedUserId) {
      return { status: "identity-changed" } as const;
    }
    const latestAccessToken = getAuthAccessToken();
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
    return requestRefresh(fetchImpl, origin, expectedUserId);
  };

  if (!navigator.locks) return refresh();
  return navigator.locks.request("wenyousite-auth-refresh", refresh);
}

let bootstrapPromise: Promise<RefreshOutcome> | null = null;

/** 页面启动时用 httpOnly refresh cookie 恢复仅驻留内存的 access token。 */
export async function bootstrapAuthSession(): Promise<void> {
  if (typeof window === "undefined" || getAuthAccessToken()) return;
  const expectedUserId = getKnownUserId();
  bootstrapPromise ??= refreshWithLock(
    globalThis.fetch,
    window.location.origin,
    null,
    expectedUserId,
  ).finally(() => {
    bootstrapPromise = null;
  });
  const outcome = await bootstrapPromise;
  if (outcome.status === "rejected") clearStoredAuth();
}

/** 创建支持 refresh cookie 单飞轮换与原请求重放的 fetch。 */
export function createAuthenticatedFetch(fetchImpl: typeof fetch): typeof fetch {
  let refreshPromise: Promise<RefreshOutcome> | null = null;

  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    const retryRequest = request.clone();
    const userIdAtRequest = typeof window === "undefined" ? null : getKnownUserId();
    const response = await fetchImpl(request);
    if (typeof window === "undefined") return response;

    const schemaPath = new URL(request.url).pathname;
    const errorCode = await readErrorCode(response);
    const authorization = request.headers.get("Authorization");
    if (
      isTerminalSession401(response.status, authorization, errorCode) &&
      getKnownUserId() === userIdAtRequest
    ) {
      clearStoredAuth();
      redirectToLogin();
      return response;
    }
    if (
      !isSessionExpired401(
        response.status,
        schemaPath,
        authorization,
        errorCode,
      )
    ) {
      return response;
    }

    const failedAuthorization = request.headers.get("Authorization");
    const accessTokenAtFailure = failedAuthorization?.startsWith("Bearer ")
      ? failedAuthorization.slice("Bearer ".length)
      : null;
    refreshPromise ??= refreshWithLock(
      fetchImpl,
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
          getKnownUserId() !== refreshOutcome.userId))
    ) {
      return response;
    }
    if (refreshOutcome.status === "rejected") {
      clearStoredAuth();
      redirectToLogin();
      return response;
    }
    if (refreshOutcome.status === "unavailable") return response;

    const headers = new Headers(retryRequest.headers);
    headers.set("Authorization", `Bearer ${refreshOutcome.accessToken}`);
    return fetchImpl(new Request(retryRequest, { headers }));
  };
}

// 延迟读取全局 fetch，让浏览器补丁与 MSW 测试拦截器都能在运行时生效。
const authenticatedFetch = createAuthenticatedFetch((input, init) =>
  globalThis.fetch(input, init));

// 管理端 CSRF token 只驻留当前页面内存；管理员会话本身由 HttpOnly Cookie 保存。
let adminCsrfToken: string | null = null;

export function setAdminCsrfToken(token: string | null) {
  adminCsrfToken = token;
}

export const apiClient = createClient<paths>({
  baseUrl: getBaseUrl(),
  fetch: authenticatedFetch,
});

apiClient.use({
  onRequest({ request }) {
    if (typeof window === "undefined") return;

    const token = getAuthAccessToken();
    if (token) {
      request.headers.set("Authorization", `Bearer ${token}`);
    }
    request.headers.set("X-Client-Platform", "web");
    const url = new URL(request.url);
    if (
      adminCsrfToken &&
      url.pathname.startsWith("/api/v1/admin/") &&
      ["POST", "PUT", "PATCH", "DELETE"].includes(request.method)
    ) {
      request.headers.set("X-CSRF-Token", adminCsrfToken);
    }
  },
});

export type ApiClient = typeof apiClient;

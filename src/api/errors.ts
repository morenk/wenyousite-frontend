/** 前端统一 API 错误模型：隔离 openapi-fetch、原生 Error 和未知抛出值。 */

import type { components } from "@/api/types";

type BusinessErrorCode = components["schemas"]["BusinessErrorCode"];

export interface ApiErrorInfo {
  code?: number;
  message?: string;
  status?: number;
}

export const API_ERROR_CODE = {
  BAD_REQUEST: 40001,
  OPTIMISTIC_LOCK_CONFLICT: 40002,
  INVALID_CURSOR: 40007,
  UNAUTHORIZED: 40100,
  TOKEN_EXPIRED: 40101,
  TOKEN_INVALID: 40102,
  TOKEN_REVOKED: 40103,
  TOKEN_THEFT_DETECTED: 40104,
  ACCOUNT_LOCKED: 40105,
  ACCOUNT_DEACTIVATED: 40106,
  CONFLICT: 40900,
  IDEMPOTENCY_KEY_REUSED: 40912,
  RATE_LIMITED: 42900,
} as const satisfies Record<string, BusinessErrorCode>;

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}

export function getApiError(error: unknown): ApiErrorInfo {
  const record = asRecord(error);
  if (!record) {
    return typeof error === "string" ? { message: error } : {};
  }

  const code = typeof record.code === "number" ? record.code : undefined;
  const message = typeof record.message === "string" ? record.message : undefined;
  const status = typeof record.status === "number"
    ? record.status
    : typeof record.statusCode === "number"
      ? record.statusCode
      : undefined;
  return { code, message, status };
}

export function getApiErrorMessage(error: unknown, fallback: string): string {
  return getApiError(error).message || fallback;
}

export function hasApiErrorCode(error: unknown, code: number): boolean {
  return getApiError(error).code === code;
}

const CONTENT_UNAVAILABLE_ERROR_CODES = new Set([
  40400, // 通用资源不存在
  40402, // 主题帖不存在（也用于隐藏私密帖）
  40403, // 楼层不存在
  40404, // 子贴不存在
  40408, // 邀请失效
  40415, // 动态或动态评论不存在
]);

/**
 * 仅把内容/邀请本身不可用视为失效。
 *
 * 业务错误体通常没有 HTTP status；40302/40303 等角色限制必须保留原提示，
 * 不能因为同属 403xx 就清空编辑器。没有业务码的裸 403 则按访问已失效处理。
 */
export function isContentUnavailableError(error: unknown): boolean {
  const { code, status } = getApiError(error);
  return status === 404 ||
    (status === 403 && code === undefined) ||
    (code !== undefined && CONTENT_UNAVAILABLE_ERROR_CODES.has(code));
}

/** 业务错误由页面处理；仅无响应码的传输异常自动快速重试一次。 */
export function shouldRetryContentQuery(failureCount: number, error: unknown): boolean {
  const { code, status } = getApiError(error);
  if (code !== undefined || status !== undefined) return false;
  return error instanceof TypeError && failureCount < 1;
}

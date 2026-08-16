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
  const status = typeof record.status === "number" ? record.status : undefined;
  return { code, message, status };
}

export function getApiErrorMessage(error: unknown, fallback: string): string {
  return getApiError(error).message || fallback;
}

export function hasApiErrorCode(error: unknown, code: number): boolean {
  return getApiError(error).code === code;
}

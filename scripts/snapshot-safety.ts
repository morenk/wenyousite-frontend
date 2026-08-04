/** API 快照安全工具：限制目标环境并对持久化内容做递归脱敏 */

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);
const SENSITIVE_KEYS = /(?:access.?token|refresh.?token|password|secret|authorization|cookie|invite.?token)/i;
const EMAIL_KEYS = /(?:^|_)email$/i;
const DEVICE_KEYS = /(?:ip(?:address)?|deviceinfo|useragent)/i;
const JWT_PATTERN = /eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g;
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const UUID_PATTERN = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;
const CUID_PATTERN = /\bc[a-z0-9]{20,}\b/g;

/** 拒绝未明确标记为测试环境的目标，远程测试环境还需二次确认 */
export function assertSafeSnapshotTarget(baseUrl: string, env: Readonly<Record<string, string | undefined>>): URL {
  if (env.API_SNAPSHOT_ENV !== "test") {
    throw new Error("API_SNAPSHOT_ENV 必须显式设为 test");
  }
  if (!env.TEST_EMAIL || !env.TEST_PASS) {
    throw new Error("必须通过 TEST_EMAIL 和 TEST_PASS 提供专用测试账号");
  }

  const target = new URL(baseUrl);
  if (target.protocol !== "http:" && target.protocol !== "https:") {
    throw new Error("API_BASE 只允许 http/https 地址");
  }
  if (!LOOPBACK_HOSTS.has(target.hostname) && env.API_SNAPSHOT_REMOTE_HOST !== target.hostname) {
    throw new Error("远程测试环境必须通过 API_SNAPSHOT_REMOTE_HOST 精确声明目标主机");
  }
  return target;
}

function sanitizeString(value: string): string {
  return value
    .replace(JWT_PATTERN, "<redacted-token>")
    .replace(EMAIL_PATTERN, "<redacted-email>")
    .replace(UUID_PATTERN, "<redacted-id>")
    .replace(CUID_PATTERN, "<redacted-id>");
}

/** 对请求、响应和动态标签中的凭据、PII 与稳定标识符做递归脱敏 */
export function sanitizeSnapshotValue(value: unknown, key = ""): unknown {
  if (SENSITIVE_KEYS.test(key)) return "<redacted>";
  if (EMAIL_KEYS.test(key)) return "<redacted-email>";
  if (DEVICE_KEYS.test(key)) return "<redacted-device>";
  if (typeof value === "string") return sanitizeString(value);
  if (Array.isArray(value)) return value.map((item) => sanitizeSnapshotValue(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([childKey, childValue]) => [
        sanitizeString(childKey),
        sanitizeSnapshotValue(childValue, childKey),
      ]),
    );
  }
  return value;
}

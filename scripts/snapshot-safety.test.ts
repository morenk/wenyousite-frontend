/** API 快照安全工具测试：覆盖环境保护和敏感字段脱敏 */

import { describe, expect, test } from "vitest";
import { assertSafeSnapshotTarget, sanitizeSnapshotValue } from "./snapshot-safety";

const TEST_ENV = {
  API_SNAPSHOT_ENV: "test",
  TEST_EMAIL: "snapshot@example.com",
  TEST_PASS: "test-password",
};

describe("assertSafeSnapshotTarget", () => {
  test("允许显式测试环境连接本机服务", () => {
    expect(assertSafeSnapshotTarget("http://127.0.0.1:3000", TEST_ENV).hostname).toBe("127.0.0.1");
  });

  test("拒绝没有测试环境标记的调用", () => {
    expect(() => assertSafeSnapshotTarget("http://127.0.0.1:3000", { ...TEST_ENV, API_SNAPSHOT_ENV: undefined })).toThrow(
      /API_SNAPSHOT_ENV/,
    );
  });

  test("拒绝未二次确认的远程地址", () => {
    expect(() => assertSafeSnapshotTarget("https://api.example.com", TEST_ENV)).toThrow(/远程测试环境/);
  });

  test("允许精确声明的远程测试主机", () => {
    expect(
      assertSafeSnapshotTarget("https://staging.example.com", {
        ...TEST_ENV,
        API_SNAPSHOT_REMOTE_HOST: "staging.example.com",
      }).hostname,
    ).toBe("staging.example.com");
  });
});

describe("sanitizeSnapshotValue", () => {
  test("递归脱敏凭据、邮箱、设备和动态标识符", () => {
    expect(
      sanitizeSnapshotValue({
        accessToken: "eyJheader.payload.signature",
        refreshToken: "11111111-1111-4111-8111-111111111111",
        email: "snapshot@example.com",
        deviceInfo: "node-test-agent",
        user: { id: "cms7kpgnb00067q6lg4u0tyuu" },
        label: "GET /users/cms7kpgnb00067q6lg4u0tyuu",
      }),
    ).toEqual({
      accessToken: "<redacted>",
      refreshToken: "<redacted>",
      email: "<redacted-email>",
      deviceInfo: "<redacted-device>",
      user: { id: "<redacted-id>" },
      label: "GET /users/<redacted-id>",
    });
  });
});

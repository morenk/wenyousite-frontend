import { describe, expect, test } from "vitest";
import { isContentUnavailableError, shouldRetryContentQuery } from "@/api/errors";

describe("isContentUnavailableError", () => {
  test.each([
    [{ code: 40300 }, false],
    [{ code: 40302 }, false],
    [{ code: 40402 }, true],
    [{ code: 40415 }, true],
    [{ code: 40419 }, false],
    [{ status: 403 }, true],
    [{ code: 40303, status: 403 }, false],
    [{ status: 404 }, true],
    [{ statusCode: 404 }, true],
    [{ code: 40900, status: 409 }, false],
    [new Error("network"), false],
  ])("识别失效访问边界 %#", (error, expected) => {
    expect(isContentUnavailableError(error)).toBe(expected);
  });
});

describe("shouldRetryContentQuery", () => {
  test("业务响应不重试，传输异常只重试一次", () => {
    expect(shouldRetryContentQuery(0, { code: 50000 })).toBe(false);
    expect(shouldRetryContentQuery(0, { status: 503 })).toBe(false);
    expect(shouldRetryContentQuery(0, new TypeError("offline"))).toBe(true);
    expect(shouldRetryContentQuery(1, new TypeError("offline"))).toBe(false);
    expect(shouldRetryContentQuery(0, new Error("invalid response"))).toBe(false);
  });
});

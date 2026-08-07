import { describe, expect, test } from "vitest";
import {
  formatDirectMessageTime,
  shouldShowDirectMessageTime,
} from "@/lib/direct-message-timeline";

describe("direct message timeline", () => {
  test("首条消息显示时间，连续消息不足五分钟时合并时间节点", () => {
    expect(shouldShowDirectMessageTime("2026-08-07T14:04:59Z")).toBe(true);
    expect(shouldShowDirectMessageTime(
      "2026-08-07T14:04:59Z",
      "2026-08-07T14:00:00Z",
    )).toBe(false);
    expect(shouldShowDirectMessageTime(
      "2026-08-07T14:05:00Z",
      "2026-08-07T14:00:00Z",
    )).toBe(true);
  });

  test("异常时间独立显示，避免误吞时间节点", () => {
    expect(shouldShowDirectMessageTime("invalid", "2026-08-07T14:00:00Z")).toBe(true);
    expect(formatDirectMessageTime("invalid", new Date("2026-08-07T15:00:00Z"))).toBe(
      "时间未知",
    );
  });

  test("当天、昨天、同年和跨年时间使用渐进式日期文案", () => {
    const now = new Date("2026-08-07T15:00:00Z");
    expect(formatDirectMessageTime("2026-08-07T14:05:00Z", now)).toBe("14:05");
    expect(formatDirectMessageTime("2026-08-06T23:59:00Z", now)).toBe("昨天 23:59");
    expect(formatDirectMessageTime("2026-07-01T08:30:00Z", now)).toBe("07月01日 08:30");
    expect(formatDirectMessageTime("2025-12-31T23:59:00Z", now)).toBe(
      "2025年12月31日 23:59",
    );
  });
});

import { describe, expect, test } from "vitest";
import { detectMobileDevice } from "@/lib/mobile-device";

describe("移动设备提示识别", () => {
  test.each([
    ["Mozilla/5.0 (Linux; Android 15; Pixel 9) Mobile", 5, false, "android"],
    ["Mozilla/5.0 (Linux; Android 14; Tablet)", 5, false, "android"],
    ["Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)", 5, true, "ios"],
    ["Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)", 5, false, "ios"],
    ["Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)", 5, false, "ios"],
    ["Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)", 0, false, null],
    ["Mozilla/5.0 (Windows NT 10.0; Win64; x64)", 10, false, null],
    ["Mozilla/5.0 (X11; Linux x86_64)", 0, false, null],
    ["Unrecognized", 1, true, "other"],
  ])("按设备事实识别，不依赖窗口宽度：%s", (userAgent, maxTouchPoints, mobileHint, expected) => {
    expect(detectMobileDevice({ userAgent, maxTouchPoints, mobileHint })).toBe(expected);
  });
});

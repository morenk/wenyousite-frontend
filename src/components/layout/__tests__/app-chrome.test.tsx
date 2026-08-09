import { describe, expect, test } from "vitest";

import {
  getAppChromeMode,
  routeNeedsThreadCategories,
} from "@/components/layout/app-chrome";

describe("AppChrome 路由模式", () => {
  test.each(["/", "/search", "/threads/t1", "/users/u1", "/wallet", "/moments", "/moments/m1"])(
    "%s 使用社区三栏",
    (pathname) => {
      expect(getAppChromeMode(pathname)).toBe("community");
    },
  );

  test.each(["/messages", "/messages/c1", "/threads/create", "/threads/t1/edit"])(
    "%s 使用宽工作区",
    (pathname) => {
      expect(getAppChromeMode(pathname)).toBe("workspace");
    },
  );

  test.each(["/login", "/register", "/forgot-password", "/reset-password", "/verify-email"])(
    "%s 使用认证页骨架",
    (pathname) => {
      expect(getAppChromeMode(pathname)).toBe("auth");
    },
  );

  test("只在社区与主题帖编辑工作区加载分区上下文", () => {
    expect(routeNeedsThreadCategories("/moments")).toBe(true);
    expect(routeNeedsThreadCategories("/threads/create")).toBe(true);
    expect(routeNeedsThreadCategories("/threads/t1/edit")).toBe(true);
    expect(routeNeedsThreadCategories("/messages")).toBe(false);
    expect(routeNeedsThreadCategories("/login")).toBe(false);
  });
});

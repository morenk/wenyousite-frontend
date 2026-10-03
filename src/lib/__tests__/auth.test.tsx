/** AuthProvider 认证上下文测试 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, renderHook, cleanup } from "@testing-library/react";
import { AuthProvider, useAuth, type AuthUser } from "@/lib/auth";
import {
  clearAuthSession,
  getAuthAccessToken,
} from "@/lib/auth-store";

const route = vi.hoisted(() => ({ pathname: "/me/email" }));
vi.mock("next/navigation", () => ({ usePathname: () => route.pathname }));

const mockUser: AuthUser = {
  id: "user-1",
  email: "test@example.com",
  username: "testuser",
  avatar: null,
  role: "USER",
};

beforeEach(() => {
  route.pathname = "/me/email";
  localStorage.clear();
  clearAuthSession({ announce: false });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 401 })));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function TestComponent() {
  const { user, isInitialized, setAuth, logout } = useAuth();
  return (
    <div>
      <span data-testid="initialized">{isInitialized ? "yes" : "no"}</span>
      <span data-testid="username">{user?.username ?? "null"}</span>
      <button
        data-testid="login-btn"
        onClick={() => setAuth(mockUser, "test-token")}
      >
        login
      </button>
      <button data-testid="logout-btn" onClick={() => logout()}>
        logout
      </button>
    </div>
  );
}

describe("AuthProvider", () => {
  test("初始状态 user 为 null", async () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>,
    );

    await vi.waitFor(() => {
      expect(screen.getByTestId("initialized").textContent).toBe("yes");
    });

    expect(screen.getByTestId("username").textContent).toBe("null");
  });

  test("启动刷新遇到网络错误时仍结束初始化", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>,
    );

    await vi.waitFor(() => {
      expect(screen.getByTestId("initialized").textContent).toBe("yes");
    });
    expect(screen.getByTestId("username")).toHaveTextContent("null");
  });

  test("setAuth 后 user 可读", async () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>,
    );

    await vi.waitFor(() => {
      expect(screen.getByTestId("initialized").textContent).toBe("yes");
    });

    act(() => {
      screen.getByTestId("login-btn").click();
    });

    await vi.waitFor(() => {
      expect(screen.getByTestId("username").textContent).toBe("testuser");
    });
    expect(getAuthAccessToken()).toBe("test-token");
    expect(localStorage.getItem("accessToken")).toBeNull();
  });

  test("logout 清除 user", async () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>,
    );

    await vi.waitFor(() => {
      expect(screen.getByTestId("initialized").textContent).toBe("yes");
    });

    act(() => {
      screen.getByTestId("login-btn").click();
    });

    await vi.waitFor(() => {
      expect(screen.getByTestId("username").textContent).toBe("testuser");
    });

    act(() => {
      screen.getByTestId("logout-btn").click();
    });

    await vi.waitFor(() => {
      expect(screen.getByTestId("username").textContent).toBe("null");
    });
  });

  test("不再从旧版 localStorage 凭证恢复登录态", async () => {
    localStorage.setItem("accessToken", "legacy-token");
    localStorage.setItem("user", JSON.stringify(mockUser));

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>,
    );

    await vi.waitFor(() => {
      expect(screen.getByTestId("initialized").textContent).toBe("yes");
    });

    expect(screen.getByTestId("username").textContent).toBe("null");
  });

  test("useAuth 在 Provider 外抛出错误", () => {
    expect(() => {
      renderHook(() => useAuth());
    }).toThrow("useAuth must be used within AuthProvider");
  });
});


test("成功退出落点仅保留在内存，再登录时清除", async () => {
  const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
  await vi.waitFor(() => expect(result.current.isInitialized).toBe(true));
  act(() => result.current.setAuth(mockUser, "test-token"));
  act(() => result.current.logout({ redirectTo: "/login?next=%2Fme%23security" }));
  expect(result.current.user).toBeNull();
  expect(result.current.logoutDestination).toBe("/login?next=%2Fme%23security");
  expect(getAuthAccessToken()).toBeNull();
  expect(localStorage.length).toBe(0);
  act(() => result.current.setAuth(mockUser, "new-token"));
  expect(result.current.logoutDestination).toBeNull();
  act(() => result.current.logout({ redirectTo: "https://external.invalid/" }));
  expect(result.current.logoutDestination).toBe("/");
});


test("成功导航完成后不再影响后续受保护页面", async () => {
  const { result, rerender } = renderHook(() => useAuth(), { wrapper: AuthProvider });
  await vi.waitFor(() => expect(result.current.isInitialized).toBe(true));
  act(() => result.current.setAuth(mockUser, "test-token"));
  act(() => result.current.logout({ redirectTo: "/login?next=%2Fme%23security" }));
  route.pathname = "/login";
  rerender();
  expect(result.current.logoutDestination).toBeNull();
  route.pathname = "/me/email";
  rerender();
  expect(result.current.logoutDestination).toBeNull();
});

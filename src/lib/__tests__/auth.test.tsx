/** AuthProvider 认证上下文测试 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, renderHook, cleanup } from "@testing-library/react";
import { AuthProvider, useAuth, type AuthUser } from "@/lib/auth";
import {
  clearAuthSession,
  getAuthAccessToken,
} from "@/lib/auth-store";

const mockUser: AuthUser = {
  id: "user-1",
  email: "test@example.com",
  username: "testuser",
  avatar: null,
  role: "USER",
  emailVerified: true,
};

beforeEach(() => {
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
      <button data-testid="logout-btn" onClick={logout}>
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

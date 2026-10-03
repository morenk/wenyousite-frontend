"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { safeLoginNextPath } from "@/lib/login-redirect";
import { bootstrapAuthSession } from "@/api/client";
import {
  AUTH_SESSION_MARKER_KEY,
  clearAuthSession,
  getAuthSnapshot,
  getServerAuthSnapshot,
  setAuthSession,
  subscribeAuthStore,
  type AuthUser,
} from "@/lib/auth-store";

export type { AuthUser } from "@/lib/auth-store";

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
}

interface AuthContextValue extends AuthState {
  setAuth: (user: AuthUser, accessToken: string) => void;
  logout: (options?: { redirectTo?: string }) => void;
  logoutDestination: string | null;
  isInitialized: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { user, accessToken } = useSyncExternalStore(
    subscribeAuthStore,
    getAuthSnapshot,
    getServerAuthSnapshot,
  );
  const [isInitialized, setIsInitialized] = useState(false);
  const pathname = usePathname();
  const [logoutNavigation, setLogoutNavigation] = useState<{ from: string | null; to: string } | null>(null);
  // 只服务本次退出；路由完成后丢弃，后续访问受保护页面仍走正常登录回跳。
  const logoutDestination = logoutNavigation?.from === pathname ? logoutNavigation.to : null;
  if (logoutNavigation && logoutNavigation.from !== pathname) setLogoutNavigation(null);

  useEffect(() => {
    let active = true;

    const initialize = async () => {
      try {
        await bootstrapAuthSession();
      } catch {
        // 离线/临时网络错误不等同于主动登出；本次启动按匿名态继续。
      } finally {
        // 网络不可用时也必须结束启动态，让公开页面可用、受保护页可回登录。
        if (active) setIsInitialized(true);
      }
    };

    void initialize();

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== AUTH_SESSION_MARKER_KEY) return;
      setLogoutNavigation(null);
      if (event.newValue === null) {
        clearAuthSession({ announce: false });
        setIsInitialized(true);
        return;
      }
      clearAuthSession({ announce: false });
      setIsInitialized(false);
      void initialize();
    };

    window.addEventListener("storage", handleStorage);
    return () => {
      active = false;
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const setAuth = useCallback((newUser: AuthUser, token: string) => {
    setLogoutNavigation(null);
    setAuthSession(newUser, token);
  }, []);

  const logout = useCallback((options?: { redirectTo?: string }) => {
    setLogoutNavigation(options?.redirectTo ? { from: pathname, to: safeLoginNextPath(options.redirectTo) } : null);
    clearAuthSession();
  }, [pathname]);

  return (
    <AuthContext.Provider
      value={{ user, accessToken, setAuth, logout, logoutDestination, isInitialized }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}

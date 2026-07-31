"use client";

import {
  createContext,
  useCallback,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from "react";

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  avatar: string | null;
  role: string;
  emailVerified: boolean;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
}

interface AuthContextValue extends AuthState {
  setAuth: (user: AuthUser, accessToken: string) => void;
  logout: () => void;
  isInitialized: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredUser(): AuthUser | null {
  const storedUser = localStorage.getItem("user");
  if (!storedUser) return null;
  try {
    return JSON.parse(storedUser) as AuthUser;
  } catch {
    localStorage.removeItem("user");
    return null;
  }
}

function readStoredToken(): string | null {
  return localStorage.getItem("accessToken");
}

let cachedSnapshot: AuthState | undefined;
let cachedUserKey = "";
let cachedToken: string | null = null;

function getSnapshot(): AuthState {
  let user = readStoredUser();
  const accessToken = readStoredToken();

  if (!accessToken) {
    user = null;
  }

  const userKey = user ? JSON.stringify(user) : "";
  if (
    cachedSnapshot &&
    cachedUserKey === userKey &&
    cachedToken === accessToken
  ) {
    return cachedSnapshot;
  }

  cachedSnapshot = { user, accessToken };
  cachedUserKey = userKey;
  cachedToken = accessToken;
  return cachedSnapshot;
}

function subscribe(callback: () => void) {
  const onStorage = () => callback();
  window.addEventListener("storage", onStorage);
  window.addEventListener("auth-change", onStorage);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("auth-change", onStorage);
  };
}

function dispatchAuthChange() {
  window.dispatchEvent(new Event("auth-change"));
}

const serverSnapshot: AuthState = { user: null, accessToken: null };

function useIsClient() {
  return useSyncExternalStore(
    useCallback(() => () => {}, []),
    () => true,
    () => false,
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { user, accessToken } = useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => serverSnapshot,
  );
  const isInitialized = useIsClient();

  const setAuth = useCallback((newUser: AuthUser, token: string) => {
    localStorage.setItem("accessToken", token);
    localStorage.setItem("user", JSON.stringify(newUser));
    dispatchAuthChange();
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("user");
    dispatchAuthChange();
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, accessToken, setAuth, logout, isInitialized }}
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

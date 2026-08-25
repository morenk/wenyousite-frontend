"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  DEFAULT_THEME_MODE,
  DEFAULT_THEME_PREFERENCE,
  THEME_MEDIA_QUERY,
  THEME_STORAGE_KEY,
  isThemePreference,
  readThemePreference,
  syncThemeDocument,
  writeThemePreference,
  type ThemeMode,
  type ThemePreference,
} from "@/lib/theme";

interface ThemeContextValue {
  preference: ThemePreference;
  resolvedTheme: ThemeMode;
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function browserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function browserThemeQuery(): MediaQueryList | null {
  return typeof window.matchMedia === "function"
    ? window.matchMedia(THEME_MEDIA_QUERY)
    : null;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(
    DEFAULT_THEME_PREFERENCE,
  );
  const [resolvedTheme, setResolvedTheme] = useState<ThemeMode>(
    DEFAULT_THEME_MODE,
  );
  const preferenceRef = useRef<ThemePreference>(DEFAULT_THEME_PREFERENCE);

  const applyPreference = useCallback(
    (nextPreference: ThemePreference, systemDark: boolean) => {
      preferenceRef.current = nextPreference;
      setPreferenceState(nextPreference);
      setResolvedTheme(syncThemeDocument(document, nextPreference, systemDark));
    },
    [],
  );

  useEffect(() => {
    const mediaQuery = browserThemeQuery();
    const bootstrappedPreference = document.documentElement.dataset.themePreference;
    const initialPreference = isThemePreference(bootstrappedPreference)
      ? bootstrappedPreference
      : readThemePreference(browserStorage());

    const initialFrame = window.requestAnimationFrame(() => {
      if (preferenceRef.current === DEFAULT_THEME_PREFERENCE) {
        applyPreference(initialPreference, mediaQuery?.matches ?? false);
      }
    });

    const handleSystemTheme = (event: MediaQueryListEvent) => {
      if (preferenceRef.current === "system") {
        applyPreference("system", event.matches);
      }
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY) return;
      const nextPreference = isThemePreference(event.newValue)
        ? event.newValue
        : DEFAULT_THEME_PREFERENCE;
      applyPreference(nextPreference, mediaQuery?.matches ?? false);
    };

    mediaQuery?.addEventListener("change", handleSystemTheme);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.cancelAnimationFrame(initialFrame);
      mediaQuery?.removeEventListener("change", handleSystemTheme);
      window.removeEventListener("storage", handleStorage);
    };
  }, [applyPreference]);

  const setPreference = useCallback(
    (nextPreference: ThemePreference) => {
      writeThemePreference(browserStorage(), nextPreference);
      applyPreference(nextPreference, browserThemeQuery()?.matches ?? false);
    },
    [applyPreference],
  );

  const value = useMemo(
    () => ({ preference, resolvedTheme, setPreference }),
    [preference, resolvedTheme, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme 必须在 ThemeProvider 内使用");
  return context;
}

import {
  DEFAULT_THEME_MODE,
  DEFAULT_THEME_PREFERENCE,
  THEME_PALETTES,
  THEME_PREFERENCES,
  type ThemeMode,
  type ThemePreference,
} from "@wenyousite/foundation/theme";

export const THEME_STORAGE_KEY = "wenyousite-theme";
export const THEME_MEDIA_QUERY = "(prefers-color-scheme: dark)";

const themePreferences = new Set<string>(THEME_PREFERENCES);

export function isThemePreference(value: unknown): value is ThemePreference {
  return typeof value === "string" && themePreferences.has(value);
}

export function resolveThemePreference(
  preference: ThemePreference,
  systemDark: boolean,
): ThemeMode {
  if (preference === "system") return systemDark ? "dark" : "light";
  return preference;
}

export function readThemePreference(
  storage: Pick<Storage, "getItem"> | null | undefined,
): ThemePreference {
  if (!storage) return DEFAULT_THEME_PREFERENCE;
  try {
    const value = storage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(value) ? value : DEFAULT_THEME_PREFERENCE;
  } catch {
    return DEFAULT_THEME_PREFERENCE;
  }
}

export function writeThemePreference(
  storage: Pick<Storage, "setItem"> | null | undefined,
  preference: ThemePreference,
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(THEME_STORAGE_KEY, preference);
    return true;
  } catch {
    return false;
  }
}

export function syncThemeDocument(
  target: Document,
  preference: ThemePreference,
  systemDark: boolean,
): ThemeMode {
  const mode = resolveThemePreference(preference, systemDark);
  const root = target.documentElement;
  root.dataset.theme = mode;
  root.dataset.themePreference = preference;
  root.style.colorScheme = mode;
  let themeColor = target.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!themeColor) {
    themeColor = target.createElement("meta");
    themeColor.name = "theme-color";
    target.head.append(themeColor);
  }
  themeColor.content = THEME_PALETTES[mode].background;
  return mode;
}

export { DEFAULT_THEME_MODE, DEFAULT_THEME_PREFERENCE };
export type { ThemeMode, ThemePreference };

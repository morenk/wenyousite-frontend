import {
  DEFAULT_THEME_PREFERENCE,
  THEME_PALETTES,
  THEME_PREFERENCES,
} from "@wenyousite/foundation/theme";

import { THEME_MEDIA_QUERY, THEME_STORAGE_KEY } from "./theme";

const themeBackgrounds = {
  light: THEME_PALETTES.light.background,
  dark: THEME_PALETTES.dark.background,
};

/**
 * 在 React hydration 前解析本机偏好，避免先绘制错误主题。
 * 所有可变值都由 Foundation 与主题模块序列化，不在脚本中复制色板。
 */
export const THEME_BOOTSTRAP_SCRIPT = `(() => {
  const key = ${JSON.stringify(THEME_STORAGE_KEY)};
  const preferences = ${JSON.stringify(THEME_PREFERENCES)};
  const fallback = ${JSON.stringify(DEFAULT_THEME_PREFERENCE)};
  const backgrounds = ${JSON.stringify(themeBackgrounds)};
  let stored = null;
  try { stored = window.localStorage.getItem(key); } catch {}
  const preference = preferences.includes(stored) ? stored : fallback;
  const systemDark = typeof window.matchMedia === "function"
    && window.matchMedia(${JSON.stringify(THEME_MEDIA_QUERY)}).matches;
  const mode = preference === "system" ? (systemDark ? "dark" : "light") : preference;
  const root = document.documentElement;
  root.dataset.theme = mode;
  root.dataset.themePreference = preference;
  root.style.colorScheme = mode;
  let themeColor = document.querySelector('meta[name="theme-color"]');
  if (!themeColor) {
    themeColor = document.createElement("meta");
    themeColor.setAttribute("name", "theme-color");
    document.head.append(themeColor);
  }
  themeColor.setAttribute("content", backgrounds[mode]);
})();`;

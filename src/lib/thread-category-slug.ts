export const THREAD_CATEGORY_SLUG_PATTERN = /^[A-Z][A-Z0-9_]{0,49}$/;
export const THREAD_CATEGORY_SLUG_PATTERN_SOURCE = THREAD_CATEGORY_SLUG_PATTERN.source;
export const THREAD_CATEGORY_SLUG_MIN_LENGTH = 1;
export const THREAD_CATEGORY_SLUG_MAX_LENGTH = 50;

export function normalizeThreadCategorySlug(value: string): string {
  return value.trim().toUpperCase();
}

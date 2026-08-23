import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

import { getThreadCategoryPresentation } from "@/lib/thread-presentation";
import {
  normalizeThreadCategorySlug,
  THREAD_CATEGORY_SLUG_MAX_LENGTH,
  THREAD_CATEGORY_SLUG_MIN_LENGTH,
  THREAD_CATEGORY_SLUG_PATTERN,
  THREAD_CATEGORY_SLUG_PATTERN_SOURCE,
} from "@/lib/thread-category-slug";

interface CategoryFixture {
  slugPolicy: {
    normalization: string;
    pattern: string;
    minLength: number;
    maxLength: number;
  };
  presentationCases: Array<{
    threadCategory: string | null;
    expectedCategoryInfo: { slug: string; name: string; isActive: boolean } | null;
    expected: { label: string; selectable: boolean };
  }>;
}

const fixture = JSON.parse(
  readFileSync(
    resolve(process.cwd(), "contracts/thread-category-v3-fixtures.json"),
    "utf8",
  ),
) as CategoryFixture;

describe("thread category v3 contract", () => {
  test("Web slug policy stays identical to the golden contract", () => {
    expect(fixture.slugPolicy.normalization).toBe("trim-uppercase");
    expect(THREAD_CATEGORY_SLUG_PATTERN_SOURCE).toBe(fixture.slugPolicy.pattern);
    expect(THREAD_CATEGORY_SLUG_MIN_LENGTH).toBe(fixture.slugPolicy.minLength);
    expect(THREAD_CATEGORY_SLUG_MAX_LENGTH).toBe(fixture.slugPolicy.maxLength);
    expect(normalizeThreadCategorySlug(" story_room ")).toBe("STORY_ROOM");
    expect(THREAD_CATEGORY_SLUG_PATTERN.test("A")).toBe(true);
    expect(THREAD_CATEGORY_SLUG_PATTERN.test(`A${"0".repeat(49)}`)).toBe(true);
    expect(THREAD_CATEGORY_SLUG_PATTERN.test("1ROOM")).toBe(false);
    expect(THREAD_CATEGORY_SLUG_PATTERN.test("STORY-ROOM")).toBe(false);
    expect(THREAD_CATEGORY_SLUG_PATTERN.test(`A${"0".repeat(50)}`)).toBe(false);
  });

  test.each(fixture.presentationCases)(
    "presentation uses categoryInfo and only falls back for old responses",
    ({ threadCategory, expectedCategoryInfo, expected }) => {
      expect(
        getThreadCategoryPresentation(expectedCategoryInfo, threadCategory).label,
      ).toBe(expected.label);
      expect(expectedCategoryInfo?.isActive ?? false).toBe(expected.selectable);
    },
  );
});

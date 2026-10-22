import { expect, test } from "vitest";
import { fontSpecimenBounds } from "../font-specimen-bounds";

test("仅移除完全透明边缘，保留最淡笔画和安全边距", () => {
  const pixels = new Uint8ClampedArray(20 * 16 * 4);
  pixels[(5 * 20 + 6) * 4 + 3] = 1;
  pixels[(9 * 20 + 12) * 4 + 3] = 255;
  expect(fontSpecimenBounds(pixels, 20, 16)).toEqual({ x: 4, y: 3, width: 11, height: 9 });
});

test("贴边笔画完整保留，不假设文字位置或固定透明边距", () => {
  const pixels = new Uint8ClampedArray(8 * 8 * 4);
  pixels[3] = 255;
  pixels[pixels.length - 1] = 1;
  expect(fontSpecimenBounds(pixels, 8, 8)).toEqual({ x: 0, y: 0, width: 8, height: 8 });
});

test("全透明、无效尺寸、短缓冲与过大位图均安全回退", () => {
  expect(fontSpecimenBounds(new Uint8ClampedArray(64), 4, 4)).toBeNull();
  expect(fontSpecimenBounds(new Uint8ClampedArray(4), 4, 4)).toBeNull();
  expect(fontSpecimenBounds(new Uint8ClampedArray(4), 0, 1)).toBeNull();
  expect(fontSpecimenBounds(new Uint8ClampedArray(4), 1.5, 1)).toBeNull();
  expect(fontSpecimenBounds(new Uint8ClampedArray(4), 4096, 4096)).toBeNull();
});

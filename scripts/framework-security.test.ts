// @vitest-environment node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { expect, test } from "vitest";

const projectRequire = createRequire(resolve("package.json"));
const nextRequire = createRequire(projectRequire.resolve("next/package.json"));
const sharp = nextRequire("sharp");

test("框架与实际原生图片库使用已修复的精确版本", () => {
  expect(projectRequire("next/package.json").version).toBe("16.3.8");
  expect(JSON.parse(readFileSync("node_modules/eslint-config-next/package.json", "utf8")).version).toBe("16.3.8");
  expect(sharp.versions.sharp).toBe("0.35.5");
  // 校验实际加载的预编译库，避免只更新 npm 元数据却仍使用旧 librsvg。
  expect(sharp.versions.rsvg).toBe("2.63.2");
});

test.each(["png", "jpeg", "webp", "avif"])("原生图片依赖可解码 SVG、缩放并输出 %s", async (format) => {
  const source = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="12" height="8"><rect width="12" height="8" fill="#ff6600"/></svg>');
  const result = await sharp(source).resize(6, 4).toFormat(format).toBuffer();
  expect(result.length).toBeGreaterThan(0);
  const metadata = await sharp(result).metadata();
  expect(metadata).toMatchObject({ width: 6, height: 4, format: format === "avif" ? "heif" : format });
});

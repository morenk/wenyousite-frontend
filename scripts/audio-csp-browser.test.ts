// @vitest-environment node
import { chromium } from "@playwright/test";
import { expect, test } from "vitest";
import { createContentSecurityPolicy, MEDIA_ORIGIN } from "../src/lib/security-headers";

// 合成短静音 WAV；全部请求本地 fulfill，绝不访问桶或真实业务服务。
const wav = Buffer.alloc(44 + 1600);
wav.write("RIFF"); wav.writeUInt32LE(wav.length - 8, 4); wav.write("WAVEfmt ", 8);
wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28);
wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
wav.write("data", 36); wav.writeUInt32LE(1600, 40);

test.each([
  { name: "生产策略", isDevelopment: false, oldPolicy: false },
  { name: "开发策略", isDevelopment: true, oldPolicy: false },
  { name: "旧策略反证", isDevelopment: false, oldPolicy: true },
])("浏览器 $name 核验桶音频许可且拒绝其他源", async ({ isDevelopment, oldPolicy }) => {
  const browser = await chromium.launch();
  try {
    const policy = createContentSecurityPolicy({ nonce: "fixture", isDevelopment });
    const csp = oldPolicy ? policy.replace("media-src 'self' blob: " + MEDIA_ORIGIN, "media-src 'self' blob:") : policy;
    const context = await browser.newContext({ serviceWorkers: "block" });
    const reached: string[] = [];
    const mediaUrl = MEDIA_ORIGIN + "/wenyou/media/audio/csp-fixture.wav";
    const forbiddenUrl = "https://untrusted.invalid/csp-fixture.wav";
    await context.route("**/*", async (route) => {
      const url = route.request().url();
      reached.push(url);
      if (url === "https://csp-fixture.invalid/") {
        await route.fulfill({
          contentType: "text/html",
          headers: { "Content-Security-Policy": csp },
          body: "<html><body><audio preload=none></audio></body></html>",
        });
      } else if (url === mediaUrl) {
        await route.fulfill({ contentType: "audio/wav", body: wav });
      } else {
        await route.abort();
      }
    });
    const page = await context.newPage();
    await page.goto("https://csp-fixture.invalid/");
    const allowed = await page.evaluate(async (url) => {
      const audio = document.querySelector("audio")!;
      return new Promise<string>((resolve) => {
        audio.onloadedmetadata = () => resolve("metadata");
        audio.onerror = () => resolve("error");
        audio.src = url;
        audio.load();
      });
    }, mediaUrl);
    expect(allowed).toBe(oldPolicy ? "error" : "metadata");
    expect(reached.includes(mediaUrl)).toBe(!oldPolicy);
    const violation = await page.evaluate(async (url) => {
      const audio = document.querySelector("audio")!;
      return new Promise<{ directive: string; uri: string }>((resolve) => {
        document.addEventListener("securitypolicyviolation", (event) => {
          resolve({ directive: event.effectiveDirective, uri: event.blockedURI });
        }, { once: true });
        audio.src = url;
        audio.load();
      });
    }, forbiddenUrl);
    expect(violation).toEqual({ directive: "media-src", uri: forbiddenUrl });
    expect(reached).not.toContain(forbiddenUrl);
    expect(reached).toEqual(oldPolicy ? ["https://csp-fixture.invalid/"] : ["https://csp-fixture.invalid/", mediaUrl]);
    await context.close();
  } finally {
    await browser.close();
  }
}, 15000);

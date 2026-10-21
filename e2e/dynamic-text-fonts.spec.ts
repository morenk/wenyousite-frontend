import { randomUUID } from "node:crypto";
import { DynamicFontCheckpoints } from "./fixtures/dynamic-font-checkpoints";
import legacyImports from "../contracts/thread-font-v1-import-map.json";
import type { components } from "../src/api/types";
import { expect, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "./fixtures/isolation";
import { loginAsE2eUser, openFreshThreadDraft } from "./fixtures/auth";
import { loginIsolatedAdmin, elevateIsolatedAdmin } from "./fixtures/admin";
import { requireIsolationRunner } from "../scripts/e2e-isolation-gate.mjs";
import { evidenceSource } from "../scripts/source-evidence.mjs";

type FontDescriptorObservation = {
  versionId: string;
  httpStatus: number;
  status?: string;
  revision?: number;
  renderAllowed?: boolean;
  at: number;
};
type ObservedPost = {
  textFontVersion?: number;
  content?: string;
  saved?: { id: string; content: string; status: number };
};
async function lastObservedPost(page: Page): Promise<ObservedPost> {
  await expect
    .poll(() =>
      page.evaluate(() =>
        Boolean(
          (
            window as unknown as { fontPostRequests: ObservedPost[] }
          ).fontPostRequests.at(-1)?.saved,
        ),
      ),
    )
    .toBe(true);
  const body = await page.evaluate(() =>
    (
      window as unknown as { fontPostRequests: ObservedPost[] }
    ).fontPostRequests.at(-1),
  );
  expect(body, "真实 fetch 请求体必须已记录").toBeDefined();
  return body!;
}

async function uploadProcessPreview(page: Page, version: 1 | 2) {
  const upload = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname.endsWith("/sources"),
  );
  await page
    .getByLabel("TTF / OTF 文件")
    .setInputFiles(`e2e/fixtures/dynamic-fonts/synthetic-${version}.ttf`);
  await page.getByRole("button", { name: "上传", exact: true }).click();
  const uploaded = await upload;
  expect(uploaded.status()).toBe(201);
  // Chromium 的 inspector 可提前回收上传正文；使用真实 fetch 响应副本中的 jobId。
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { uploadedFontJobIds: string[] })
            .uploadedFontJobIds.length,
      ),
    )
    .toBe(version);
  const jobId = await page.evaluate(() =>
    (
      window as unknown as { uploadedFontJobIds: string[] }
    ).uploadedFontJobIds.at(-1)!,
  );
  const row = page.getByRole("row").filter({
    has: page.getByRole("cell", { name: jobId.slice(-8), exact: true }),
  });
  await row.getByRole("button", { name: "开始处理", exact: true }).click();
  await expect(
    row.getByRole("button", { name: "预览", exact: true }),
  ).toBeVisible({ timeout: 600000 });
  await expect(
    page.getByRole("button", { name: "预览", exact: true }),
  ).toHaveCount(version, { timeout: 600000 });
  await row.getByRole("button", { name: "预览", exact: true }).click();
  await expect(page.getByRole("img", { name: "字体样张" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "发布此版本", exact: true }),
  ).toBeEnabled();
  const published = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname.endsWith("/publish"),
  );
  await page.getByRole("button", { name: "发布此版本", exact: true }).click();
  expect((await published).ok()).toBe(true);
  await expect(page.getByRole("img", { name: "字体样张" })).toBeVisible();
  await expect(
    page.getByText("样张读取失败", { exact: true }),
  ).not.toBeVisible();
  const family = await page.evaluate(async () => {
    const response = await fetch(
      "/api/v1/admin/text-fonts/" + location.pathname.split("/").at(-1),
    );
    return (await response.json()).data;
  });
  expect(family.currentVersionId).toMatch(/^tfv_[a-f0-9]{32}$/);
  return family.currentVersionId as string;
}
async function copyFloorAndSave(
  page: Page,
  postId: string,
  subthreadId: string,
  versionId: string,
  fontAllowed = true,
) {
  const floor = page.locator("#post-" + postId);
  await floor.scrollIntoViewIfNeeded();
  // 捕获真实站内复制输出；不替换解析、保存或字体 API。
  await page.evaluate(() => {
    delete (window as unknown as { copied?: unknown }).copied;
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        write: async (items: ClipboardItem[]) => {
          const item = items[0]!;
          (
            window as unknown as { copied: { html: string; text: string } }
          ).copied = {
            html: await (await item.getType("text/html")).text(),
            text: await (await item.getType("text/plain")).text(),
          };
        },
      },
    });
  });
  await floor
    .getByRole("button", { name: "更多楼层操作", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "复制内容", exact: true }).click();
  await page.waitForFunction(() =>
    Boolean((window as unknown as { copied?: unknown }).copied),
  );
  const copied = await page.evaluate(
    () =>
      (window as unknown as { copied: { html: string; text: string } }).copied,
  );
  if (fontAllowed)
    expect(copied.html).toContain(`data-wenyou-font-v2="${versionId}"`);
  await page.getByRole("button", { name: "发表回复…", exact: true }).click();
  const reply = page.getByRole("textbox", { name: "楼层正文", exact: true });
  await reply.evaluate((element, payload) => {
    const clipboardData = new DataTransfer();
    clipboardData.setData("text/html", payload.html);
    clipboardData.setData("text/plain", payload.text);
    element.dispatchEvent(
      new ClipboardEvent("paste", {
        bubbles: true,
        cancelable: true,
        clipboardData,
      }),
    );
  }, copied);
  if (fontAllowed)
    await expect(
      reply.locator(`[data-wenyou-font-v2="${versionId}"]`),
    ).toHaveText("Aa Aa");
  else {
    await expect(
      reply.locator("[data-wenyou-font-v1], [data-wenyou-font-v2]"),
    ).toHaveCount(0);
    await expect(reply).toHaveText("Aa Aa");
  }
  const savedResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname ===
        `/api/v1/subthreads/${subthreadId}/posts`,
  );
  await page.getByRole("button", { name: "发布", exact: true }).click();
  const saved = await savedResponse;
  expect(saved.status()).toBe(201);
  const sent = await lastObservedPost(page);
  expect(sent.textFontVersion).toBe(2);
  const savedPost = sent.saved!;
  expect(savedPost.status).toBe(201);
  expect(savedPost.content).toBe(sent.content);
  if (fontAllowed)
    expect(savedPost.content).toContain(`data-wenyou-font-v2="${versionId}"`);
  if (!fontAllowed) expect(sent.content).not.toMatch(/data-wenyou-font-v[12]/u);
  await page.reload();
  const savedFloor = page.locator("#post-" + savedPost.id);
  await savedFloor.scrollIntoViewIfNeeded();
  if (fontAllowed)
    await expect(
      savedFloor.locator(`[data-wenyou-font-v2="${versionId}"]`),
    ).toHaveAttribute("data-font-load", "ready");
  return savedPost as { id: string };
}

async function screenshotModes(page: Page, output: string, name: string) {
  const layouts = [];
  for (const width of [1024, 390])
    for (const colorScheme of ["light", "dark"] as const) {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme });
      await expect(page.locator("html")).toHaveAttribute(
        "data-theme",
        colorScheme,
      );
      const documentWidth = await page.evaluate(
        () => document.documentElement.scrollWidth,
      );
      if (
        width === 1024 ||
        new URL(page.url()).pathname.startsWith("/station/")
      )
        expect(documentWidth).toBeLessThanOrEqual(width);
      if (
        width === 390 &&
        new URL(page.url()).pathname.startsWith("/station/text-fonts/")
      ) {
        await expect(
          page.getByRole("button", { name: "展开管理导航" }),
        ).toBeVisible();
        await expect(
          page.getByRole("navigation", { name: "管理功能" }),
        ).not.toBeVisible();
        expect(
          (await page.getByLabel("字体名称", { exact: true }).boundingBox())!
            .width,
        ).toBeGreaterThan(250);
        await expect(
          page
            .getByRole("combobox", { name: "主要语言" })
            .locator('[data-slot="select-value"]'),
        ).toHaveText("中文");
      }
      // 390px 保留实际视口裁切，记录 PC 布局的宽度，不用整页截图伪装窄屏画面。
      await page.screenshot({
        path: join(output, `${name}-${width}-${colorScheme}.png`),
        fullPage: width === 1024,
        animations: "disabled",
      });
      layouts.push({ width, height: 900, colorScheme, documentWidth });
    }
  writeFileSync(
    join(output, `${name}-viewports.json`),
    JSON.stringify(layouts, null, 2),
  );
  await page.setViewportSize({ width: 1024, height: 900 });
}

test("构建后真实上传发布新ID，同会话选择、复制保存、历史版本、停用、回滚与撤回", async ({
  page,
  isolationNetwork,
}, testInfo) => {
  test.setTimeout(process.env.E2E_FONT_MOBILE_APK_SHA256 ? 2400000 : 1500000);
  const run = await requireIsolationRunner(),
    source = evidenceSource(),
    buildId = readFileSync(
      join(process.env.E2E_BUILD_DIR!, "BUILD_ID"),
      "utf8",
    ).trim(),
    output = join(
      process.cwd(),
      ".e2e-results",
      `dynamic-fonts-${run.manifest.runId}`,
    );
  expect(run.manifest.textFonts?.legacyImported).toBe(true);
  expect(run.manifest.fontObjectStore).toBeDefined();
  mkdirSync(output, { recursive: true, mode: 0o700 });
  const checkpoints = new DynamicFontCheckpoints({
    root: run.root,
    identity: {
      runId: run.manifest.runId,
      backendURL: run.manifest.backendURL,
      webBuildId: buildId,
      webBuildSha256: process.env.E2E_FONT_WEB_BUILD_SHA256!,
      sourceCommit: source.sourceCommit,
      sourceDigest: source.sourceDigest,
      webSessionId: randomUUID(),
    },
    mobileApkSha256: process.env.E2E_FONT_MOBILE_APK_SHA256,
    verify: async () => {
      await requireIsolationRunner();
    },
  });
  const stopCheckpoints = () => checkpoints.dispose();
  page.on("close", stopCheckpoints);
  writeFileSync(
    join(output, "coordination-pointer.json"),
    JSON.stringify(
      {
        runId: run.manifest.runId,
        mode: checkpoints.mode,
        directory: checkpoints.directory,
        webBuildSha256: process.env.E2E_FONT_WEB_BUILD_SHA256,
      },
      null,
      2,
    ),
    { mode: 0o600 },
  );
  const withdrawalObservations: unknown[] = [];
  const coldRecovery: Record<string, unknown> = {};
  const resourceFailures: { path: string; error?: string; at: number }[] = [];
  try {
    const fontAssetRequests: string[] = [],
      legacyAssetRequests: string[] = [];
    await page.addInitScript(() => {
      // 浏览器协议可能不返回 fetch(Request) 的 postData；仅观测真实 Request 的副本。
      const postRequests: ObservedPost[] = [];
      const descriptorReads: FontDescriptorObservation[] = [];
      (
        window as unknown as {
          fontDescriptorReads: FontDescriptorObservation[];
        }
      ).fontDescriptorReads = descriptorReads;
      (
        window as unknown as { fontPostRequests: ObservedPost[] }
      ).fontPostRequests = postRequests;
      const nativeFetch = window.fetch.bind(window);
      window.fetch = async (input, init) => {
        const request = new Request(
          input instanceof Request ? input.clone() : input,
          init,
        );
        let observed: ObservedPost | undefined;
        if (
          request.method === "POST" &&
          /^\/api\/v1\/subthreads\/[^/]+\/posts$/u.test(
            new URL(request.url).pathname,
          )
        ) {
          const body = await request.json();
          observed = {
            textFontVersion: body.textFontVersion,
            content: body.content,
          };
          postRequests.push(observed);
        }
        const response = await nativeFetch(input, init);
        const descriptorMatch =
          /^\/api\/v1\/meta\/text-fonts\/v2\/versions\/(tfv_[a-f0-9]{32})$/u.exec(
            new URL(request.url).pathname,
          );
        if (request.method === "GET" && descriptorMatch) {
          const data =
            response.status === 200
              ? (await response.clone().json()).data
              : undefined;
          descriptorReads.push({
            versionId: descriptorMatch[1]!,
            httpStatus: response.status,
            status: data?.status,
            revision: data?.revision,
            renderAllowed: data?.renderAllowed,
            at: Date.now(),
          });
          if (descriptorReads.length > 512) descriptorReads.shift();
        }
        if (observed && response.status === 201) {
          const body = await response.clone().json();
          observed.saved = {
            id: body.data.id,
            content: body.data.content,
            status: response.status,
          };
        }
        return response;
      };
      const registrations: Record<string, number> = {};
      (
        window as unknown as { fontRegistrations: Record<string, number> }
      ).fontRegistrations = registrations;
      const add = document.fonts.add.bind(document.fonts);
      document.fonts.add = (font: FontFace) => {
        registrations[font.family] = (registrations[font.family] ?? 0) + 1;
        return add(font);
      };
    });
    page.on("request", (request) => {
      const path = new URL(request.url()).pathname;
      if (
        /^\/api\/v1\/meta\/text-fonts(?:\/runtime-policy)?$/u.test(path) ||
        path.startsWith("/fonts/v1/")
      )
        legacyAssetRequests.push(path);
      if (
        /\/assets\/[a-f0-9]{64}\.(?:woff2|ttf|otf)$/u.test(
          new URL(request.url()).pathname,
        )
      )
        fontAssetRequests.push(new URL(request.url()).pathname);
    });
    page.on("requestfailed", (request) => {
      const path = new URL(request.url()).pathname;
      if (/\/versions\/tfv_[a-f0-9]{32}\/assets\//u.test(path))
        resourceFailures.push({
          path,
          error: request.failure()?.errorText,
          at: Date.now(),
        });
    });
    await page.goto("/");
    const meta = await page.evaluate(
      async () => (await (await fetch("/api/v1/meta")).json()).data,
    );
    expect(meta.capabilities.textFontV2Supported).toBe(true);
    expect(meta.capabilities.textFontV2WriteEnabled).toBe(true);
    // 认证响应立即读取，早于登录导航；凭据仅留在当前测试内存，观察器不记录认证。
    const login = page
      .waitForResponse(
        (response) =>
          response.request().method() === "POST" &&
          new URL(response.url()).pathname === "/api/v1/auth/login",
      )
      .then((response) => response.json());
    await loginAsE2eUser(page);
    const owner = (await login).data;
    const request = async (
      method: string,
      path: string,
      data?: unknown,
      fontVersion = 2,
    ) => {
      await requireIsolationRunner();
      return page.evaluate(
        async ({ method, path, data, token, fontVersion }) => {
          const response = await fetch(path, {
            method,
            headers: {
              Authorization: "Bearer " + token,
              "Content-Type": "application/json",
              "X-Markdown-Contract-Version": "6",
              "X-Text-Color-Version": "1",
              "X-Text-Font-Version": String(fontVersion),
            },
            ...(data ? { body: JSON.stringify(data) } : {}),
          });
          return { status: response.status, body: await response.json() };
        },
        { method, path, data, token: owner.accessToken, fontVersion },
      );
    };
    const initialIds = new Set<string>();
    let cursor: string | null = null;
    do {
      const data: components["schemas"]["FontCatalogPageDto"] = (
        await request(
          "GET",
          "/api/v1/meta/text-fonts/v2?limit=200" +
            (cursor ? "&cursor=" + encodeURIComponent(cursor) : ""),
        )
      ).body.data;
      for (const item of data.items) initialIds.add(item.versionId);
      cursor = data.nextCursor;
    } while (cursor);
    // 编辑器先建立并保持该会话，随后另一标签页才上传；不刷新页面来发现新版本。
    await openFreshThreadDraft(page);
    const editor = page.locator(".ProseMirror");
    await page
      .getByLabel("主题帖标题")
      .fill("动态字体验收 " + run.manifest.runId);
    await editor.fill("Aa Aa");
    await checkpoints.checkpoint("sessions-ready", []);
    const admin = await page.context().newPage();
    await admin.addInitScript(() => {
      const ids: string[] = [];
      (
        window as unknown as { uploadedFontJobIds: string[] }
      ).uploadedFontJobIds = ids;
      const nativeFetch = window.fetch.bind(window);
      window.fetch = async (input, init) => {
        const response = await nativeFetch(input, init);
        const method =
          init?.method ?? (input instanceof Request ? input.method : "GET");
        if (
          method === "POST" &&
          response.status === 201 &&
          /^\/api\/v1\/admin\/text-fonts\/tff_[a-f0-9]{32}\/sources$/u.test(
            new URL(response.url).pathname,
          )
        ) {
          const body = await response.clone().json();
          ids.push(body.data.jobId);
        }
        return response;
      };
    });
    await loginIsolatedAdmin(admin, "/station/text-fonts");
    await admin.getByRole("link", { name: "新建字体", exact: true }).click();
    const name = "隔离样本 " + run.manifest.runId.slice(-8);
    await admin.getByLabel("字体名称").fill(name);
    await admin.getByLabel("作者", { exact: true }).fill("温油站测试");
    await admin
      .getByLabel("来源链接")
      .fill("https://example.invalid/original-synthetic-glyphs");
    await admin.getByLabel("授权名称").fill("CC0-1.0");
    await admin
      .getByLabel("完整授权材料")
      .fill("原创合成测试字形，按 CC0-1.0 允许分发、转换、分片。");
    await admin.getByLabel("样张文字").fill("Aa Aa");
    for (const label of ["允许分发", "允许转码", "允许分片"])
      await admin.getByLabel(label, { exact: true }).check();
    await admin.getByRole("button", { name: "保存配置", exact: true }).click();
    await admin.waitForURL(/\/station\/text-fonts\/tff_[a-f0-9]{32}$/);
    const first = await uploadProcessPreview(admin, 1);
    expect(initialIds.has(first)).toBe(false);
    await screenshotModes(admin, output, "admin-first-published");
    await page.bringToFront();
    await editor.press("Control+A");
    await screenshotModes(page, output, "editor-T-closed");
    await page
      .getByRole("button", { name: "切换正文样式", exact: true })
      .click();
    await screenshotModes(page, output, "editor-T-expanded");
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("dialog", { name: "正文样式" }),
    ).not.toBeVisible();
    await expect(editor).toHaveText("Aa Aa");
    await page
      .getByRole("button", { name: "切换正文样式", exact: true })
      .click();
    await page.getByRole("button", { name: "字体", exact: true }).click();
    await page.getByRole("combobox", { name: "字体" }).click();
    await screenshotModes(page, output, "editor-font-list");
    await page.getByRole("option", { name, exact: true }).click();
    await expect(
      page.getByLabel("字体预览").getByRole("img", { name: "字体样张" }),
    ).toBeVisible();
    await screenshotModes(page, output, "editor-font-selected");
    expect(fontAssetRequests).toHaveLength(0);
    const sessionMarker = await page.evaluate(() => {
      const marker = crypto.randomUUID();
      (window as unknown as { coldFontSession: string }).coldFontSession =
        marker;
      return marker;
    });
    coldRecovery.versionId = first;
    coldRecovery.downloadsBeforeApply = fontAssetRequests.length;
    coldRecovery.interruptedAt = Date.now();
    const interruptedDownload = isolationNetwork.interruptFontDownloads(first);
    await page.getByRole("button", { name: "应用", exact: true }).click();
    const coldSpan = editor.locator(`[data-wenyou-font-v2="${first}"]`);
    await expect
      .poll(
        () =>
          resourceFailures.filter(
            (failure) =>
              failure.path.includes(`/versions/${first}/assets/`) &&
              /\.(?:woff2|ttf|otf)$/u.test(failure.path),
          ).length,
      )
      .toBeGreaterThan(0);
    await expect(coldSpan).toHaveAttribute("data-font-load", "fallback");
    coldRecovery.failureObservedAt = Date.now();
    coldRecovery.failedRequests = [...resourceFailures];
    expect(interruptedDownload.requests.length).toBeGreaterThan(0);
    coldRecovery.interruptedRequests = [...interruptedDownload.requests];
    interruptedDownload.restore();
    coldRecovery.connectionRestoredAt = Date.now();
    // 仅恢复实际连接，保留原页、原选区与原额度；不再次应用、不刷新或派发恢复事件。
    await expect(coldSpan).toHaveAttribute("data-font-load", "ready", {
      timeout: 90000,
    });
    coldRecovery.readyAt = Date.now();
    expect(
      await page.evaluate(
        () =>
          (window as unknown as { coldFontSession: string }).coldFontSession,
      ),
    ).toBe(sessionMarker);
    coldRecovery.samePage = true;
    coldRecovery.recoveredAssetRequests = fontAssetRequests.filter((path) =>
      path.includes(`/versions/${first}/assets/`),
    );
    expect(
      (coldRecovery.recoveredAssetRequests as string[]).length,
    ).toBeGreaterThan(0);
    await screenshotModes(page, output, "editor-font-applied");
    const firstAssetPath = fontAssetRequests.find((path) =>
      path.includes(`/versions/${first}/assets/`),
    );
    expect(firstAssetPath).toBeDefined();
    await page.getByRole("button", { name: "发布", exact: true }).click();
    await page.waitForURL(
      (url) =>
        /^\/threads\/[^/]+$/.test(url.pathname) &&
        url.pathname !== "/threads/create",
    );
    const threadId = new URL(page.url()).pathname.split("/").at(-1)!;
    const thread = (await request("GET", "/api/v1/threads/" + threadId)).body
        .data,
      body = thread.subthreads.find(
        (sub: { id: string }) => sub.id === thread.defaultSubthreadId,
      ).bodyPost;
    expect(body.content).toContain(`data-wenyou-font-v2="${first}"`);
    await expect(
      page.locator(`[data-wenyou-font-v2="${first}"]`).first(),
    ).toHaveAttribute("data-font-load", "ready");
    await screenshotModes(page, output, "reader-first");
    const added = await request(
      "POST",
      "/api/v1/subthreads/" + thread.defaultSubthreadId + "/posts",
      {
        content: body.content,
        textFontVersion: 2,
        textColorVersion: 1,
        markdownContractVersion: 6,
        clientRequestId: crypto.randomUUID(),
      },
    );
    expect(added.status).toBe(201);
    await page.reload();
    const floor = page.locator("#post-" + added.body.data.id);
    await expect(
      floor.locator(`[data-wenyou-font-v2="${first}"]`),
    ).toHaveAttribute("data-font-load", "ready");
    await copyFloorAndSave(
      page,
      added.body.data.id,
      thread.defaultSubthreadId,
      first,
    );
    await checkpoints.checkpoint("published-v1", [first], {
      threadId,
      fontName: name,
    });
    const second = await uploadProcessPreview(admin, 2);
    expect(second).not.toBe(first);
    // 同一页面的新选择必须获得第二版，不能只验证后台当前指针。
    await page.getByRole("button", { name: "发表回复…", exact: true }).click();
    const secondReply = page.getByRole("textbox", {
      name: "楼层正文",
      exact: true,
    });
    await secondReply.fill("Aa");
    await secondReply.press("Control+A");
    await page
      .getByRole("button", { name: "切换正文样式", exact: true })
      .click();
    await page.getByRole("button", { name: "字体", exact: true }).click();
    await page.getByRole("combobox", { name: "字体" }).click();
    await page.getByRole("option", { name, exact: true }).click();
    await page.getByRole("button", { name: "应用", exact: true }).click();
    await expect(
      secondReply.locator(`[data-wenyou-font-v2="${second}"]`),
    ).toHaveAttribute("data-font-load", "ready");
    const secondSaved = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname ===
          `/api/v1/subthreads/${thread.defaultSubthreadId}/posts`,
    );
    await page.getByRole("button", { name: "发布", exact: true }).click();
    const secondResponse = await secondSaved;
    expect(secondResponse.status()).toBe(201);
    expect((await lastObservedPost(page)).content).toContain(
      `data-wenyou-font-v2="${second}"`,
    );
    await page.reload();
    await expect(
      page.locator(`[data-wenyou-font-v2="${first}"]`).first(),
    ).toHaveAttribute("data-font-load", "ready");
    expect(
      (await request("GET", "/api/v1/posts/" + body.id)).body.data.content,
    ).toBe(body.content);
    const savedPost = await copyFloorAndSave(
      page,
      added.body.data.id,
      thread.defaultSubthreadId,
      first,
    );
    await screenshotModes(page, output, "reader-saved-historical-copy");
    await page.context().setOffline(true);
    await expect(
      page
        .locator("#post-" + savedPost.id)
        .locator(`[data-wenyou-font-v2="${first}"]`),
    ).toHaveAttribute("data-font-load", "ready");
    await page.context().setOffline(false);
    const legacy = await request(
      "GET",
      "/api/v1/posts/" + body.id,
      undefined,
      1,
    );
    expect(legacy.body.data.content).not.toContain("data-wenyou-font-v2");
    const protectedWrite = await request(
      "PATCH",
      "/api/v1/posts/" + body.id,
      {
        content: legacy.body.data.content,
        version: body.version,
        textFontVersion: 1,
        markdownContractVersion: 6,
      },
      1,
    );
    expect(protectedWrite.status).toBe(409);
    expect(protectedWrite.body.code).toBe(40019);
    await checkpoints.checkpoint("published-v2", [first, second], {
      threadId,
      fontName: name,
    });
    await admin.getByRole("button", { name: "停用家族", exact: true }).click();
    await expect(
      admin.getByRole("button", { name: "启用家族", exact: true }),
    ).toBeVisible();
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(
      page.locator(`[data-wenyou-font-v2="${first}"]`).first(),
    ).toHaveAttribute("data-font-load", "ready");
    expect(
      (await request("GET", `/api/v1/meta/text-fonts/v2/versions/${first}`))
        .body.data,
    ).toMatchObject({
      selectable: false,
      pasteAllowed: false,
      renderAllowed: true,
    });
    await copyFloorAndSave(
      page,
      added.body.data.id,
      thread.defaultSubthreadId,
      first,
      false,
    );
    await checkpoints.checkpoint("disabled", [first, second], {
      threadId,
      fontName: name,
    });
    await admin.getByRole("button", { name: "启用家族", exact: true }).click();
    await expect(
      admin.getByRole("button", { name: "停用家族", exact: true }),
    ).toBeVisible();
    expect(
      (await request("GET", `/api/v1/meta/text-fonts/v2/versions/${second}`))
        .body.data.selectable,
    ).toBe(true);
    await checkpoints.checkpoint("enabled", [first, second], {
      threadId,
      fontName: name,
    });
    await admin.getByRole("combobox", { name: "字体版本" }).click();
    await admin
      .getByRole("option", { name: first.slice(-8), exact: true })
      .click();
    await expect(
      admin.getByRole("button", { name: "回滚为当前版本", exact: true }),
    ).toBeEnabled();
    const rolledBack = admin.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname.endsWith("/publish"),
    );
    await admin
      .getByRole("button", { name: "回滚为当前版本", exact: true })
      .click();
    expect((await rolledBack).ok()).toBe(true);
    expect(
      (await request("GET", `/api/v1/meta/text-fonts/v2/versions/${first}`))
        .body.data.selectable,
    ).toBe(true);
    expect(
      (await request("GET", "/api/v1/posts/" + body.id)).body.data.content,
    ).toBe(body.content);
    await checkpoints.checkpoint("rollback", [first, second], {
      threadId,
      fontName: name,
    });
    const withdrawingSpan = page
      .locator(`[data-wenyou-font-v2="${first}"]`)
      .first();
    await page.bringToFront();
    await withdrawingSpan.scrollIntoViewIfNeeded();
    await expect(withdrawingSpan).toBeInViewport();
    await expect(withdrawingSpan).toHaveAttribute("data-font-load", "ready");
    await admin
      .getByRole("button", { name: "紧急撤回此版本", exact: true })
      .click();
    await expect(
      admin.getByRole("dialog", { name: "撤回字体版本" }),
    ).toBeVisible();
    await elevateIsolatedAdmin(admin);
    await admin.getByLabel("撤回理由").fill("隔离验收撤回");
    const withdrawn = admin.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname ===
          `/api/v1/admin/text-fonts/versions/${first}/withdraw`,
    );
    await admin.getByRole("button", { name: "确认撤回", exact: true }).click();
    const withdrawnResponse = await withdrawn;
    withdrawalObservations.push({
      versionId: first,
      httpStatus: withdrawnResponse.status(),
      at: Date.now(),
    });
    expect(withdrawnResponse.ok()).toBe(true);
    await expect(
      admin.getByRole("dialog", { name: "撤回字体版本" }),
    ).not.toBeVisible();
    await page.bringToFront();
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(
      page.locator(`[data-wenyou-font-v2="${first}"]`).first(),
    ).toHaveAttribute("data-font-load", "fallback");
    withdrawalObservations.push({
      versionId: first,
      reads: await page.evaluate(
        (id) =>
          (
            window as unknown as {
              fontDescriptorReads: FontDescriptorObservation[];
            }
          ).fontDescriptorReads.filter((read) => read.versionId === id),
        first,
      ),
      visibleFallbackAt: Date.now(),
    });
    expect(
      (await request("GET", "/api/v1/posts/" + body.id)).body.data.content,
    ).toBe(body.content);
    await requireIsolationRunner();
    const deniedAsset = await page.evaluate(async (path) => {
      const response = await fetch(path, { cache: "no-store" });
      const body = await response.json();
      return { status: response.status, code: body.code };
    }, firstAssetPath!);
    expect(deniedAsset).toEqual({ status: 410, code: 41001 });
    await screenshotModes(page, output, "reader-withdrawn");
    await screenshotModes(admin, output, "admin-withdrawn");
    await page.context().setOffline(true);
    await expect(
      page.locator(`[data-wenyou-font-v2="${first}"]`).first(),
    ).toHaveAttribute("data-font-load", "fallback");
    await page.context().setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect(
      page.locator(`[data-wenyou-font-v2="${first}"]`).first(),
    ).toHaveAttribute("data-font-load", "fallback");
    await checkpoints.checkpoint("withdrawn", [first, second], {
      threadId,
      fontName: name,
    });
    // 同一固定导入版本的 v1/v2 源码共享真实原生注册；撤回后两种源标记都保留。
    const imported = legacyImports.fonts.find(
      (font) => font.legacyId === "great-vibes",
    )!;
    const legacyContent = `<span data-wenyou-font-v1="${imported.legacyId}">Aa</span> <span data-wenyou-font-v2="${imported.versionId}">Aa</span>`;
    const legacySaved = await request(
      "POST",
      `/api/v1/subthreads/${thread.defaultSubthreadId}/posts`,
      {
        content: legacyContent,
        textFontVersion: 2,
        textColorVersion: 1,
        markdownContractVersion: 6,
        clientRequestId: crypto.randomUUID(),
      },
    );
    expect(legacySaved.status).toBe(201);
    await page.reload();
    const legacyFloor = page.locator("#post-" + legacySaved.body.data.id);
    await legacyFloor.scrollIntoViewIfNeeded();
    const oldSpan = legacyFloor.locator(
      `[data-wenyou-font-v1="${imported.legacyId}"]`,
    );
    const mappedSpan = legacyFloor.locator(
      `[data-wenyou-font-v2="${imported.versionId}"]`,
    );
    await expect(oldSpan).toHaveAttribute("data-font-load", "ready");
    await expect(mappedSpan).toHaveAttribute("data-font-load", "ready");
    const oldFamily = await oldSpan.evaluate(
      (element) => getComputedStyle(element).fontFamily,
    );
    expect(oldFamily).toContain("WYF1-");
    expect(
      await mappedSpan.evaluate(
        (element) => getComputedStyle(element).fontFamily,
      ),
    ).toBe(oldFamily);
    const aliasRegistrations = await page.evaluate(() =>
      Object.entries(
        (window as unknown as { fontRegistrations: Record<string, number> })
          .fontRegistrations,
      ).filter(([family]) => family.includes("WYF1-")),
    );
    expect(aliasRegistrations.length).toBeGreaterThan(0);
    expect(aliasRegistrations.every(([, count]) => count === 1)).toBe(true);
    expect(legacyAssetRequests).toHaveLength(0);
    await screenshotModes(page, output, "reader-legacy-mapped");
    await checkpoints.checkpoint("legacy-mapped", [imported.versionId], {
      threadId,
    });
    await admin.goto(`/station/text-fonts/${imported.familyId}`);
    await admin.getByRole("combobox", { name: "字体版本" }).click();
    await admin
      .getByRole("option", {
        name: new RegExp("^" + imported.versionId.slice(-8)),
      })
      .click();
    await expect(
      admin.getByRole("button", { name: "紧急撤回此版本", exact: true }),
    ).toBeEnabled();
    await admin
      .getByRole("button", { name: "紧急撤回此版本", exact: true })
      .click();
    await elevateIsolatedAdmin(admin);
    await admin.getByLabel("撤回理由").fill("固定导入映射隔离验收");
    await admin.getByRole("button", { name: "确认撤回", exact: true }).click();
    await expect(
      admin.getByRole("dialog", { name: "撤回字体版本" }),
    ).not.toBeVisible();
    await page.bringToFront();
    await legacyFloor.scrollIntoViewIfNeeded();
    await expect(oldSpan).toBeInViewport();
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(oldSpan).toHaveAttribute("data-font-load", "fallback");
    await expect(mappedSpan).toHaveAttribute("data-font-load", "fallback");
    expect(
      (await request("GET", "/api/v1/posts/" + legacySaved.body.data.id)).body
        .data.content,
    ).toBe(legacyContent);
    expect(legacyAssetRequests).toHaveLength(0);
    await screenshotModes(page, output, "reader-legacy-mapped-withdrawn");
    await checkpoints.checkpoint("legacy-withdrawn", [imported.versionId], {
      threadId,
    });
    const evidence = {
      coordination: checkpoints.summary,
      ...source,
      buildId,
      runId: run.manifest.runId,
      first,
      second,
      threadId,
      viewports: [
        { width: 1024, height: 900 },
        { width: 390, height: 900 },
      ],
      actualUploadPipeline: true,
      coldRecovery,
      pickerFontDownloadsBeforeApply: 0,
      secondVersionSelectedAndSaved: true,
      importedVersion: imported.versionId,
      aliasRegistrations,
      legacyAssetRequests,
    };
    writeFileSync(
      join(output, "evidence.json"),
      JSON.stringify(evidence, null, 2),
    );
    await testInfo.attach("dynamic-font-evidence", {
      body: JSON.stringify(evidence),
      contentType: "application/json",
    });
    await admin.close();
  } finally {
    writeFileSync(
      join(output, "cold-recovery.json"),
      JSON.stringify({ ...coldRecovery, resourceFailures }, null, 2),
      { mode: 0o600 },
    );
    if (!page.isClosed()) {
      const observation = await page
        .evaluate(() => ({
          visibility: document.visibilityState,
          reads:
            (
              window as unknown as {
                fontDescriptorReads?: FontDescriptorObservation[];
              }
            ).fontDescriptorReads ?? [],
          spans: [...document.querySelectorAll("[data-wenyou-font-v2]")]
            .slice(0, 40)
            .map((element) => ({
              versionId: element.getAttribute("data-wenyou-font-v2"),
              load: element.getAttribute("data-font-load"),
              top: element.getBoundingClientRect().top,
              bottom: element.getBoundingClientRect().bottom,
            })),
        }))
        .catch(() => undefined);
      writeFileSync(
        join(output, "withdrawal-observation.json"),
        JSON.stringify({ withdrawalObservations, observation }, null, 2),
        { mode: 0o600 },
      );
    }
    checkpoints.dispose();
    page.off("close", stopCheckpoints);
    writeFileSync(
      join(output, "coordination.json"),
      JSON.stringify(checkpoints.summary, null, 2),
      { mode: 0o600 },
    );
  }
});

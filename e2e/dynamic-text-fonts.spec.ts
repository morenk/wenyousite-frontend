import { createHash, randomUUID } from "node:crypto";
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

async function uploadProcessPreview(page: Page, version: 1 | 2, output: string) {
  if (await page.getByRole("button", { name: "上传另一个文件", exact: true }).isVisible())
    await page.getByRole("button", { name: "上传另一个文件", exact: true }).click();
  const upload = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname.endsWith("/sources"));
  await page.getByLabel("字体文件", { exact: true }).setInputFiles(`e2e/fixtures/dynamic-fonts/synthetic-${version}.ttf`);
  await page.getByRole("button", { name: "上传并处理", exact: true }).click();
  const uploaded = await upload;
  expect(uploaded.status()).toBe(201);
  // Chromium 可回收 XHR 大上传的 inspector 正文；从真实详情按完整源 SHA 查到同一任务。
  const familyId = new URL(uploaded.url()).pathname.split("/").at(-2)!;
  const sourceSha256 = createHash("sha256").update(readFileSync(`e2e/fixtures/dynamic-fonts/synthetic-${version}.ttf`)).digest("hex");
  const job = await page.evaluate(async ({ familyId, sourceSha256 }) => {
    const response = await fetch(`/api/v1/admin/text-fonts/${familyId}`);
    if (!response.ok) throw new Error("隔离字体详情读取失败");
    const detail = (await response.json()).data as components["schemas"]["FontAdminFamilyDetailDto"];
    return detail.jobs.find((job) => job.sourceSha256 === sourceSha256);
  }, { familyId, sourceSha256 });
  expect(job).toBeDefined();
  if (!job) throw new Error("完整源 SHA 未对应到上传任务");
  if (new URL(page.url()).pathname.endsWith("/new")) {
    await expect(page.getByRole("link", { name: "预览并发布", exact: true })).toBeVisible({ timeout: 600000 });
    await expect(page.getByRole("img", { name: "字体样张", exact: true })).toBeVisible();
    await screenshotModes(page, output, "admin-upload-ready");
    await page.getByRole("link", { name: "预览并发布", exact: true }).click();
  }
  const row = page.getByRole("row").filter({ has: page.getByRole("cell", { name: job.jobId.slice(-8), exact: true }) });
  await expect(row.getByRole("button", { name: "预览", exact: true })).toBeVisible({ timeout: 600000 });
  await expect(page.getByRole("button", { name: "预览", exact: true })).toHaveCount(version);
  await row.getByRole("button", { name: "预览", exact: true }).click();
  const beforePublish = await page.evaluate(async (familyId) => (await (await fetch(`/api/v1/admin/text-fonts/${familyId}`)).json()).data as components["schemas"]["FontAdminFamilyDetailDto"], job.familyId);
  const readyVersionId = beforePublish.jobs.find((entry) => entry.jobId === job.jobId)!.versionId;
  expect(readyVersionId).toMatch(/^tfv_/);
  expect(beforePublish.currentVersionId).not.toBe(readyVersionId); // 自动编排不会发布此次新版本。
  await expect(page.getByRole("heading", { name: "版本与发布", exact: true })).toBeInViewport();
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
        if (new URL(page.url()).pathname.endsWith("/new") && await page.getByRole("link", { name: "预览并发布", exact: true }).count()) {
          await expect(page.getByRole("img", { name: "字体样张", exact: true })).toBeVisible();
        } else {
        expect(
          (await page.getByLabel("字体名称", { exact: true }).boundingBox())!
            .width,
        ).toBeGreaterThan(250);
        await expect(
          page
            .getByRole("combobox", { name: /^(语言|语言分类)$/ })
            .locator('[data-slot="select-value"]'),
        ).toHaveText("未分类");
        }
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
    await loginIsolatedAdmin(admin, "/station/text-fonts");
    await admin.getByRole("link", { name: "上传字体", exact: true }).click();
    const name = "隔离样本 " + run.manifest.runId.slice(-8);
    await admin.getByLabel("字体名称").fill(name);
    await screenshotModes(admin, output, "admin-upload-three-fields");
    const first = await uploadProcessPreview(admin, 1, output);
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
    await page.getByRole("button", { name: "切换正文样式", exact: true }).click();
    await page.getByRole("button", { name: "字体", exact: true }).click();
    await page.getByRole("tab", { name: "其他", exact: true }).click();
    await screenshotModes(page, output, "editor-font-list");
    const fontChoice = page.getByRole("button", { name, exact: true });
    await fontChoice.scrollIntoViewIfNeeded();
    await expect(fontChoice.locator("img")).toBeVisible();
    await screenshotModes(page, output, "editor-font-specimen");
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
    await page.getByRole("button", { name, exact: true }).click();
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
    const second = await uploadProcessPreview(admin, 2, output);
    expect(second).not.toBe(first);
    // 同一页面的新选择必须获得第二版，不能只验证后台当前指针。
    await page.getByRole("button", { name: "发表回复…", exact: true }).click();
    const secondReply = page.getByRole("textbox", {
      name: "楼层正文",
      exact: true,
    });
    await secondReply.fill("Aa");
    await secondReply.press("Control+A");
    await page.getByRole("button", { name: "切换正文样式", exact: true }).click();
    await page.getByRole("button", { name: "字体", exact: true }).click();
    await page.getByRole("tab", { name: "其他", exact: true }).click();
    await page.getByRole("button", { name, exact: true }).click();
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


test("管理员浏览器经 Next 完整上传 64 MiB，超限预检及处理失败可恢复", async ({ page }, testInfo) => {
  test.setTimeout(600000);
  const run = await requireIsolationRunner();
  const output = join(process.cwd(), ".e2e-results", `admin-font-upload-${run.manifest.runId}`);
  mkdirSync(output, { recursive: true, mode: 0o700 });
  await loginIsolatedAdmin(page, "/station/text-fonts/new");
  await page.getByLabel("字体名称").fill("上传边界 " + run.manifest.runId.slice(-8));
  const source = Buffer.alloc(64 * 1024 * 1024 + 1);
  readFileSync("e2e/fixtures/dynamic-fonts/synthetic-1.ttf").copy(source);
  let uploads = 0;
  page.on("request", request => {
    if (request.method() === "POST" && new URL(request.url()).pathname.endsWith("/sources")) uploads++;
  });
  const oversizedPath = join(run.root, "web-font-upload-too-large.ttf");
  writeFileSync(oversizedPath, source, { mode: 0o600 });
  await page.getByLabel("字体文件", { exact: true }).setInputFiles(oversizedPath);
  await page.getByRole("button", { name: "上传并处理", exact: true }).click();
  await expect(page.getByText("字体文件不能超过 64 MiB", { exact: true })).toBeVisible();
  expect(uploads).toBe(0);
  const exact = source.subarray(0, 64 * 1024 * 1024);
  const sha256 = createHash("sha256").update(exact).digest("hex");
  const uploaded = page.waitForResponse(response => response.request().method() === "POST" && new URL(response.url()).pathname.endsWith("/sources"), { timeout: 120000 });
  const created = page.waitForRequest(request => request.method() === "POST" && new URL(request.url()).pathname.endsWith("/text-fonts/submissions"));
  const boundaryPath = join(run.root, "web-font-upload-boundary.ttf");
  writeFileSync(boundaryPath, exact, { mode: 0o600 });
  await page.getByLabel("字体文件", { exact: true }).setInputFiles(boundaryPath);
  await page.getByRole("button", { name: "上传并处理", exact: true }).click();
  const submitted = (await created).postDataJSON() as components["schemas"]["CreateFontSubmissionDto"];
  const uploadResponse = await uploaded;
  expect(uploadResponse.status()).toBe(201);
  const familyId = new URL(uploadResponse.url()).pathname.split("/").at(-2)!;
  const readDetail = () => page.evaluate(async (id) => {
    const response = await fetch(`/api/v1/admin/text-fonts/${id}`);
    if (!response.ok) throw new Error("隔离字体详情读取失败");
    return (await response.json()).data as components["schemas"]["FontAdminFamilyDetailDto"];
  }, familyId);
  await expect.poll(async () => (await readDetail()).jobs.some(job => job.sourceBytes === exact.length && job.sourceSha256 === sha256)).toBe(true);
  expect(uploads).toBe(1);
  const boundaryJob = (await readDetail()).jobs.find(job => job.sourceBytes === exact.length && job.sourceSha256 === sha256)!;
  expect(boundaryJob.submissionId).toBe(submitted.submissionId);
  expect(boundaryJob.familyId).toBe(familyId);
  await expect.poll(async () => (await readDetail()).jobs.find(job => job.jobId === boundaryJob.jobId)?.status, { timeout: 300000 }).toMatch(/^(ready|failed)$/);
  expect((await readDetail()).currentVersionId).toBeNull();
  await page.goto(`/station/text-fonts/${familyId}`);
  // 小型无效字体检验真实 Worker 失败/重试；重试必须复用已上传源。

  const invalidUploaded = page.waitForResponse(response => response.request().method() === "POST" && new URL(response.url()).pathname.endsWith("/sources"));
  await page.getByLabel("字体文件", { exact: true }).setInputFiles({ name: "invalid.ttf", mimeType: "application/octet-stream", buffer: Buffer.from("invalid-font") });
  await page.getByRole("button", { name: "上传并处理", exact: true }).click();
  expect((await invalidUploaded).status()).toBe(201);
  const invalid = (await readDetail()).jobs.find(job => job.sourceBytes === 12)!;
  expect(invalid).toBeDefined();
  const row = page.getByRole("row").filter({ has: page.getByRole("cell", { name: invalid.jobId.slice(-8), exact: true }) });
  await expect(row.getByRole("button", { name: "重试处理", exact: true })).toBeVisible({ timeout: 60000 });
  const firstFailure = (await readDetail()).jobs.find(job => job.jobId === invalid.jobId)!;
  expect(firstFailure.status).toBe("failed");
  const retryResponse = page.waitForResponse(response => response.request().method() === "POST" && new URL(response.url()).pathname.includes("/submissions/") && new URL(response.url()).pathname.endsWith("/process"));
  await row.getByRole("button", { name: "重试处理", exact: true }).click();
  const retryAccepted = await retryResponse;
  expect(retryAccepted.ok()).toBe(true);
  expect((await retryAccepted.json()).data.status).toBe("queued");
  await expect.poll(async () => {
    const job = (await readDetail()).jobs.find(job => job.jobId === invalid.jobId)!;
    return job.status === "failed";
  }, { timeout: 60000 }).toBe(true);
  await expect(row.getByRole("button", { name: "重试处理", exact: true })).toBeVisible();
  expect(uploads).toBe(2);
  await screenshotModes(page, output, "admin-upload-failure-retry");
  const evidence = { ...evidenceSource(), runId: run.manifest.runId, backendURL: run.manifest.backendURL, candidateBuildId: readFileSync(join(process.env.E2E_BUILD_DIR!, "BUILD_ID"), "utf8").trim(), browserOrigin: new URL(page.url()).origin, uploadHttpStatus: uploadResponse.status(), boundaryJobId: boundaryJob.jobId, boundarySubmissionId: boundaryJob.submissionId, bytes: exact.length, sha256, uploads, oversizedBlockedBeforeRequest: true, failedJob: (await readDetail()).jobs.find(job => job.jobId === invalid.jobId) };
  writeFileSync(join(output, "evidence.json"), JSON.stringify(evidence, null, 2));
  await testInfo.attach("admin-font-upload-evidence", { body: JSON.stringify(evidence), contentType: "application/json" });
});


test("字体管理全量筛选分页、URL恢复与键盘整组排序一次保存", async ({ page }, testInfo) => {
  test.setTimeout(240000);
  const run = await requireIsolationRunner();
  const output = join(process.cwd(), ".e2e-results", `font-management-${run.manifest.runId}`); mkdirSync(output, { recursive: true });
  await loginIsolatedAdmin(page, "/station/text-fonts");
  const request = (path: string) => page.evaluate(async (path) => {
    const response = await fetch(`/api/v1/admin/text-fonts${path}`);
    if (!response.ok) throw new Error(`隔离字体管理请求失败：${response.status}`);
    return (await response.json()).data;
  }, path);
  const prefix = `分页-${run.manifest.runId.slice(-8)}-`;
  await page.evaluate(async (prefix) => {
    // 会话接口限流10次/分钟；整个夹具批次复用一次读取的 CSRF，仅保留在页面内存。
    const sessionResponse = await fetch("/api/v1/admin/auth/session");
    if (!sessionResponse.ok) throw new Error(`隔离管理会话读取失败：${sessionResponse.status}`);
    const session = (await sessionResponse.json()).data;
    for (let index = 0; index < 23; index++) {
      const response = await fetch("/api/v1/admin/text-fonts/submissions", {
        method: "POST", headers: { "X-CSRF-Token": session.csrfToken, "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId: crypto.randomUUID(), name: prefix + String(index).padStart(2, "0"), language: "en" }),
      });
      if (response.status !== 201) throw new Error(`隔离字体夹具创建失败：${response.status}`);
    }
  }, prefix);
  await page.goto(`/station/text-fonts?search=${encodeURIComponent(prefix)}&language=en&status=draft&sort=name&direction=asc`);
  await expect(page.getByText(prefix + "00", { exact: true })).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(20);
  await screenshotModes(page, output, "management-filtered");
  await page.getByRole("button", { name: "下一页", exact: true }).click();
  await expect(page.getByText(prefix + "22", { exact: true })).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(3);
  await page.getByRole("textbox", { name: "名称搜索" }).fill(prefix + "22");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "上一页", exact: true })).toBeDisabled();
  await expect.poll(() => new URL(page.url()).searchParams.get("search")).toBe(prefix + "22");
  await page.reload();
  await expect(page.getByRole("textbox", { name: "名称搜索" })).toHaveValue(prefix + "22");
  await expect(page.getByText(prefix + "22", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /^重置\s*3$/ }).click();
  await expect(page.getByRole("combobox", { name: "排序" }).locator('[data-slot="select-value"]')).toHaveText("最近新增");
  await expect(page.getByRole("button", { name: "降序排列，切换为升序" })).toBeVisible();
  const beforeDefault = await request("/management?sort=createdAt&direction=desc") as components["schemas"]["FontManagementPageDto"];
  const before: components["schemas"]["FontManagementItemDto"][] = [];
  let cursor: string | null = null, catalogRevision = 0;
  do {
    const next = await request(`/management?status=enabled&sort=sortOrder&direction=asc${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`) as components["schemas"]["FontManagementPageDto"];
    before.push(...next.items); cursor = next.nextCursor; catalogRevision = next.catalogRevision;
  } while (cursor);
  const language = (["zh", "ja", "en", "other"] as const).find((language) => before.filter((font) => font.language === language).length >= 2)!;
  expect(language, "本轮隔离资源须提供完整历史字体导入集合").toBeDefined();
  const group = before.filter((font) => font.language === language);
  const editorPage = await page.context().newPage();
  await loginAsE2eUser(editorPage); await openFreshThreadDraft(editorPage);
  const editor = editorPage.locator(".ProseMirror"); await editor.fill("Aa"); await editor.press("Control+A");
  await editorPage.getByRole("button", { name: "切换正文样式", exact: true }).click();
  await editorPage.getByRole("button", { name: "字体", exact: true }).click();
  const pickerLanguage = ({ zh: "中文", ja: "日文", en: "英文", other: "其他" } as const)[language];
  await editorPage.getByRole("tab", { name: pickerLanguage, exact: true }).click();
  const choices = editorPage.locator(`[aria-label="${pickerLanguage}字体"]`).getByRole("button");
  await expect(choices.nth(0)).toHaveAccessibleName(group[0]!.name);
  await expect(choices.nth(1)).toHaveAccessibleName(group[1]!.name);
  const documentMarker = await editorPage.evaluate(() => {
    const state = window as unknown as { orderDocument: string; orderForeground: { type: string; trusted: boolean; visibility: string }[] };
    state.orderDocument = crypto.randomUUID(); state.orderForeground = [];
    const record = (event: Event) => state.orderForeground.push({ type: event.type, trusted: event.isTrusted, visibility: document.visibilityState });
    window.addEventListener("focus", record); window.addEventListener("visibilitychange", record);
    return state.orderDocument;
  });
  let fontDownloads = 0; editorPage.on("request", (request) => { if (/\/meta\/text-fonts\/v2\/versions\/[^/]+\/assets\/[^?]+\.(woff2|ttf|otf)(?:\?|$)/.test(request.url())) fontDownloads++; });
  await page.bringToFront();
  await page.getByRole("button", { name: "调整展示顺序", exact: true }).click();
  const languageLabel = ({ zh: "中文", ja: "日文", en: "英文", other: "未分类" } as const)[language];
  const section = page.getByRole("region", { name: `${languageLabel}展示顺序`, exact: true });
  const moving = section.getByRole("listitem").nth(1);
  await expect(moving).toHaveAttribute("aria-label", `${group[1]!.name}，第 2 位`);
  let writes = 0; page.on("request", (request) => { if (request.method() === "PUT" && new URL(request.url()).pathname.endsWith("/text-fonts/order")) writes++; });
  await moving.focus(); await moving.press("Alt+ArrowUp");
  await expect(section.getByRole("listitem").first()).toHaveAttribute("aria-label", `${group[1]!.name}，第 1 位`);
  expect(writes).toBe(0);
  const saved = page.waitForResponse((response) => response.request().method() === "PUT" && new URL(response.url()).pathname.endsWith("/text-fonts/order"));
  await page.getByRole("button", { name: "保存顺序", exact: true }).click();
  const response = await saved; expect(response.ok()).toBe(true); expect(writes).toBe(1);
  const body = response.request().postDataJSON() as components["schemas"]["ReorderFontsDto"];
  expect(body.expectedCatalogRevision).toBe(catalogRevision); expect(body.groups).toHaveLength(1);
  expect(body.groups[0]!.items).toEqual([group[1]!, group[0]!, ...group.slice(2)].map((font) => ({ familyId: font.familyId, expectedFamilyRevision: font.revision })));
  await expect(page.getByRole("combobox", { name: "排序" }).locator('[data-slot="select-value"]')).toHaveText("最近新增");
  const afterDefault = await request("/management?sort=createdAt&direction=desc") as components["schemas"]["FontManagementPageDto"];
  expect(afterDefault.items.map((font) => font.familyId)).toEqual(beforeDefault.items.map((font) => font.familyId));
  const catalog = await page.evaluate(async () => {
    const items: components["schemas"]["FontCatalogEntryDto"][] = []; let cursor: string | null = null;
    do {
      const response = await fetch(`/api/v1/meta/text-fonts/v2${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`);
      if (!response.ok) throw new Error("隔离目录读取失败");
      const body = (await response.json()).data as components["schemas"]["FontCatalogPageDto"]; items.push(...body.items); cursor = body.nextCursor;
    } while (cursor);
    return items;
  });
  expect(catalog.filter((font) => font.designLanguage === language).slice(0, 2).map((font) => font.familyId)).toEqual([group[1]!.familyId, group[0]!.familyId]);
  const refreshed = editorPage.waitForResponse(response => response.request().method() === "GET" && new URL(response.url()).pathname === "/api/v1/meta/text-fonts/v2");
  await editorPage.bringToFront();
  const nativeForeground = await editorPage.evaluate(() => (window as unknown as { orderForeground: { type: string; trusted: boolean; visibility: string }[] }).orderForeground);
  // Playwright 多页均视作活动页；显式发送浏览器事件验证生产订阅，不调用 refetch 或注入目录。
  await editorPage.evaluate(() => window.dispatchEvent(new Event("visibilitychange")));
  const refreshedResponse = await refreshed;
  expect(refreshedResponse.status()).toBe(200);
  const refreshedCatalog = (await refreshedResponse.json()).data as components["schemas"]["FontCatalogPageDto"];
  expect(refreshedCatalog.revision).toBeGreaterThan(catalogRevision);
  const foreground = await editorPage.evaluate(() => (window as unknown as { orderForeground: { type: string; trusted: boolean; visibility: string }[] }).orderForeground);
  await expect(choices.nth(0)).toHaveAccessibleName(group[1]!.name);
  await expect(choices.nth(1)).toHaveAccessibleName(group[0]!.name);
  expect(await editorPage.evaluate(() => (window as unknown as { orderDocument: string }).orderDocument)).toBe(documentMarker);
  expect(fontDownloads).toBe(0);
  await page.bringToFront();
  await screenshotModes(page, output, "management-list");
  await page.getByRole("button", { name: "调整展示顺序", exact: true }).click();
  await expect(page.getByRole("button", { name: "保存顺序", exact: true })).toBeVisible();
  await screenshotModes(page, output, "management-order");
  const evidence = { ...evidenceSource(), runId: run.manifest.runId, matched: 23, pageSizes: [20, 3], writes, language, openedPickerOrderUpdated: true, sameDocument: true, nativeForeground, foreground, foregroundTrigger: "controlled visibilitychange browser event", refreshedCatalogStatus: refreshedResponse.status(), catalogRevisionAfter: refreshedCatalog.revision, fontDownloads, catalogRevisionBefore: catalogRevision, changedFamilies: body.groups[0]!.items.map((item) => item.familyId) };
  writeFileSync(join(output, "evidence.json"), JSON.stringify(evidence, null, 2), { mode: 0o600 });
  await testInfo.attach("font-management-evidence", { body: JSON.stringify(evidence), contentType: "application/json" });
  await editorPage.close();
});

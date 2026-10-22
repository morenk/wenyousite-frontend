import type { components } from "../src/api/types";
import { expect } from "@playwright/test";
import { test } from "./fixtures/isolation";
import { loginAsE2eUser, openFreshThreadDraft } from "./fixtures/auth";
import { requireIsolationRunner } from "../scripts/e2e-isolation-gate.mjs";
import { EDITOR_COMPOSITION_MESSAGE } from "../src/components/editor/use-editor-submission";

test("先选颜色后输入可发布，已着色选区可再次改色", async ({ page, browserName }) => {
  test.setTimeout(180000);
  await loginAsE2eUser(page);
  // CDP 经过 Chromium 的原生组合输入管线，不等同于人工操作系统输入法验收。
  const cdp = browserName === "chromium" ? await page.context().newCDPSession(page) : null;
  try {
    for (const mode of ["普通输入", ...(cdp ? ["组合输入"] : [])]) {
      await openFreshThreadDraft(page);
      await page.getByLabel("主题帖标题").fill("颜色输入回归 " + mode + Date.now());
      const editor = page.locator(".ProseMirror");
      const menu = page.getByRole("button", { name: "切换正文样式", exact: true });
      await editor.click();
      await editor.press("Control+b");
      await menu.click();
      await page.getByRole("button", { name: "红色", exact: true }).click();
      let text = "color";
      if (mode === "组合输入" && cdp) {
        const writes: string[] = [];
        const onRequest = (request: import("@playwright/test").Request) => {
          if (request.method() === "PATCH" && /^\/api\/v1\/threads\/[^/]+\/aggregate$/.test(new URL(request.url()).pathname)) writes.push(request.url());
        };
        page.on("request", onRequest);
        try {
          await cdp.send("Input.imeSetComposition", { text: "ni", selectionStart: 2, selectionEnd: 2 });
          await expect(editor).toHaveText("ni");
          // 保持焦点和未完成组合，验证提交保护；真实点击失焦可能先确认候选。
          await page.getByRole("button", { name: "发布", exact: true }).evaluate((button: HTMLButtonElement) => button.click());
          await expect(page.getByText(EDITOR_COMPOSITION_MESSAGE, { exact: true })).toBeVisible();
          expect(writes).toEqual([]);
          await cdp.send("Input.imeSetComposition", { text: "你", selectionStart: 1, selectionEnd: 1 });
          await expect(editor).toHaveText("你");
          await cdp.send("Input.insertText", { text: "你" });
          await editor.pressSequentially("A");
          // 连续第二轮组词及取消候选不能留下锁定或多余文字。
          await cdp.send("Input.imeSetComposition", { text: "hao", selectionStart: 3, selectionEnd: 3 });
          await cdp.send("Input.insertText", { text: "好" });
          await cdp.send("Input.imeSetComposition", { text: "quxiao", selectionStart: 6, selectionEnd: 6 });
          await cdp.send("Input.imeSetComposition", { text: "", selectionStart: 0, selectionEnd: 0 });
          text = "你A好";
        } finally { page.off("request", onRequest); }
      } else {
        await editor.pressSequentially(text);
      }
      await expect(editor).toHaveText(text);
      await expect(editor.locator('[data-wenyou-color-v1="#D14343"]')).toHaveText(text);
      await expect(editor.locator("strong")).toHaveText(text);

      await editor.press("Control+a");
      await menu.click();
      await expect(page.getByRole("button", { name: "红色", exact: true })).toHaveAttribute("aria-pressed", "true");
      await page.getByRole("button", { name: "蓝色", exact: true }).click();
      await expect(editor.locator('[data-wenyou-color-v1="#2563EB"]')).toHaveText(text);
      await editor.press("Control+z");
      await expect(editor.locator('[data-wenyou-color-v1="#D14343"]')).toHaveText(text);
      await editor.press("Control+Shift+z");
      await expect(editor.locator('[data-wenyou-color-v1="#2563EB"]')).toHaveText(text);
      await menu.click();
      await page.getByRole("button", { name: "自定义", exact: true }).click();
      await page.getByRole("textbox", { name: "R", exact: true }).fill("200");
      await page.getByRole("button", { name: "取消", exact: true }).click();
      await expect(editor).toBeFocused();
      expect(await page.evaluate(() => window.getSelection()?.toString())).toBe(text);
      await expect(editor.locator('[data-wenyou-color-v1="#2563EB"]')).toHaveText(text);
      await menu.click();
      await page.getByRole("button", { name: "默认文字颜色", exact: true }).click();
      await expect(editor.locator("[data-wenyou-color-v1]")).toHaveCount(0);
      await expect(editor.locator("strong")).toHaveText(text);
      await editor.press("Control+z");
      await expect(editor.locator('[data-wenyou-color-v1="#2563EB"]')).toHaveText(text);

      const publishing = page.waitForResponse((response) => response.request().method() === "PATCH" && /^\/api\/v1\/threads\/[^/]+\/aggregate$/.test(new URL(response.url()).pathname));
      await page.getByRole("button", { name: "发布", exact: true }).click();
      const published = await publishing;
      expect(published.status()).toBe(200);
      const saved: components["schemas"]["ThreadDetailResponseDto"] = (await published.json()).data;
      const content = saved.subthreads.find((subthread) => subthread.id === saved.defaultSubthreadId)!.bodyPost!.content;
      expect(content).toBe('<span data-wenyou-color-v1="#2563EB">**' + text + '**</span>');
      await page.waitForURL((url) => /^\/threads\/[^/]+$/.test(url.pathname) && url.pathname !== "/threads/create");
      await page.reload();
      await expect(page.locator('[data-slot="markdown-content"] [data-wenyou-color-v1="#2563EB"]').first()).toHaveText(text);
    }
  } finally {
    // 超时后 Playwright 可能已关闭页面，清理错误不能覆盖原始断言。
    await cdp?.detach().catch(() => {});
  }
});

test("App规范颜色源在Web阅读、编辑、复制与草稿保源，旧端拒绝覆盖", async ({ page }) => {
  test.setTimeout(180000);
  const run = await requireIsolationRunner();
  const loggedIn = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname === "/api/v1/auth/login");
  await loginAsE2eUser(page);
  const owner = (await (await loggedIn).json()).data;
  const headers = { Authorization: "Bearer " + owner.accessToken, "X-Text-Color-Version": "1", "X-Markdown-Contract-Version": "6" };
  const request = async (method: string, path: string, data?: unknown, capability = true) => {
    return page.evaluate(async ({ method, path, data, headers }) => {
      const response = await fetch(path, { method, headers: { ...headers, ...(data ? { "Content-Type": "application/json" } : {}) }, ...(data ? { body: JSON.stringify(data) } : {}) });
      return { status: response.status, headers: Object.fromEntries(response.headers), body: await response.json() };
    }, { method, path, data, headers: capability ? headers : { Authorization: headers.Authorization } });
  };
  const meta = (await request("GET", "/api/v1/meta")).body.data;
  expect(meta.capabilities.textColorV1Supported).toBe(true);
  expect(meta.capabilities.textColorV1WriteEnabled).toBe(true);
  await openFreshThreadDraft(page);
  await page.getByLabel("主题帖标题").fill("文字颜色隔离验收 " + Date.now());
  const initialEditor = page.locator(".ProseMirror");
  await initialEditor.fill("正文颜色验收");
  await initialEditor.press("Control+End");
  await initialEditor.press("Control+b");
  await page.getByRole("button", { name: "切换正文样式" }).click();
  await page.getByRole("button", { name: "红色", exact: true }).click();
  // 自定义取消和 Escape 不应清掉既有显式输入色，首字也必须保持。
  await page.getByRole("button", { name: "切换正文样式" }).click();
  await page.getByRole("button", { name: "自定义", exact: true }).click();
  await page.getByRole("textbox", { name: "R", exact: true }).fill("0");
  await page.getByRole("button", { name: "取消", exact: true }).click();
  await page.keyboard.insertText("红");
  await expect(initialEditor.locator('[data-wenyou-color-v1="#D14343"]')).toHaveText("红");
  await expect(initialEditor.locator("strong")).toHaveText("红");
  await page.getByRole("button", { name: "切换正文样式" }).click();
  await page.getByRole("button", { name: "自定义", exact: true }).click();
  await page.keyboard.press("Escape");
  await page.keyboard.insertText("色😀");
  await initialEditor.press("Enter");
  await page.keyboard.insertText("次行");
  await expect(initialEditor.locator('[data-wenyou-color-v1="#D14343"]')).toHaveText(["红色😀", "次行"]);
  await initialEditor.press("Control+A");
  await page.getByRole("button", { name: "切换正文样式" }).click();
  await page.getByRole("button", { name: "自定义", exact: true }).click();
  const beforeColor = await initialEditor.innerHTML();
  // 实际指针拖动只改变取色盘预览，不能提前修改正文。
  const channels = () => Promise.all(["R", "G", "B"].map((name) => page.getByRole("textbox", { name, exact: true }).inputValue()));
  for (const name of ["饱和度与亮度", "色相"]) {
    const beforeDrag = await channels();
    const box = await page.getByRole("slider", { name, exact: true }).boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move(box!.x + box!.width * 0.2, box!.y + box!.height * 0.7);
    await page.mouse.down();
    await page.mouse.move(box!.x + box!.width * 0.75, box!.y + box!.height * 0.25, { steps: 6 });
    await page.mouse.up();
    await expect.poll(channels).not.toEqual(beforeDrag);
    expect(await initialEditor.innerHTML()).toBe(beforeColor);
  }
  await page.getByRole("textbox", { name: "R", exact: true }).fill("256");
  await expect(page.getByRole("button", { name: "应用", exact: true })).toBeDisabled();
  for (const [name, value] of [["R", "18"], ["G", "140"], ["B", "90"]]) {
    await page.getByRole("textbox", { name, exact: true }).fill(value!);
  }
  expect(await initialEditor.innerHTML()).toBe(beforeColor);
  await page.getByRole("button", { name: "应用", exact: true }).click();
  await expect(initialEditor.locator('[data-wenyou-color-v1="#128C5A"]')).toHaveText(["正文颜色验收", "红色😀", "次行"]);
  await initialEditor.press("Control+z");
  await expect(initialEditor.locator('[data-wenyou-color-v1="#D14343"]')).toHaveText(["红色😀", "次行"]);
  await initialEditor.press("Control+Shift+z");
  await expect(initialEditor.locator('[data-wenyou-color-v1="#128C5A"]')).toHaveText(["正文颜色验收", "红色😀", "次行"]);

  await page.getByRole("button", { name: "发布", exact: true }).click();
  await page.waitForURL((url) => /^\/threads\/[^/]+$/.test(url.pathname) && url.pathname !== "/threads/create");
  const threadId = new URL(page.url()).pathname.split("/").at(-1)!;
  const thread: components["schemas"]["ThreadDetailResponseDto"] = (await request("GET", "/api/v1/threads/" + threadId)).body.data;
  const subthread = thread.subthreads.find((entry) => entry.id === thread.defaultSubthreadId)!;
  expect(subthread.bodyPost!.content).toContain('data-wenyou-color-v1="#128C5A"');
  expect(subthread.bodyPost!.content).toContain("正文颜色验收");
  expect(subthread.bodyPost!.content).toContain("**红色😀**");
  expect(subthread.bodyPost!.content).toContain("**次行**");
  const source = '<span data-wenyou-color-v1="#D14343">**中文😀** *斜体* ~~删除~~ [链接](https://example.com) `字面`</span> 普通文字';
  const bodyUpdate = await request("PUT", "/api/v1/subthreads/" + thread.defaultSubthreadId + "/body", {
    content: source, version: subthread.bodyPost!.version, textColorVersion: 1, markdownContractVersion: 6,
  });
  expect(bodyUpdate.status).toBe(200);
  const postResult = await request("POST", "/api/v1/subthreads/" + thread.defaultSubthreadId + "/posts", {
    content: source, textColorVersion: 1, markdownContractVersion: 6, clientRequestId: crypto.randomUUID(),
  });
  expect(postResult.status).toBe(201);
  const post = postResult.body.data;
  await page.reload();
  const floor = page.locator("#post-" + post.id);
  await expect(floor.locator('[data-wenyou-color-v1="#D14343"]')).toHaveCount(1);
  await expect(floor.locator('[data-wenyou-color-v1] strong')).toHaveCSS("color", "rgb(209, 67, 67)");
  await expect(floor.locator('[data-wenyou-color-v1] a')).toHaveCSS("color", "rgb(209, 67, 67)");
  await expect(floor.locator('[data-wenyou-color-v1] code')).toHaveCSS("color", "rgb(209, 67, 67)");
  for (const dark of [false, true]) {
    await page.getByRole("button", { name: /^外观：/ }).click();
    await page.locator('[data-slot="theme-menu-popup"]').getByText(dark ? "黑夜" : "亮色", { exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", dark ? "dark" : "light");
    await expect(floor.locator('[data-wenyou-color-v1] strong')).toHaveCSS("color", "rgb(209, 67, 67)");
    await floor.screenshot({ path: ".e2e-results/" + run.manifest.runId + (dark ? "-text-color-dark.png" : "-text-color-light.png") });
  }

  const legacy = await request("GET", "/api/v1/posts/" + post.id, undefined, false);
  expect(legacy.status).toBe(200);
  expect(legacy.body.data.content).not.toContain("data-wenyou-color-v1");
  expect(legacy.body.data.content).toContain("**中文😀**");
  expect(legacy.headers.vary).toContain("X-Text-Color-Version");
  const rejected = await request("PATCH", "/api/v1/posts/" + post.id, { content: "旧端删光颜色", version: post.version }, false);
  expect(rejected.status).toBe(409);
  expect(rejected.body.code).toBe(40016);

  await page.evaluate(() => Object.defineProperty(navigator, "clipboard", { configurable: true, value: {
    write: async (items: ClipboardItem[]) => {
      const entry = items[0]!;
      (window as unknown as { copied: { html: string; text: string } }).copied = {
        html: await (await entry.getType("text/html")).text(), text: await (await entry.getType("text/plain")).text(),
      };
    },
  } }));
  await floor.getByRole("button", { name: "更多楼层操作", exact: true }).click();
  await page.getByRole("menuitem", { name: "复制内容", exact: true }).click();
  await page.waitForFunction(() => typeof (window as unknown as { copied?: { html?: string } }).copied?.html === "string");
  const copied = await page.evaluate(() => (window as unknown as { copied: { html: string; text: string } }).copied);
  expect(copied.html).toContain('data-wenyou-color-v1="#D14343"');
  expect(copied.text).not.toContain("<span");
  await floor.getByRole("button", { name: "更多楼层操作", exact: true }).click();
  await page.getByRole("menuitem", { name: "编辑", exact: true }).click();
  const editor = page.getByRole("textbox", { name: "编辑正文", exact: true });
  const editorColors = editor.locator('[data-wenyou-color-v1="#D14343"]');
  await expect(editorColors).toHaveText(["中文😀", " ", "斜体", " ", "删除", " ", "链接", " ", "字面"]);
  for (const dark of [false, true]) {
    await page.getByRole("button", { name: /^外观：/ }).click();
    await page.locator('[data-slot="theme-menu-popup"]').getByText(dark ? "黑夜" : "亮色", { exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", dark ? "dark" : "light");
    // ProseMirror 按组合 mark 拆分 DOM；逐段核验实际着色文字，而不要求 reader 的单一 span 结构。
    for (const segment of await editorColors.all()) await expect(segment).toHaveCSS("color", "rgb(209, 67, 67)");
    await expect(editor.locator("strong")).toHaveText("中文😀");
    await expect(editor.locator("em")).toHaveText("斜体");
    await expect(editor.locator("del")).toHaveText("删除");
    await expect(editor.locator("a")).toHaveText("链接");
    await expect(editor.locator("a")).toHaveAttribute("href", "https://example.com");
    await expect(editor.locator("code")).toHaveText("字面");
    await editor.screenshot({ path: ".e2e-results/" + run.manifest.runId + (dark ? "-text-color-editor-dark.png" : "-text-color-editor-light.png") });
  }
  await editor.press("Control+End");
  await editor.pressSequentially(" Web编辑");
  const saving = page.waitForResponse((response) => response.request().method() === "PATCH" && new URL(response.url()).pathname.endsWith("/posts/" + post.id));
  await page.getByRole("button", { name: "保存修改", exact: true }).click();
  expect((await saving).status()).toBe(200);
  const saved = (await request("GET", "/api/v1/posts/" + post.id)).body.data;
  expect(saved.content).toContain('data-wenyou-color-v1="#D14343"');
  expect(saved.content).toContain("**中文😀**");
  expect(saved.content).toContain("Web编辑");

  // 保存后再次进入编辑，验证远端读取重建的完整 mark 和文字颜色。
  await expect(floor).toContainText("Web编辑");
  await floor.getByRole("button", { name: "更多楼层操作", exact: true }).click();
  await page.getByRole("menuitem", { name: "编辑", exact: true }).click();
  await expect(editorColors).toHaveText(["中文😀", " ", "斜体", " ", "删除", " ", "链接", " ", "字面"]);
  await expect(editor.locator("strong")).toHaveText("中文😀");
  await expect(editor.locator("em")).toHaveText("斜体");
  await expect(editor.locator("del")).toHaveText("删除");
  await expect(editor.locator("a")).toHaveAttribute("href", "https://example.com");
  await expect(editor.locator("code")).toHaveText("字面");
  await page.getByRole("button", { name: "取消", exact: true }).click();

  // 全套用例共享本轮隔离账号；自动草稿可能已占槽位，按实际版本覆盖该测试账号自己的草稿。
  const state: components["schemas"]["DraftStateResponseDto"] = (await request("GET", "/api/v1/drafts/state")).body.data;
  const previous = state.drafts.find((entry) => entry.slot === 1);
  const draft = previous
    ? await request("PATCH", "/api/v1/drafts/" + previous.id, { content: source, version: previous.version, textColorVersion: 1, markdownContractVersion: 6 })
    : await request("POST", "/api/v1/drafts", { content: source, slot: 1, textColorVersion: 1, markdownContractVersion: 6, clientRequestId: crypto.randomUUID() });
  expect(draft.status).toBe(previous ? 200 : 201);
  await page.getByRole("button", { name: "发表回复…", exact: true }).click();
  const composing = page.getByRole("textbox", { name: "楼层正文", exact: true });
  await composing.evaluate((element, payload) => {
    const clipboardData = new DataTransfer(); clipboardData.setData("text/html", payload.html); clipboardData.setData("text/plain", payload.text);
    element.dispatchEvent(new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData }));
  }, copied);
  await expect(composing.locator('[data-wenyou-color-v1="#D14343"]')).toHaveText(["中文😀", " ", "斜体", " ", "删除", " ", "链接", " ", "字面"]);
  await composing.press("Control+End");
  await composing.pressSequentially(" 临时修改");
  await page.getByRole("button", { name: "正文草稿", exact: true }).click();
  const panel = page.getByRole("region", { name: "正文草稿", exact: true });
  await panel.getByRole("button", { name: "恢复", exact: true }).first().click();
  await page.getByRole("button", { name: "覆盖并恢复", exact: true }).click();
  await expect(composing.locator('[data-wenyou-color-v1="#D14343"]')).toHaveText(["中文😀", " ", "斜体", " ", "删除", " ", "链接", " ", "字面"]);
  await expect(composing).toContainText("普通文字");
  await expect(composing).not.toContainText("临时修改");
  await page.locator("body").click({ position: { x: 2, y: 2 } });
  const storedDraft = await request("GET", "/api/v1/drafts/" + draft.body.data.id);
  expect(storedDraft.body.data.content).toBe(source);
});

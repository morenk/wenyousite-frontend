import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { loginAsE2eUser } from "../fixtures/auth";

// 真实登录不录制密码/令牌；仅记录新建测试草稿 ID、内容摘要和阶段。
test.use({ trace: "off", screenshot: "off", video: "off" });
test.skip(process.env.RICH_TEXT_REAL_API !== "true", "需要显式 S5 真实 API 入口");

test("候选 Web 经真实 API 保存并重开新建私密富文本草稿", async ({ page }) => {
  const evidence: Record<string, unknown> = {
    environment: "real-api", status: "failed", stage: "meta", published: false,
    candidateSha: process.env.RICH_TEXT_CANDIDATE_SHA, harnessSha: process.env.RICH_TEXT_HARNESS_SHA,
    apiSha: process.env.RICH_TEXT_EXPECTED_API_SHA, createdIds: {},
  };
  const runDir = process.env.RICH_TEXT_RUN_DIR!;
  expect(runDir).toBeTruthy();
  expect(process.env.RICH_TEXT_CANDIDATE_SHA).toBe("6859f00c305b7c63a62fc2d3f709d811c55f2dc0");
  expect(process.env.RICH_TEXT_HARNESS_SHA).toMatch(/^[a-f0-9]{40}$/u);
  try {
    const meta = await page.request.get("/api/v1/meta");
    expect(meta.ok()).toBe(true);
    expect((await meta.json()).data.buildSha).toBe(process.env.RICH_TEXT_EXPECTED_API_SHA);
    evidence.stage = "login";
    try { await loginAsE2eUser(page); } catch { throw new Error("S5 real login failed; credential details suppressed"); }
    evidence.stage = "create-private-draft";
    await page.goto("/threads/create");
    const createdResponse = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/v1/threads" && response.request().method() === "POST");
    await page.getByRole("button", { name: "新建主题帖", exact: true }).click();
    const created = await createdResponse;
    expect(created.ok()).toBe(true);
    const thread = (await created.json()).data;
    expect(thread.published).toBe(false);
    const subthread = thread.defaultSubthread ?? thread.subthreads?.find((item: { id: string }) => item.id === thread.defaultSubthreadId);
    evidence.createdIds = { threadId: thread.id, subthreadId: subthread?.id, bodyPostId: subthread?.bodyPost?.id };
    const editor = page.locator(".milkdown-editor .ProseMirror").first();
    await expect(editor).toBeVisible();
    const title = `S5 富文本私密草稿 ${Date.now()}`;
    await page.getByPlaceholder("给你的主题帖起个名字").fill(title);
    await page.getByLabel("分区").click();
    await page.locator('[role="option"]:not([data-disabled])').first().click();
    await page.getByLabel("可见性").click();
    await page.getByRole("option", { name: "私密", exact: true }).click();
    await editor.click();
    const bold = page.getByRole("toolbar", { name: "正文格式工具栏" }).getByRole("button", { name: "粗体", exact: true });
    await bold.click();
    await page.keyboard.insertText("S5 样式");
    await bold.click();
    await page.keyboard.insertText(" > 引用源码 * 星号 🙂");
    await page.keyboard.press("Enter");
    await page.keyboard.insertText("\u00a0甲\u00a0");
    evidence.stage = "save";
    const savedResponse = page.waitForResponse((response) => new URL(response.url()).pathname === `/api/v1/threads/${thread.id}/aggregate` && response.request().method() === "PATCH");
    await page.getByRole("button", { name: "保存草稿", exact: true }).click();
    const saved = await savedResponse;
    expect(saved.ok()).toBe(true);
    const request = saved.request().postDataJSON();
    expect(request.visibility).toBe("PRIVATE");
    expect(request.published).not.toBe(true);
    const savedThread = (await saved.json()).data;
    expect(savedThread.published).toBe(false);
    expect(savedThread.visibility).toBe("PRIVATE");
    const savedBody = savedThread.defaultSubthread?.bodyPost
      ?? savedThread.subthreads?.find((item: { id: string }) => item.id === savedThread.defaultSubthreadId)?.bodyPost;
    expect(savedBody.content).toBe(request.content);
    evidence.createdIds = { ...evidence.createdIds as object, bodyPostId: savedBody.id };
    evidence.canonicalSha256 = createHash("sha256").update(savedBody.content).digest("hex");
    evidence.bodyVersion = savedBody.version;
    evidence.stage = "reopen";
    await page.reload();
    await page.getByRole("link", { name: title, exact: true }).click();
    await expect(editor.locator("strong")).toHaveText("S5 样式");
    await expect(editor).toContainText(" > 引用源码 * 星号 🙂");
    expect(await editor.locator("p").last().textContent()).toBe("\u00a0甲\u00a0");
    evidence.status = "passed";
    evidence.stage = "awaiting-cross-client-handoff";
  } finally {
    mkdirSync(runDir, { recursive: true });
    writeFileSync(join(runDir, "web-real-api.json"), JSON.stringify(evidence, null, 2) + "\n", { mode: 0o600 });
  }
});

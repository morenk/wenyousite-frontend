import { test } from "./fixtures/typography";
import {
  expect,
  type Locator,
  type Page,
  type Route,
} from "@playwright/test";

import { openFreshThreadDraft } from "./fixtures/auth";

const THREAD_ID = "alignment-compatibility-thread";
const SUBTHREAD_ID = "alignment-compatibility-main";
const USER_ID = "alignment-compatibility-owner";
const THREAD_TITLE = "对齐兼容性草稿";

const CENTER_TEXT = [
  "粗体中文",
  "italicLatin",
  "删除🙂",
  "code_snippet",
  "链接文本",
  "超长中日韩段落用于验证窄栏换行时不会破坏居中语义",
  "Supercalifragilisticexpialidocious-with-a-long-unbroken-latin-token",
  "👨‍👩‍👧‍👦🧭🎲",
].join(" ");
const RIGHT_TEXT = "先格式后对齐 mixed-CJK-Latin 🌊";
const HEADING_TEXT = "标题转换仍保留对齐";
const LIST_TEXT = "列表转换必须清除对齐";
const QUOTE_TEXT = "引用转换必须清除对齐";
const LEFT_TEXT = "默认左对齐段落";
const SOFT_LINE_TEXT = "软换行仍处于同一居中块";
const NEW_PARAGRAPH_TEXT = "普通回车恢复左对齐";

const INITIAL_MARKDOWN = [
  CENTER_TEXT,
  RIGHT_TEXT,
  HEADING_TEXT,
  LIST_TEXT,
  QUOTE_TEXT,
  LEFT_TEXT,
].join("\n\n");

async function expectPreservedSpaceColumns(block: Locator) {
  const geometry = await block.evaluate((element) => {
    const text = element.firstChild!;
    const boxes = ["何", "鬼", "畔"].map((character) => {
      const index = text.textContent!.indexOf(character);
      const range = document.createRange();
      range.setStart(text, index);
      range.setEnd(text, index + 1);
      const rect = range.getBoundingClientRect();
      return { left: rect.left, top: rect.top, width: rect.width };
    });
    return { boxes, fontSize: Number.parseFloat(getComputedStyle(element).fontSize) };
  });
  expect(Math.abs(geometry.boxes[0]!.top - geometry.boxes[2]!.top)).toBeLessThan(2);
  for (let index = 1; index < 3; index++) {
    const previous = geometry.boxes[index - 1]!;
    const gap = geometry.boxes[index]!.left - previous.left - previous.width;
    // 14 个空格应保留为明显列距；空白折叠时仅剩一个空格，远小于两字宽。
    expect(gap).toBeGreaterThan(geometry.fontSize * 2);
  }
}

type AggregateRequest = {
  content?: string;
  published?: boolean;
  title?: string;
};

type AlignmentHarness = {
  aggregateRequests: AggregateRequest[];
  getStoredMarkdown: () => string;
  setPublished: (value: boolean) => void;
};

async function fulfill(
  route: Route,
  data: unknown,
  meta?: Record<string, unknown>,
) {
  await route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({
      code: 0,
      message: "ok",
      data,
      ...(meta ? { meta } : {}),
    }),
  });
}

function makeThread(content: string, published: boolean, bodyVersion: number) {
  const owner = {
    id: USER_ID,
    username: "对齐测试员",
    avatar: null,
    level: 5,
  };
  const bodyPost = {
    id: "alignment-compatibility-body",
    content,
    version: bodyVersion,
    diceRolls: [],
  };
  const subthread = {
    id: SUBTHREAD_ID,
    threadId: THREAD_ID,
    title: "主帖",
    sortOrder: 0,
    postingPolicy: "PARTICIPANTS",
    version: 1,
    lastPostAt: null,
    deletedAt: null,
    createdAt: "2026-08-29T00:00:00.000Z",
    bodyPost,
    _count: { posts: 0 },
    tags: [],
  };

  return {
    id: THREAD_ID,
    title: THREAD_TITLE,
    ownerId: USER_ID,
    category: "DEDUCTION",
    categoryInfo: { slug: "DEDUCTION", name: "演绎", isActive: true },
    status: "RECRUITING",
    visibility: "PUBLIC",
    published,
    publishedAt: published ? "2026-08-29T01:00:00.000Z" : null,
    pinned: false,
    pinnedAt: null,
    viewCount: 0,
    version: 1,
    likeCount: 0,
    tipTotal: "0",
    defaultSubthreadId: SUBTHREAD_ID,
    createdAt: "2026-08-29T00:00:00.000Z",
    updatedAt: "2026-08-29T01:00:00.000Z",
    deletedAt: null,
    owner,
    subthreads: [subthread],
    defaultSubthread: subthread,
    topicTags: [],
    _count: { members: 1, players: 1, posts: 0 },
    isBookmarked: false,
    bookmarkId: null,
    isLiked: false,
    currentMembership: {
      id: "alignment-compatibility-membership",
      userId: USER_ID,
      threadId: THREAD_ID,
      role: "OWNER",
      playerMarked: false,
    },
    capabilities: {
      isOwner: true,
      canManageThread: true,
      canManageMembers: true,
      canPost: true,
    },
  };
}

async function mockAlignmentWorkspace(
  page: Page,
  initialMarkdown = INITIAL_MARKDOWN,
  markdownContractVersion = 4,
): Promise<AlignmentHarness> {
  let storedMarkdown = initialMarkdown;
  let published = false;
  let draftCreated = false;
  let bodyVersion = 1;
  const aggregateRequests: AggregateRequest[] = [];

  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const { pathname } = url;

    if (pathname.endsWith("/auth/refresh")) {
      return fulfill(route, {
        accessToken: "alignment-compatibility-memory-token",
        user: {
          id: USER_ID,
          email: "alignment-compatibility@example.invalid",
          username: "对齐测试员",
          avatar: null,
          role: "USER",
        },
      });
    }
    if (pathname.endsWith("/meta")) {
      return fulfill(route, { markdownContractVersion });
    }
    if (pathname.endsWith("/thread-categories")) {
      return fulfill(route, [{
        id: "alignment-compatibility-category",
        slug: "DEDUCTION",
        name: "演绎",
        description: null,
        icon: null,
        sortOrder: 0,
        isActive: true,
        mergedIntoId: null,
        createdAt: "2026-08-29T00:00:00.000Z",
        updatedAt: "2026-08-29T00:00:00.000Z",
      }]);
    }
    if (pathname.endsWith("/threads/draft")) {
      return fulfill(
        route,
        draftCreated ? [makeThread(storedMarkdown, false, bodyVersion)] : [],
      );
    }
    if (pathname.endsWith("/threads") && request.method() === "POST") {
      draftCreated = true;
      return fulfill(route, makeThread(storedMarkdown, false, bodyVersion));
    }
    if (
      pathname.endsWith(`/threads/${THREAD_ID}/aggregate`)
      && request.method() === "PATCH"
    ) {
      const body = request.postDataJSON() as AggregateRequest;
      aggregateRequests.push(body);
      if (typeof body.content === "string") storedMarkdown = body.content;
      if (typeof body.published === "boolean") published = body.published;
      bodyVersion += 1;
      return fulfill(route, makeThread(storedMarkdown, published, bodyVersion));
    }
    if (pathname.endsWith(`/threads/${THREAD_ID}`)) {
      return fulfill(route, makeThread(storedMarkdown, published, bodyVersion));
    }
    if (pathname.endsWith(`/subthreads/${SUBTHREAD_ID}/posts/authors`)) {
      return fulfill(route, []);
    }
    if (pathname.endsWith(`/subthreads/${SUBTHREAD_ID}/posts`)) {
      return fulfill(route, [], { cursor: null, hasMore: false });
    }
    if (pathname.endsWith("/users/mention-candidates")) {
      return fulfill(route, {
        users: [{
          id: "alignment-mentioned-user",
          username: "被提及者",
          avatar: null,
          relation: "FOLLOWING",
        }],
        canMentionAllPlayers: true,
      });
    }
    if (pathname.endsWith("/drafts/state")) {
      return fulfill(route, {
        drafts: [],
        usedSlots: 0,
        maxSlots: 5,
        slots: [],
      });
    }
    if (pathname.endsWith("/stickers")) {
      return fulfill(route, {
        version: 1,
        limit: 100,
        items: [],
        recent: [],
        pendingImports: [],
      });
    }
    if (pathname.endsWith("/notifications/unread")) {
      return fulfill(route, { unreadCount: 0 });
    }
    if (pathname.endsWith("/direct-conversations/unread")) {
      return fulfill(route, {
        unreadMessageCount: 0,
        pendingRequestCount: 0,
        total: 0,
      });
    }
    if (pathname.endsWith("/wallet/check-in")) {
      return fulfill(route, {
        claimedNow: false,
        date: "2026-08-29",
        rewardAmount: "3",
        experienceAwarded: 0,
        balance: "0",
        progression: {
          level: 1,
          experience: 0,
          currentLevelExperience: 0,
          nextLevelExperience: 50,
        },
      });
    }
    if (pathname.endsWith("/wallet")) {
      return fulfill(route, {
        balance: "0",
        receivedTipTotal: "0",
        receivedTipCount: 0,
      });
    }

    return fulfill(route, null);
  });

  return {
    aggregateRequests,
    getStoredMarkdown: () => storedMarkdown,
    setPublished: (value) => {
      published = value;
    },
  };
}

function editorParagraph(editor: Locator, text: string) {
  return editor.locator(":scope > p").filter({ hasText: text });
}

async function selectText(block: Locator, text: string) {
  const selected = await block.evaluate((element, needle) => {
    const editor = element.closest<HTMLElement>('[contenteditable="true"]');
    editor?.focus();
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      const value = node.nodeValue ?? "";
      const index = value.indexOf(needle);
      if (index !== -1) {
        const range = document.createRange();
        range.setStart(node, index);
        range.setEnd(node, index + needle.length);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
        return selection?.toString() === needle;
      }
      node = walker.nextNode();
    }
    return false;
  }, text);
  expect(selected).toBe(true);
}

async function placeCaretAtEnd(block: Locator) {
  await block.evaluate((element) => {
    const editor = element.closest<HTMLElement>('[contenteditable="true"]');
    editor?.focus();
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  });
}

async function expectBlockAlignment(
  block: Locator,
  alignment: "left" | "center" | "right",
) {
  if (alignment === "left") {
    await expect(block).not.toHaveAttribute("data-wenyou-align");
  } else {
    await expect(block).toHaveAttribute("data-wenyou-align", alignment);
  }
  await expect.poll(async () => {
    const computedAlignment = await block.evaluate((element) =>
      getComputedStyle(element).textAlign,
    );
    return alignment === "left"
      ? computedAlignment === "left" || computedAlignment === "start"
      : computedAlignment === alignment;
  }).toBe(true);
}

async function clickAlignmentCycle(
  block: Locator,
  toolbar: Locator,
  clicks: 1 | 2,
) {
  await block.click();
  for (let index = 0; index < clicks; index += 1) {
    await toolbar.locator('[data-editor-tool="alignment"]').click();
  }
}

async function applyMark(
  block: Locator,
  text: string,
  toolbar: Locator,
  buttonName: string,
) {
  await selectText(block, text);
  await toolbar.getByRole("button", { name: buttonName, exact: true }).click();
}

async function visibleToolbarMetrics(toolbar: Locator) {
  return toolbar.evaluate((element) => {
    const toolbarBox = element.getBoundingClientRect();
    const visibleItems = [
      ...element.querySelectorAll<HTMLElement>(
        ".top-bar-heading-button, .top-bar-item",
      ),
    ].filter((item) => getComputedStyle(item).display !== "none");
    const boxes = visibleItems.map((item) => item.getBoundingClientRect());
    return {
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      topSpread: Math.max(...visibleItems.map((item) => item.offsetTop))
        - Math.min(...visibleItems.map((item) => item.offsetTop)),
      leftOverflow: Math.min(...boxes.map((box) => box.left)) - toolbarBox.left,
      rightOverflow: Math.max(...boxes.map((box) => box.right)) - toolbarBox.right,
      visibleCount: visibleItems.length,
    };
  });
}

test.describe("编辑器对齐真实浏览器兼容性", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
  });

  test("左中右与其他样式按两种顺序组合，保存及阅读重载保持一致", async ({
    page,
  }) => {
    test.slow();
    const harness = await mockAlignmentWorkspace(page);
    await openFreshThreadDraft(page);

    const editor = page.locator(".milkdown-editor .ProseMirror").first();
    const toolbar = page.getByRole("toolbar", { name: "正文格式工具栏" });
    await expect(toolbar).toHaveAttribute("data-editor-density", "expanded");

    let center = editorParagraph(editor, CENTER_TEXT);
    const right = editorParagraph(editor, RIGHT_TEXT);
    const headingParagraph = editorParagraph(editor, HEADING_TEXT);
    const listParagraph = editorParagraph(editor, LIST_TEXT);
    const quoteParagraph = editorParagraph(editor, QUOTE_TEXT);
    const left = editorParagraph(editor, LEFT_TEXT);

    await expectBlockAlignment(left, "left");

    // 顺序一：先对齐，再逐项应用行内格式和行内原子节点。
    await clickAlignmentCycle(center, toolbar, 1);
    await expectBlockAlignment(center, "center");
    await applyMark(center, "粗体中文", toolbar, "粗体");
    await applyMark(center, "italicLatin", toolbar, "斜体");
    await applyMark(center, "删除🙂", toolbar, "删除线");
    await applyMark(center, "code_snippet", toolbar, "行内代码");

    await selectText(center, "链接文本");
    await toolbar.getByRole("button", { name: "链接", exact: true }).click();
    const linkInput = page.getByPlaceholder("粘贴链接…");
    await expect(linkInput).toBeVisible();
    await linkInput.fill("https://example.com/alignment-compatibility");
    await linkInput.press("Enter");
    await expect(center.locator("a")).toHaveAttribute(
      "href",
      "https://example.com/alignment-compatibility",
    );

    await placeCaretAtEnd(center);
    await toolbar.getByRole("button", { name: "骰子", exact: true }).click();
    const diceDialog = page.getByRole("dialog", { name: "插入骰子" });
    await diceDialog.getByRole("button", { name: "d20" }).click();
    await diceDialog.getByRole("button", { name: "插入", exact: true }).click();
    const dice = page.getByRole("note", { name: /骰子 1d20，待掷/u });
    await expect(dice).toBeVisible();
    await expect(dice.locator("xpath=ancestor::p[1]")).toHaveAttribute(
      "data-wenyou-align",
      "center",
    );

    // Shift+Enter 保留段内对齐，普通 Enter 新建左对齐段。
    center = editorParagraph(editor, CENTER_TEXT);
    await placeCaretAtEnd(center);
    await page.keyboard.press("Shift+Enter");
    await page.keyboard.type(SOFT_LINE_TEXT);
    await expect(center).toContainText(SOFT_LINE_TEXT);
    await expectBlockAlignment(center, "center");
    await page.keyboard.press("Enter");
    await page.keyboard.type(NEW_PARAGRAPH_TEXT);
    const nextParagraph = editorParagraph(editor, NEW_PARAGRAPH_TEXT);
    await expectBlockAlignment(nextParagraph, "left");
    await expectBlockAlignment(center, "center");

    // 顺序二：先创建行内 mark，再设置右对齐。
    await applyMark(right, "先格式后对齐", toolbar, "粗体");
    await applyMark(right, "mixed-CJK-Latin", toolbar, "斜体");
    await clickAlignmentCycle(right, toolbar, 2);
    await expectBlockAlignment(right, "right");

    // H2/H3 可保留对齐；列表与引用边界必须清除嵌套属性。
    await clickAlignmentCycle(headingParagraph, toolbar, 1);
    await toolbar.getByRole("button", { name: "切换正文样式" }).click();
    await toolbar.getByRole("button", { name: "标题 2" }).click();
    const heading = editor.locator(":scope > h2").filter({ hasText: HEADING_TEXT });
    await expectBlockAlignment(heading, "center");

    await clickAlignmentCycle(listParagraph, toolbar, 1);
    await toolbar.getByRole("button", { name: "无序列表" }).click();
    const listItem = editor.locator("li p").filter({ hasText: LIST_TEXT });
    await expect(listItem).not.toHaveAttribute("data-wenyou-align");
    await expect(listItem).not.toHaveCSS("text-align", "center");

    await clickAlignmentCycle(quoteParagraph, toolbar, 2);
    await toolbar.getByRole("button", { name: "引用" }).click();
    const quote = editor.locator("blockquote p").filter({ hasText: QUOTE_TEXT });
    await expect(quote).not.toHaveAttribute("data-wenyou-align");
    await expect(quote).not.toHaveCSS("text-align", "right");

    await expect(center.locator("strong")).toHaveText("粗体中文");
    await expect(center.locator("em")).toHaveText("italicLatin");
    await expect(center.locator("del")).toHaveText("删除🙂");
    await expect(center.locator("code")).toHaveText("code_snippet");
    await expect(right.locator("strong")).toHaveText("先格式后对齐");
    await expect(right.locator("em")).toHaveText("mixed-CJK-Latin");

    await page.getByRole("button", { name: "保存草稿", exact: true }).click();
    await expect(page.getByText("草稿已保存").first()).toBeVisible();
    await expect.poll(() => harness.aggregateRequests.length).toBe(1);
    const saved = harness.getStoredMarkdown();
    expect(saved).toContain("[wenyousite-align-v1-center]: #\n");
    expect(saved).toContain("[wenyousite-align-v1-right]: #\n");
    expect(saved).toContain("**粗体中文**");
    expect(saved).toContain("*italicLatin*");
    expect(saved).toContain("~~删除🙂~~");
    expect(saved).toContain("`code_snippet`");
    expect(saved).toContain(
      "[链接文本](https://example.com/alignment-compatibility)",
    );
    expect(saved).toMatch(/\[\[dice:v1:[0-9a-f-]{36}:1d20\]\]/u);
    expect(saved).toContain("[wenyousite-align-v1-center]: #\n## 标题转换仍保留对齐");
    expect(saved).not.toMatch(/wenyousite-align[^\n]*\n[-*] 列表转换/u);
    expect(saved).not.toMatch(/wenyousite-align[^\n]*\n> 引用转换/u);
    expect(saved).not.toMatch(/wenyousite-align[^\n]*\n普通回车恢复左对齐/u);

    // 同一份持久化内容进入阅读组件后，DOM 属性、computed style 与行内语义一致。
    harness.setPublished(true);
    await page.goto(`/threads/${THREAD_ID}`);
    await expect(page.getByRole("heading", { name: THREAD_TITLE })).toBeVisible();
    const reader = page
      .locator('[data-slot="markdown-content"]')
      .filter({ hasText: "粗体中文" })
      .first();
    const readerCenter = reader.locator(":scope > p").filter({ hasText: CENTER_TEXT });
    const readerRight = reader.locator(":scope > p").filter({ hasText: RIGHT_TEXT });
    await expectBlockAlignment(readerCenter, "center");
    await expectBlockAlignment(readerRight, "right");
    await expectBlockAlignment(
      reader.locator(":scope > h2").filter({ hasText: HEADING_TEXT }),
      "center",
    );
    await expect(readerCenter.locator("strong")).toHaveText("粗体中文");
    await expect(readerCenter.locator("em")).toHaveText("italicLatin");
    await expect(readerCenter.locator("del")).toHaveText("删除🙂");
    await expect(readerCenter.locator("code")).toHaveText("code_snippet");
    await expect(reader.locator("a").filter({ hasText: "链接文本" })).toHaveAttribute(
      "href",
      "https://example.com/alignment-compatibility",
    );
    await expect(reader.getByRole("note", { name: /骰子 1d20/u })).toBeVisible();
    await expect(reader).not.toContainText("wenyousite-align-v1");

    for (const width of [760, 360]) {
      await reader.evaluate((element, inlineSize) => {
        (element as HTMLElement).style.width = `${inlineSize}px`;
      }, width);
      const metrics = await reader.evaluate((element) => ({
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
      }));
      expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
      await expectBlockAlignment(readerCenter, "center");
      await expectBlockAlignment(readerRight, "right");
    }

    await page.reload();
    await expect(page.getByRole("heading", { name: THREAD_TITLE })).toBeVisible();
    await expectBlockAlignment(readerCenter, "center");
    await expectBlockAlignment(readerRight, "right");
    await expect(readerCenter.locator("strong")).toHaveText("粗体中文");
    await expect(reader.getByRole("note", { name: /骰子 1d20/u })).toBeVisible();
  });

  test("宽窄 PC 容器中的工具栏密度、更多菜单和指针路径保持可用", async ({
    page,
  }) => {
    const harness = await mockAlignmentWorkspace(page, "指针与密度测试");
    await openFreshThreadDraft(page);
    void harness;

    const host = page.locator(".milkdown-editor").first();
    const editor = host.locator(".ProseMirror");
    const paragraph = editorParagraph(editor, "指针与密度测试");
    const toolbar = page.getByRole("toolbar", { name: "正文格式工具栏" });

    await host.evaluate((element) => {
      element.style.width = "880px";
    });
    await expect(toolbar).toHaveAttribute("data-editor-density", "expanded");
    await expect(toolbar.locator('[data-editor-tool="alignment"]')).toBeVisible();
    await expect(toolbar.getByRole("button", { name: "更多" })).toHaveCount(0);
    for (const control of await toolbar.locator(
      ".top-bar-heading-button, .top-bar-item",
    ).all()) {
      await expect(control).toHaveAttribute("tabindex", "-1");
    }
    let metrics = await visibleToolbarMetrics(toolbar);
    expect(metrics.topSpread).toBeLessThanOrEqual(4);
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
    expect(metrics.leftOverflow).toBeGreaterThanOrEqual(-1);
    expect(metrics.rightOverflow).toBeLessThanOrEqual(1);

    await host.evaluate((element) => {
      element.style.width = "640px";
    });
    await expect(toolbar).toHaveAttribute("data-editor-density", "with-more");
    await expect(toolbar.locator('[data-editor-tool="alignment"]')).not.toBeVisible();
    const more = toolbar.getByRole("button", { name: "更多" });
    await more.click();
    const menu = page.getByRole("menu", { name: "更多正文格式" });
    await expect(menu).toBeVisible();
    await expect(more).toHaveAttribute("aria-expanded", "true");
    const alignmentGroup = menu.getByRole("group", { name: "段落对齐" });
    for (const label of ["左对齐", "居中对齐", "右对齐"]) {
      await expect(
        alignmentGroup.getByRole("menuitemradio", { name: label }),
      ).toBeVisible();
    }
    await expect(
      alignmentGroup.getByRole("menuitemradio", { name: "左对齐" }),
    ).toHaveAttribute("aria-checked", "true");
    const menuMetrics = await menu.evaluate((element) => ({
      width: element.getBoundingClientRect().width,
      buttons: [...element.querySelectorAll<HTMLElement>(
        '[role="menuitem"], [role="menuitemradio"]',
      )].map((button) => ({
        width: button.offsetWidth,
        height: button.offsetHeight,
        label: button.getAttribute("aria-label"),
        tabIndex: button.tabIndex,
      })),
    }));
    expect(menuMetrics.width).toBeLessThanOrEqual(320);
    expect(menuMetrics.buttons.length).toBeGreaterThanOrEqual(6);
    expect(menuMetrics.buttons.every(({ label }) => Boolean(label))).toBe(true);
    expect(menuMetrics.buttons.every(({ tabIndex }) => tabIndex === -1)).toBe(true);
    expect(Math.min(...menuMetrics.buttons.map(({ width }) => width)))
      .toBeGreaterThanOrEqual(36);
    expect(Math.min(...menuMetrics.buttons.map(({ height }) => height)))
      .toBeGreaterThanOrEqual(36);

    const centerOption = alignmentGroup.getByRole("menuitemradio", {
      name: "居中对齐",
    });
    await centerOption.hover();
    await expect(
      page.getByRole("tooltip", { name: "居中对齐", exact: true }),
    ).toBeVisible();
    await centerOption.click();
    await expect(menu).toHaveCount(0);
    await expectBlockAlignment(paragraph, "center");
    await expect(editor).toBeFocused();

    metrics = await visibleToolbarMetrics(toolbar);
    expect(metrics.topSpread).toBeLessThanOrEqual(4);
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
    expect(metrics.leftOverflow).toBeGreaterThanOrEqual(-1);
    expect(metrics.rightOverflow).toBeLessThanOrEqual(1);

    await host.evaluate((element) => {
      element.style.width = "320px";
    });
    await expect(toolbar).toHaveAttribute("data-editor-density", "compact");
    metrics = await visibleToolbarMetrics(toolbar);
    expect(metrics.visibleCount).toBe(5);
    expect(metrics.topSpread).toBeLessThanOrEqual(4);
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
    expect(metrics.leftOverflow).toBeGreaterThanOrEqual(-1);
    expect(metrics.rightOverflow).toBeLessThanOrEqual(1);

    await more.click();
    await expect(menu).toBeVisible();
    const menuBox = await menu.boundingBox();
    expect(menuBox).not.toBeNull();
    expect(menuBox!.x).toBeGreaterThanOrEqual(8);
    expect(menuBox!.x + menuBox!.width).toBeLessThanOrEqual(
      (await page.evaluate(() => window.innerWidth)) - 8,
    );
    await expect(menu.getByRole("menuitem", { name: "行内代码" })).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: "引用" })).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: "无序列表" })).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: "有序列表" })).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: "分隔线" })).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: "骰子" })).toBeVisible();
  });
});


for (const quoted of [false, true]) {
  test(`${quoted ? "引用" : "正文"} 连续回车的行高、保存、编辑重开和阅读保持一致`, async ({ page }) => {
    const harness = await mockAlignmentWorkspace(page, quoted ? "> 甲乙\n\n尾段" : "甲乙");
    await openFreshThreadDraft(page);
    const editor = page.locator(".milkdown-editor .ProseMirror").first();
    const paragraph = editor.locator(quoted ? "blockquote > p" : ":scope > p").filter({ hasText: "甲乙" });
    await expect(paragraph).toBeVisible();
    const lineHeight = await paragraph.evaluate((el) => Number.parseFloat(getComputedStyle(el).lineHeight));

    await paragraph.evaluate((el) => {
      const text = el.firstChild!;
      const range = document.createRange();
      range.setStart(text, 1);
      range.collapse(true);
      const selection = window.getSelection()!;
      selection.removeAllRanges();
      selection.addRange(range);
      (el.closest('[contenteditable="true"]') as HTMLElement).focus();
    });
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    if (!quoted) {
      const rows = editor.locator(":scope > p");
      await expect(rows).toHaveCount(4);
      // 用文字位置比较可见行距，排除首段外侧 padding。
      const textTop = (row: Locator) => row.evaluate((el) => {
        const range = document.createRange();
        range.selectNodeContents(el);
        return range.getBoundingClientRect().top;
      });
      expect(Math.abs(await textTop(rows.last()) - await textTop(rows.first()) - lineHeight * 3)).toBeLessThan(2);
    }
    const prefix = quoted ? "> " : "";
    const expected = `${prefix}甲\n${prefix}<br />\n${prefix}<br />\n${prefix}乙${quoted ? "\n\n尾段" : ""}`;
    await page.getByRole("button", { name: "保存草稿", exact: true }).click();
    await expect.poll(harness.getStoredMarkdown).toBe(expected);
    await page.reload();
    await page.getByRole("link", { name: "继续编辑", exact: true }).click();
    await expect(editor).toBeVisible();
    const reopenedBlock = quoted ? editor.locator(":scope > blockquote") : editor;
    await expect(reopenedBlock.locator(":scope > p[data-wenyou-empty-row]")).toHaveCount(2);
    const gap = await reopenedBlock.evaluate((el) => {
      const first = [...el.querySelectorAll(":scope > p")].find((p) => p.textContent === "甲")!;
      const last = [...el.querySelectorAll(":scope > p")].find((p) => p.textContent === "乙")!;
      const firstText = document.createRange();
      firstText.selectNodeContents(first);
      const lastText = document.createRange();
      lastText.selectNodeContents(last);
      return lastText.getBoundingClientRect().top - firstText.getBoundingClientRect().top;
    });
    expect(Math.abs(gap - lineHeight * 3)).toBeLessThan(2);
    harness.setPublished(true);
    await page.goto(`/threads/${THREAD_ID}`);
    const reader = page.locator('[data-slot="markdown-content"]').filter({ hasText: "甲" }).first();
    await expect(reader).toBeVisible();
    const readerBlock = quoted ? reader.locator(":scope > blockquote") : reader;
    const readerGap = await readerBlock.evaluate((el) => {
      const ps = [...el.querySelectorAll(":scope > p")];
      const first = ps.find((p) => p.textContent === "甲")!;
      const last = ps.find((p) => p.textContent === "乙")!;
      return { distance: last.getBoundingClientRect().top - first.getBoundingClientRect().top,
        line: Number.parseFloat(getComputedStyle(first).lineHeight) };
    });
    expect(Math.abs(readerGap.distance - readerGap.line * 3)).toBeLessThan(2);
  });
}


for (const alignment of ["center", "right"] as const) {
  test(`${alignment} 手动 Enter 左对齐、自动折行、单行设置和保存重开`, async ({ page }) => {
    const text = "自动折行仍然保持整段对齐".repeat(8);
    const marker = `[wenyousite-align-v1-${alignment}]: #\n`;
    const harness = await mockAlignmentWorkspace(page, marker + text);
    await openFreshThreadDraft(page);
    const editor = page.locator(".milkdown-editor .ProseMirror").first();
    const toolbar = page.locator(".milkdown-top-bar").first();
    const first = editorParagraph(editor, text);
    await expect(first).toBeVisible();
    await first.evaluate((el) => { (el as HTMLElement).style.maxWidth = "180px"; });
    const height = await first.evaluate((el) => ({ height: el.getBoundingClientRect().height, line: Number.parseFloat(getComputedStyle(el).lineHeight) }));
    expect(height.height).toBeGreaterThan(height.line * 2);
    await expect(editor.locator(":scope > p")).toHaveCount(1);
    await expectBlockAlignment(first, alignment);
    await page.getByRole("button", { name: "保存草稿", exact: true }).click();
    await expect.poll(harness.getStoredMarkdown).toBe(marker + text);

    await placeCaretAtEnd(first);
    await page.keyboard.press("Enter");
    await expect(editor.locator(":scope > p")).toHaveCount(2);
    await expectBlockAlignment(editor.locator(":scope > p").last(), "left");
    await page.keyboard.type("Next");
    const next = editorParagraph(editor, "Next");
    await expectBlockAlignment(next, "left");
    await expectBlockAlignment(first, alignment);
    const gap = await editor.evaluate((el) => {
      const ps = el.querySelectorAll(":scope > p");
      const text = ps[0]!.firstChild!;
      const last = document.createRange();
      last.setStart(text, text.textContent!.length - 1);
      last.setEnd(text, text.textContent!.length);
      const next = document.createRange();
      next.selectNodeContents(ps[1]!);
      return { distance: next.getBoundingClientRect().top - last.getBoundingClientRect().top,
        line: Number.parseFloat(getComputedStyle(ps[0]!).lineHeight) };
    });
    expect(Math.abs(gap.distance - gap.line)).toBeLessThan(2);
    await page.getByRole("button", { name: "保存草稿", exact: true }).click();
    await expect.poll(harness.getStoredMarkdown).toBe(marker + text + "\n\nNext");
    await page.reload();
    await page.getByRole("link", { name: "继续编辑", exact: true }).click();
    await expectBlockAlignment(editorParagraph(editor, "Next"), "left");
    await expectBlockAlignment(editorParagraph(editor, text), alignment);
    // 单独对齐新行，首段保持原对齐。
    await clickAlignmentCycle(editorParagraph(editor, "Next"), toolbar, 1);
    await expectBlockAlignment(editorParagraph(editor, "Next"), "center");
    await expectBlockAlignment(editorParagraph(editor, text), alignment);
    await page.getByRole("button", { name: "保存草稿", exact: true }).click();
    await expect.poll(harness.getStoredMarkdown).toBe(marker + text + "\n\n[wenyousite-align-v1-center]: #\nNext");
    harness.setPublished(true);
    await page.goto(`/threads/${THREAD_ID}`);
    const reader = page.locator('[data-slot="markdown-content"]').filter({ hasText: text }).first();
    await expectBlockAlignment(reader.locator(":scope > p").first(), alignment);
    await expectBlockAlignment(reader.locator(":scope > p").last(), "center");
    const readerGap = await reader.evaluate((el) => {
      const ps = el.querySelectorAll(":scope > p");
      return ps[1]!.getBoundingClientRect().top - ps[0]!.getBoundingClientRect().bottom;
    });
    expect(Math.abs(readerGap)).toBeLessThan(2);
    await page.reload();
    await expectBlockAlignment(reader.locator(":scope > p").last(), "center");
  });
}

// 来自原楼层的普通空格排版；不推断表格或竖排结构。
test("手打空格的三列在编辑、保存和阅读中保留实际列距", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const columns = `\u2060${" ".repeat(25)}何${" ".repeat(14)}鬼${" ".repeat(14)}畔`;
  const harness = await mockAlignmentWorkspace(page, columns);
  await openFreshThreadDraft(page);
  const editor = page.locator(".milkdown-editor .ProseMirror").first();
  const editorBlock = editor.locator(":scope > p").first();
  await expect(editorBlock).toHaveText(columns, { useInnerText: false });
  await expectPreservedSpaceColumns(editorBlock);
  await page.getByRole("button", { name: "保存草稿", exact: true }).click();
  await expect.poll(harness.getStoredMarkdown).toBe(columns);
  harness.setPublished(true);
  await page.goto(`/threads/${THREAD_ID}`);
  const reader = page.locator('[data-slot="markdown-content"]').filter({ hasText: "何" }).first();
  const readerBlock = reader.locator(":scope > p").first();
  await expect(readerBlock).toHaveText(columns, { useInnerText: false });
  await expectPreservedSpaceColumns(readerBlock);
  await testInfo.attach("连续空格三列阅读截图", { body: await reader.screenshot(), contentType: "image/png" });
  await reader.evaluate((element) => { element.style.maxWidth = "180px"; });
  const width = await reader.evaluate((element) => ({ content: element.scrollWidth, available: element.clientWidth }));
  expect(width.content).toBeLessThanOrEqual(width.available + 1);
});

// 同时覆盖紧凑列表和块引用，防止保留空白后把 HTML 排版 LF 变成空白行。
test("正文标题引用列表保留空格且软 LF 只换一行", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1200 });
  const columns = `\u2060${" ".repeat(25)}何${" ".repeat(14)}鬼${" ".repeat(14)}畔`;
  const longSpaces = `\u2060${" ".repeat(512)}长列🙂\u00a0　尾${" ".repeat(512)}\u2060`;
  const markdown = [columns, `## ${columns}`, `### ${columns}`, `> ${columns}`,
    `- ${columns}`, `1. ${columns}`, "软甲   🙂\n软乙　\u00a0尾", "**粗体**     `代码`", longSpaces].join("\n\n");
  const harness = await mockAlignmentWorkspace(page, markdown);
  await openFreshThreadDraft(page);
  const editor = page.locator(".milkdown-editor .ProseMirror").first();
  for (const selector of [":scope > p", "h2", "h3", "blockquote p", "ul li p", "ol li p"]) {
    await expectPreservedSpaceColumns(editor.locator(selector).first());
  }
  await page.getByRole("button", { name: "保存草稿", exact: true }).click();
  harness.setPublished(true);
  await page.goto(`/threads/${THREAD_ID}`);
  const reader = page.locator('[data-slot="markdown-content"]').filter({ hasText: "何" }).first();
  for (const selector of [":scope > p", "h2", "h3", "blockquote p", "ul li", "ol li"]) {
    await expectPreservedSpaceColumns(reader.locator(selector).first());
  }
  const soft = reader.locator("p").filter({ hasText: "软甲" });
  await expect(soft.locator("br")).toHaveCount(1);
  const gap = await soft.evaluate((element) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const tops: number[] = [];
    let node: Node | null;
    while ((node = walker.nextNode())) {
      for (const character of ["甲", "乙"]) {
        const index = node.textContent!.indexOf(character);
        if (index < 0) continue;
        const range = document.createRange();
        range.setStart(node, index);
        range.setEnd(node, index + 1);
        tops.push(range.getBoundingClientRect().top);
      }
    }
    return { distance: tops[1]! - tops[0]!, lineHeight: Number.parseFloat(getComputedStyle(element).lineHeight) };
  });
  expect(Math.abs(gap.distance - gap.lineHeight)).toBeLessThan(2);
  expect(await soft.textContent()).toBe("软甲   🙂软乙　\u00a0尾");
  await expect(reader.locator(".markdown-inline-boundary-space")).toHaveText("     ", { useInnerText: false });
  const longBlock = reader.locator("p").filter({ hasText: "长列" });
  expect(await longBlock.textContent()).toBe(longSpaces);
  await reader.evaluate((element) => { element.style.maxWidth = "180px"; });
  expect(await reader.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
});

for (const alignment of ["center", "right"] as const) {
  test(`${alignment} 紧邻前文的 P/H2/H3/图片在保存重开与阅读保持四个边界`, async ({ page, baseURL }) => {
    // 使用同源固定图片，遵守候选 CSP 并避免外网依赖。
    const imageUrl = new URL("/__alignment-fixtures__/boundary.png", baseURL).href;
    await page.route(imageUrl, (route) => route.fulfill({
      contentType: "image/png",
      body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"),
    }));
    const marker = `[wenyousite-align-v1-${alignment}]: #`;
    const content = ["经历：", marker, "目标正文", marker, "## 目标标题", marker,
      "### 目标小标题", marker, `![图片](${imageUrl})`].join("\n");
    const harness = await mockAlignmentWorkspace(page, content, 5);
    await openFreshThreadDraft(page);
    const editor = page.locator(".milkdown-editor .ProseMirror").first();
    const attributes = () => editor.locator(":scope > [data-wenyou-align]");
    await expect(attributes()).toHaveCount(4);
    expect(await editor.textContent()).not.toContain("wenyousite-align");
    const before = editor.locator(":scope > p").first();
    await expect(before).toHaveText("经历：");
    await placeCaretAtEnd(before);
    await page.keyboard.type("新增");
    await page.getByRole("button", { name: "保存草稿", exact: true }).click();
    await expect.poll(harness.getStoredMarkdown).toContain("经历：新增");
    const stored = harness.getStoredMarkdown();
    for (let pass = 0; pass < 2; pass++) {
      await page.reload();
      if (new URL(page.url()).pathname === "/threads/create") {
        await page.getByRole("link", { name: "继续编辑", exact: true }).click();
      }
      await expect(attributes()).toHaveCount(4);
      await page.getByRole("button", { name: "保存草稿", exact: true }).click();
      await expect.poll(harness.getStoredMarkdown).toBe(stored);
    }
    harness.setPublished(true);
    await page.goto(`/threads/${THREAD_ID}`);
    const reader = page.locator('[data-slot="markdown-content"]').filter({ hasText: "经历：新增" }).first();
    await expect(reader.locator(":scope > [data-wenyou-align]")).toHaveCount(4);
    await expect(reader.locator("br")).toHaveCount(0);
    expect(await reader.textContent()).toBe("经历：新增目标正文目标标题目标小标题");
    await expect(reader.locator("img")).toHaveAttribute("src", imageUrl);
  });
}

test("正文草稿恢复紧邻 marker，真实编辑后保存与阅读保持对齐", async ({ page }) => {
  const content = "经历：\n[wenyousite-align-v1-center]: #\n草稿正文\n[wenyousite-align-v1-right]: #\n## 草稿标题";
  const harness = await mockAlignmentWorkspace(page, "即将替换", 5);
  await page.route("**/api/v1/drafts/state", (route) => fulfill(route, {
    drafts: [{ id: "boundary-draft", userId: USER_ID, slot: 1, version: 1, content,
      createdAt: "2026-08-29T00:00:00.000Z", updatedAt: "2026-08-29T00:00:00.000Z" }],
    usedSlots: 1, maxSlots: 5, slots: [1],
  }));
  await openFreshThreadDraft(page);
  await page.getByRole("button", { name: "正文草稿", exact: true }).click();
  const panel = page.getByRole("region", { name: "正文草稿", exact: true });
  await panel.getByRole("button", { name: "恢复", exact: true }).click();
  await page.getByRole("button", { name: "覆盖并恢复", exact: true }).click();
  const editor = page.locator(".milkdown-editor .ProseMirror").first();
  await expect(editor.locator(":scope > [data-wenyou-align]")).toHaveCount(2);
  await placeCaretAtEnd(editor.locator(":scope > p").filter({ hasText: "草稿正文" }));
  await page.keyboard.type("新增");
  await page.getByRole("button", { name: "保存草稿", exact: true }).click();
  await expect.poll(harness.getStoredMarkdown).toContain("草稿正文新增");
  harness.setPublished(true);
  await page.goto(`/threads/${THREAD_ID}`);
  const reader = page.locator('[data-slot="markdown-content"]').filter({ hasText: "经历：" }).first();
  await expect(reader.locator(":scope > [data-wenyou-align]")).toHaveCount(2);
  expect(await reader.textContent()).toBe("经历：草稿正文新增草稿标题");
  await expect(reader.locator("br")).toHaveCount(0);
});

for (const block of [
  { name: "图片", source: "![图片](https://cdn.example.com/boundary.png)", selector: ".milkdown-image-block" },
  { name: "分隔线", source: "---", selector: "hr" },
  { name: "列表", source: "- 末尾列表", selector: "li p" },
]) {
  test(`末尾${block.name}可经真实键盘继续输入，保存重开不丢结构`, async ({ page }) => {
    const harness = await mockAlignmentWorkspace(page, `前文\n\n${block.source}`, 5);
    await openFreshThreadDraft(page);
    const editor = page.locator(".milkdown-editor .ProseMirror").first();
    const target = editor.locator(block.selector).last();
    await target.click();
    await page.keyboard.press("Control+End");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    if (block.name === "列表") await page.keyboard.press("Enter");
    await page.keyboard.type("继续输入正文");
    await expect(editor.locator(":scope > p").filter({ hasText: "继续输入正文" })).toBeVisible();
    await expect(editor.locator(block.selector)).toHaveCount(1);
    await page.getByRole("button", { name: "保存草稿", exact: true }).click();
    const stored = harness.getStoredMarkdown();
    expect(stored).toContain("继续输入正文");
    await page.reload();
    if (new URL(page.url()).pathname === "/threads/create") {
      await page.getByRole("link", { name: "继续编辑", exact: true }).click();
    }
    await expect(editor.locator(":scope > p").filter({ hasText: "继续输入正文" })).toBeVisible();
    await expect(editor.locator(block.selector)).toHaveCount(1);
    await page.getByRole("button", { name: "保存草稿", exact: true }).click();
    await expect.poll(harness.getStoredMarkdown).toBe(stored);
  });
}

import { expect, test, type Locator } from "@playwright/test";
import { openFreshThreadDraft } from "./fixtures/auth";

async function expectMenuTethered(trigger: Locator, menu: Locator) {
  const [triggerBox, menuBox] = await Promise.all([
    trigger.boundingBox(),
    menu.boundingBox(),
  ]);
  expect(triggerBox).not.toBeNull();
  expect(menuBox).not.toBeNull();
  const verticalGap = menuBox!.y >= triggerBox!.y
    ? menuBox!.y - (triggerBox!.y + triggerBox!.height)
    : triggerBox!.y - (menuBox!.y + menuBox!.height);
  expect(verticalGap).toBeGreaterThanOrEqual(4);
  expect(verticalGap).toBeLessThanOrEqual(8);
  expect(Math.abs(
    menuBox!.x + menuBox!.width - (triggerBox!.x + triggerBox!.width),
  )).toBeLessThanOrEqual(8);
}

async function readEditorDividerMetrics(divider: Locator) {
  return divider.evaluate((element) => {
    const style = getComputedStyle(element);
    const line = getComputedStyle(element, "::before");
    const marker = getComputedStyle(element, "::after");
    const parent = element.parentElement!;
    const parentStyle = getComputedStyle(parent);
    const availableWidth = parent.clientWidth
      - Number.parseFloat(parentStyle.paddingLeft)
      - Number.parseFloat(parentStyle.paddingRight);

    return {
      selected: element.classList.contains("ProseMirror-selectednode"),
      widthRatio: element.getBoundingClientRect().width / availableWidth,
      paddingTop: Number.parseFloat(style.paddingTop),
      paddingBottom: Number.parseFloat(style.paddingBottom),
      height: Number.parseFloat(style.height),
      backgroundColor: style.backgroundColor,
      lineTop: Number.parseFloat(line.top),
      lineHeight: Number.parseFloat(line.height),
      markerTop: Number.parseFloat(marker.top),
      markerHeight: Number.parseFloat(marker.height),
    };
  });
}

const thread = {
  id: "t-dice-e2e",
  title: "未命名草稿",
  ownerId: "u-dice-e2e",
  category: "DEDUCTION",
  categoryInfo: { slug: "DEDUCTION", name: "演绎", isActive: true },
  status: "RECRUITING",
  visibility: "PUBLIC",
  published: false,
  publishedAt: null,
  pinned: false,
  pinnedAt: null,
  viewCount: 0,
  version: 1,
  likeCount: 0,
  defaultSubthreadId: "s-dice-e2e",
  createdAt: "2026-08-06T00:00:00.000Z",
  updatedAt: "2026-08-06T00:00:00.000Z",
  deletedAt: null,
  owner: { id: "u-dice-e2e", username: "骰子测试", avatar: null },
  subthreads: [
    {
      id: "s-dice-e2e",
      threadId: "t-dice-e2e",
      title: "主帖",
      sortOrder: 0,
      postingPolicy: "PARTICIPANTS",
      version: 1,
      lastPostAt: null,
      deletedAt: null,
      createdAt: "2026-08-06T00:00:00.000Z",
      bodyPost: null,
      _count: { posts: 0 },
      tags: [],
    },
  ],
  topicTags: [],
  _count: { members: 1, players: 1, posts: 0 },
};

test("编辑器格式、分隔线、窄栏、骰子与正文草稿工具在真实浏览器中正常工作", async ({ page }) => {
  let submittedBody = "";
  await page.route("**/api/v1/auth/refresh", (route) =>
    route.fulfill({
      json: {
        code: 0,
        message: "ok",
        data: {
          accessToken: "e2e-memory-token",
          user: {
            id: "u-dice-e2e",
            email: "dice-e2e@example.invalid",
            username: "骰子测试",
            avatar: null,
            role: "USER",
          },
        },
      },
    }),
  );

  await page.route("**/api/v1/meta", (route) =>
    route.fulfill({
      json: {
        code: 0,
        message: "ok",
        data: { markdownContractVersion: 4 },
      },
    }),
  );

  await page.route("**/api/v1/threads/draft", (route) =>
    route.fulfill({ json: { code: 0, message: "ok", data: [] } }),
  );
  await page.route("**/api/v1/thread-categories", (route) =>
    route.fulfill({
      json: {
        code: 0,
        message: "ok",
        data: [{
          id: "category-dice-e2e",
          slug: "MYSTERY",
          name: "悬疑推理",
          description: null,
          icon: "search",
          sortOrder: 0,
          isActive: true,
          mergedIntoId: null,
          createdAt: "2026-08-08T00:00:00.000Z",
          updatedAt: "2026-08-08T00:00:00.000Z",
        }],
      },
    }),
  );
  await page.route("**/api/v1/drafts/state", (route) =>
    route.fulfill({
      json: {
        code: 0,
        message: "ok",
        data: {
          drafts: [{
            id: "draft-editor-e2e",
            userId: "u-dice-e2e",
            slot: 1,
            content: "浏览器内的正文草稿",
            version: 1,
            createdAt: "2026-08-08T00:00:00.000Z",
            updatedAt: "2026-08-08T00:00:00.000Z",
          }],
          usedSlots: 1,
          maxSlots: 5,
          slots: [1],
        },
      },
    }),
  );
  await page.route("**/api/v1/notifications/unread", (route) =>
    route.fulfill({
      json: { code: 0, message: "ok", data: { unreadCount: 0 } },
    }),
  );
  await page.route("**/api/v1/direct-conversations/unread", (route) =>
    route.fulfill({
      json: {
        code: 0,
        message: "ok",
        data: { unreadMessageCount: 0, pendingRequestCount: 0, total: 0 },
      },
    }),
  );
  await page.route("**/api/v1/wallet", (route) =>
    route.fulfill({
      json: {
        code: 0,
        message: "ok",
        data: { balance: "0", receivedTipTotal: "0", receivedTipCount: 0 },
      },
    }),
  );
  await page.route("**/api/v1/wallet/check-in", (route) =>
    route.fulfill({
      json: {
        code: 0,
        message: "ok",
        data: {
          claimedNow: false,
          date: "2026-08-08",
          rewardAmount: "3",
          experienceAwarded: 0,
          balance: "0",
          progression: {
            level: 1,
            experience: 0,
            currentLevelExperience: 0,
            nextLevelExperience: 50,
          },
        },
      },
    }),
  );
  await page.route("**/api/v1/threads", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    await route.fulfill({ json: { code: 0, message: "ok", data: thread } });
  });
  await page.route("**/api/v1/threads/t-dice-e2e", (route) =>
    route.fulfill({ json: { code: 0, message: "ok", data: thread } }),
  );
  await page.route("**/api/v1/threads/t-dice-e2e/aggregate", async (route) => {
    submittedBody = (route.request().postDataJSON() as { content: string }).content;
    await route.fulfill({
      json: {
        code: 0,
        message: "ok",
        data: { ...thread, title: "骰子发布载荷测试", published: true },
      },
    });
  });

  await openFreshThreadDraft(page);

  const toolbar = page.getByRole("toolbar", { name: "正文格式工具栏" });
  await expect(toolbar.getByRole("button", { name: "删除线" })).toBeVisible();
  await expect(toolbar.getByRole("button", { name: "无序列表" })).toBeVisible();
  await expect(toolbar.getByRole("button", { name: "左对齐，点击切换" })).toBeVisible();
  await expect(toolbar.getByRole("button", { name: "骰子" })).toBeVisible();
  await expect(toolbar.getByRole("button", { name: "更多" })).toHaveCount(0);

  const iconPaint = await toolbar.evaluate((element) =>
    [...element.querySelectorAll<SVGSVGElement>(".top-bar-item svg.lucide")]
      .filter((icon) => {
        const button = icon.closest<HTMLElement>(".top-bar-item");
        return button && getComputedStyle(button).display !== "none";
      })
      .map((icon) => ({
        fill: getComputedStyle(icon).fill,
        stroke: getComputedStyle(icon).stroke,
        svgCount: icon.closest(".top-bar-item")?.querySelectorAll("svg").length ?? 0,
      })),
  );
  expect(iconPaint.length).toBeGreaterThan(0);
  expect(iconPaint.every(({ fill, stroke, svgCount }) =>
    fill === "none" && stroke !== "none" && svgCount === 1,
  )).toBe(true);

  const editor = page.locator(".milkdown .ProseMirror");
  await editor.click();
  const boldButton = toolbar.getByRole("button", { name: "粗体" });
  await boldButton.click();
  await expect(boldButton).toHaveClass(/\bactive\b/u);
  await expect(boldButton.locator("svg.lucide")).toHaveCSS("fill", "none");
  await boldButton.click();
  await editor.fill("对齐测试段落");

  const host = page.locator(".milkdown-editor").first();
  await host.evaluate((element) => {
    element.style.width = "640px";
  });
  await expect(toolbar).toHaveAttribute("data-editor-density", "with-more");
  for (const label of ["链接", "引用", "分隔线", "骰子"]) {
    await expect(toolbar.getByRole("button", { name: label })).toBeVisible();
  }
  for (const label of ["行内代码", "无序列表", "有序列表", "左对齐，点击切换"]) {
    await expect(toolbar.getByRole("button", { name: label })).not.toBeVisible();
  }
  const moreButton = toolbar.getByRole("button", { name: "更多" });
  await moreButton.click();
  const moreMenu = page.getByRole("menu", { name: "更多正文格式" });
  await expect(moreMenu).toBeVisible();
  await expectMenuTethered(moreButton, moreMenu);
  for (const label of ["行内代码", "无序列表", "有序列表"]) {
    await expect(moreMenu.getByRole("menuitem", { name: label })).toBeVisible();
  }
  const alignmentPicker = moreMenu.getByRole("group", { name: "段落对齐" });
  await expect(alignmentPicker.getByRole("menuitemradio", { name: "左对齐" }))
    .toHaveAttribute("aria-checked", "true");
  await expect(alignmentPicker.getByRole("menuitemradio", { name: "居中对齐" }))
    .toHaveAttribute("aria-checked", "false");
  await expect(moreMenu).toHaveScreenshot("editor-more-menu.png", {
    animations: "disabled",
  });
  await alignmentPicker.getByRole("menuitemradio", { name: "居中对齐" }).hover();
  await expect(page.getByRole("tooltip")).toHaveText("居中对齐");
  await alignmentPicker.getByRole("menuitemradio", { name: "居中对齐" }).click();
  await expect(editor.locator(":scope > p").first()).toHaveAttribute(
    "data-wenyou-align",
    "center",
  );
  await moreButton.click();
  await moreMenu.getByRole("menuitemradio", { name: "左对齐" }).click();
  await expect(editor.locator(":scope > p").first()).not.toHaveAttribute(
    "data-wenyou-align",
  );
  await moreButton.click();
  for (const label of ["链接", "引用", "分隔线", "骰子"]) {
    await expect(moreMenu.getByRole("menuitem", { name: label })).toHaveCount(0);
  }
  await page.keyboard.press("Escape");

  await host.evaluate((element) => {
    element.style.width = "320px";
  });
  await expect(toolbar).toHaveAttribute(
    "data-editor-density",
    /^(?:with-more|without-draft|compact)$/u,
  );
  const narrowMetrics = await toolbar.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    itemTops: [
      ...element.querySelectorAll<HTMLElement>(
        ".top-bar-heading-button, .top-bar-item",
      ),
    ].filter((item) => getComputedStyle(item).display !== "none")
      .map((item) => item.offsetTop),
  }));
  expect(
    Math.max(...narrowMetrics.itemTops) - Math.min(...narrowMetrics.itemTops),
  ).toBeLessThanOrEqual(4);
  expect(narrowMetrics.scrollWidth).toBeLessThanOrEqual(narrowMetrics.clientWidth + 1);
  await expect(toolbar.getByRole("button", { name: "更多" })).toBeVisible();
  await expect(toolbar.getByRole("button", { name: "正文草稿" })).not.toBeVisible();
  const narrowDensity = await toolbar.getAttribute("data-editor-density");
  if (narrowDensity === "compact") {
    await expect(toolbar.getByRole("button", { name: "删除线" })).not.toBeVisible();
  } else {
    await expect(toolbar.getByRole("button", { name: "删除线" })).toBeVisible();
  }
  await moreButton.click();
  await expect(moreMenu.getByRole("menuitem", { name: "骰子" })).toBeVisible();
  await expectMenuTethered(moreButton, moreMenu);
  await page.keyboard.press("Escape");
  const headingButton = toolbar.locator(".top-bar-heading-button");
  await headingButton.click();
  const headingMenu = toolbar.locator(".top-bar-heading-dropdown");
  await expect(headingMenu).toBeVisible();
  await expect(headingMenu).toHaveCSS("position", "fixed");
  const menuBox = await headingMenu.boundingBox();
  expect(menuBox).not.toBeNull();
  expect(menuBox!.x).toBeGreaterThanOrEqual(8);
  expect(menuBox!.x + menuBox!.width).toBeLessThanOrEqual(
    (await page.evaluate(() => window.innerWidth)) - 8,
  );
  await headingButton.click();
  await expect(headingMenu).toHaveCount(0);
  await host.evaluate((element) => {
    element.style.width = "";
  });
  await expect(toolbar).toHaveAttribute("data-editor-density", "expanded");

  await editor.fill("分隔线前");
  await toolbar.getByRole("button", { name: "分隔线" }).click();
  const editorDivider = editor.locator("hr").first();
  await expect(editorDivider).toBeVisible();
  await editorDivider.click();
  await expect(editorDivider).toHaveClass(/\bProseMirror-selectednode\b/u);

  const selectedDivider = await readEditorDividerMetrics(editorDivider);
  expect(selectedDivider.selected).toBe(true);
  expect(selectedDivider.widthRatio).toBeCloseTo(0.5, 2);
  expect(selectedDivider.paddingTop).toBe(0);
  expect(selectedDivider.paddingBottom).toBe(0);
  expect(selectedDivider.height).toBe(5);
  expect(selectedDivider.backgroundColor).toBe("rgba(0, 0, 0, 0)");
  expect(selectedDivider.lineHeight).toBe(1);
  expect(selectedDivider.markerHeight).toBe(5);
  expect(selectedDivider.lineTop).toBeCloseTo(selectedDivider.markerTop, 3);

  const trailingParagraph = editor.locator("hr + p");
  await expect(trailingParagraph).toHaveCount(1);
  await trailingParagraph.click();
  await page.keyboard.type("分隔线后");
  await expect(trailingParagraph).toHaveText("分隔线后");
  await expect(editorDivider).not.toHaveClass(/\bProseMirror-selectednode\b/u);

  const editingBelowDivider = await readEditorDividerMetrics(editorDivider);
  expect(editingBelowDivider.selected).toBe(false);
  expect(editingBelowDivider.widthRatio).toBeCloseTo(0.5, 2);
  expect(editingBelowDivider.lineTop).toBeCloseTo(
    editingBelowDivider.markerTop,
    3,
  );
  expect(editingBelowDivider.lineTop).toBeCloseTo(selectedDivider.lineTop, 3);
  expect(editingBelowDivider.markerTop).toBeCloseTo(selectedDivider.markerTop, 3);

  await editor.fill("需要删除的文字");
  await editor.selectText();
  const strikethroughButton = toolbar.getByRole("button", { name: "删除线" });
  await strikethroughButton.click();
  await expect(editor.locator("del")).toHaveText("需要删除的文字");
  await strikethroughButton.click();
  await expect(editor.locator("del")).toHaveCount(0);

  await editor.click();
  await editor.fill("玛利亚发财的概率：");
  await toolbar.getByRole("button", { name: "骰子" }).click();

  const popover = page.getByRole("dialog", { name: "插入骰子" });
  await expect(popover).toBeVisible();
  await popover.getByRole("button", { name: "d100" }).click();
  await popover.getByRole("button", { name: "插入", exact: true }).click();
  await expect(page.getByRole("note", { name: "骰子 1d100，待掷" })).toHaveText(
    "1d100 = ?",
  );

  await page.getByRole("button", { name: "正文草稿" }).click();
  const draftPanel = page.getByRole("region", { name: "正文草稿" });
  await expect(draftPanel).toBeVisible();
  await expect(draftPanel).toContainText("浏览器内的正文草稿");
  await draftPanel.scrollIntoViewIfNeeded();
  const autoSaveSwitch = draftPanel.getByRole("switch", { name: "自动保存到草稿 1" });
  const switchGeometry = await autoSaveSwitch.evaluate((track) => {
    const thumb = track.querySelector<HTMLElement>(
      '[data-slot="content-drafts-autosave-thumb"]',
    );
    const trackRect = track.getBoundingClientRect();
    const thumbRect = thumb!.getBoundingClientRect();
    return {
      leftGap: thumbRect.left - trackRect.left,
      topGap: thumbRect.top - trackRect.top,
      bottomGap: trackRect.bottom - thumbRect.bottom,
    };
  });
  expect(switchGeometry.leftGap).toBeCloseTo(2, 0);
  expect(switchGeometry.topGap).toBeCloseTo(2, 0);
  expect(switchGeometry.bottomGap).toBeCloseTo(2, 0);
  expect(await draftPanel.evaluate((element) => getComputedStyle(element).position)).not.toBe("fixed");
  await expect(page.getByRole("dialog", { name: "正文草稿" })).toHaveCount(0);
  await page.getByRole("button", { name: "收起正文草稿" }).click();
  await expect(draftPanel).toHaveCount(0);
  await expect(editor).toBeVisible();

  await page.getByLabel("主题帖标题").fill("骰子发布载荷测试");
  await page.getByRole("button", { name: "发布", exact: true }).click();
  await expect.poll(() => submittedBody).toMatch(
    /^玛利亚发财的概率：\[\[dice:v1:[0-9a-f-]{36}:1d100\]\]$/u,
  );
  expect(submittedBody).not.toContain("\\[\\[dice:v1:");
});

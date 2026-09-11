import { expect, test, type Page, type Route } from "@playwright/test";
import { openFreshThreadDraft } from "./fixtures/auth";
const THREAD_ID = "stability-thread";
const SUBTHREAD_ID = "stability-main";
const USER_ID = "stability-owner";
const THREAD_TITLE = "稳定性草稿";
type AggregateRequest = { content?: string; published?: boolean; title?: string };
type AlignmentHarness = { aggregateRequests: AggregateRequest[]; getStoredMarkdown: () => string; setPublished: (value: boolean) => void };
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

async function mockStabilityWorkspace(
  page: Page,
  initialMarkdown: string,
  markdownVersion = 5,
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
      return fulfill(route, { markdownContractVersion: markdownVersion });
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


test("稳定性候选：真实浏览器按字素删除 Emoji，保存当前正文后重开", async ({ page }) => {
  const harness = await mockStabilityWorkspace(page, "甲👩‍💻乙");
  await openFreshThreadDraft(page);
  const editor = page.locator(".ProseMirror").first();
  await expect(editor).toHaveText("甲👩‍💻乙");
  await editor.locator("p").evaluate((element) => {
    const range = document.createRange();
    range.setStart(element.firstChild!, 6); range.collapse(true);
    const selection = window.getSelection(); selection?.removeAllRanges(); selection?.addRange(range);
    (element.closest(".ProseMirror") as HTMLElement).focus();
  });
  await page.keyboard.type("新");
  await page.keyboard.press("Backspace");
  await page.keyboard.press("Backspace");
  await expect(editor).toHaveText("甲乙");
  await page.getByRole("button", { name: "保存草稿", exact: true }).click();
  await expect.poll(harness.getStoredMarkdown).toBe("甲乙");
  await page.reload();
  await page.getByRole("link", { name: "继续编辑", exact: true }).click();
  await expect(page.locator(".ProseMirror").first()).toHaveText("甲乙");
});

test("稳定性候选：字面引用标记与代码在保存重开后保留结构", async ({ page }) => {
  const source = "\\> 引用源码 `> <br />`\n\n\u00a0甲\u00a0";
  const harness = await mockStabilityWorkspace(page, source);
  await openFreshThreadDraft(page);
  const editor = page.locator(".ProseMirror").first();
  await expect(editor.locator("code")).toHaveText("> <br />");
  await expect(editor.locator("blockquote")).toHaveCount(0);
  await page.getByRole("button", { name: "保存草稿", exact: true }).click();
  await expect.poll(harness.getStoredMarkdown).toBe(source);
  await page.reload();
  await page.getByRole("link", { name: "继续编辑", exact: true }).click();
  await expect(editor.locator("code")).toHaveText("> <br />");
  await expect(editor.locator("blockquote")).toHaveCount(0);
});

for (const [version, source] of [[5, "甲 [[widget:v9:future]]"], [3, "[wenyousite-align-v1-center]: #\n甲"], [6, "甲"]] as const) {
  test(`稳定性候选：版本 ${version} 原文保护阻止修改旁边字段后覆盖正文`, async ({ page }) => {
    const harness = await mockStabilityWorkspace(page, source, version);
    await page.goto("/threads/create");
    await page.getByRole("button", { name: "新建主题帖" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "原文已保留" })).toBeVisible();
    await expect(page.locator(".ProseMirror")).toHaveCount(0);
    await page.getByPlaceholder("给你的主题帖起个名字").fill("新标题");
    await expect(page.getByRole("button", { name: "保存草稿", exact: true })).toBeDisabled();
    await expect(page.getByRole("button", { name: "发布", exact: true })).toBeDisabled();
    expect(harness.aggregateRequests).toEqual([]);
    expect(harness.getStoredMarkdown()).toBe(source);
  });
}

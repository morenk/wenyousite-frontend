import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  deleteMomentDraft,
  loadMomentDraft,
  saveMomentDraft,
  type MomentDraftRecord,
} from "@/lib/moment-draft";

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-08-08T12:00:00.000Z").getTime();

function draft(
  userId: string,
  overrides: Partial<MomentDraftRecord> = {},
): MomentDraftRecord {
  const file = new File([`${userId}-image`], `${userId}.jpg`, {
    type: "image/jpeg",
    lastModified: NOW - DAY_MS,
  });
  return {
    userId,
    title: `${userId} 的草稿`,
    content: "尚未发布的正文",
    files: [{ id: `${userId}-file`, file }],
    coverFileId: `${userId}-file`,
    updatedAt: NOW,
    ...overrides,
  };
}

describe("moment draft storage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal("indexedDB", new IDBFactory());
  });

  test("按用户隔离保存、读取并覆盖完整图文草稿", async () => {
    const first = draft("user-1");
    const second = draft("user-2");

    await saveMomentDraft(first);
    await saveMomentDraft(second);

    const restored = await loadMomentDraft("user-1");
    expect(restored).toMatchObject({
      userId: "user-1",
      title: "user-1 的草稿",
      content: "尚未发布的正文",
      coverFileId: "user-1-file",
      updatedAt: NOW,
    });
    expect(restored?.files).toHaveLength(1);
    expect(restored?.files[0]).toMatchObject({ id: "user-1-file" });
    // fake-indexeddb 使用 Node structuredClone，原型不与 happy-dom 的 File 共用；
    // 文件元数据仍应像浏览器持久化结果一样完整保留。
    expect(restored?.files[0].file).toMatchObject({
      name: "user-1.jpg",
      type: "image/jpeg",
      lastModified: NOW - DAY_MS,
    });
    expect((await loadMomentDraft("user-2"))?.title).toBe("user-2 的草稿");

    await saveMomentDraft({ ...first, title: "覆盖后的标题", files: [], coverFileId: null });
    await expect(loadMomentDraft("user-1")).resolves.toMatchObject({
      title: "覆盖后的标题",
      files: [],
      coverFileId: null,
    });
  });

  test("超过七天的草稿读取时自动清理且不影响其他用户", async () => {
    vi.spyOn(Date, "now").mockReturnValue(NOW);
    await saveMomentDraft(draft("expired", { updatedAt: NOW - 8 * DAY_MS }));
    await saveMomentDraft(draft("boundary", { updatedAt: NOW - 7 * DAY_MS }));

    await expect(loadMomentDraft("expired")).resolves.toBeNull();
    await expect(loadMomentDraft("expired")).resolves.toBeNull();
    await expect(loadMomentDraft("boundary")).resolves.toMatchObject({ userId: "boundary" });
  });

  test("显式删除后返回空，重复删除保持幂等", async () => {
    await saveMomentDraft(draft("user-1"));

    await deleteMomentDraft("user-1");
    await deleteMomentDraft("user-1");

    await expect(loadMomentDraft("user-1")).resolves.toBeNull();
  });
});

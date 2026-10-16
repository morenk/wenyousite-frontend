import "fake-indexeddb/auto";
import { expect, test } from "vitest";
import { loadAudioDraft, saveAudioDraft, removeAudioDraft, saveAudioProjection, loadAudioProjections } from "../audio-draft";
test("音频 Blob、mediaId 和完成结果本机保存，账号与目标隔离", async () => {
  const file = new File(["audio"], "rain.mp3", { type: "audio/mpeg" });
  const key = JSON.stringify(["user1", "reply:1"]);
  const completed = { sourceUrl: "https://bucket.example/audio.mp3", mediaId: "media1", contentType: "audio/mpeg" as const, size: 100, durationMs: 1000 };
  await saveAudioDraft({ key, userId: "user1", file, mediaId: "media1", completed, updatedAt: Date.now() });
  expect(await loadAudioDraft(key, "user1")).toMatchObject({ mediaId: "media1", completed });
  expect(await loadAudioDraft(JSON.stringify(["user2", "reply:1"]), "user2")).toBeNull();
  expect(await loadAudioDraft(JSON.stringify(["user1", "reply:2"]), "user1")).toBeNull();
  await removeAudioDraft(key); expect(await loadAudioDraft(key, "user1")).toBeNull();
});
test("过期音频暂存删除，避免长期占用本机空间", async () => {
  const key = "expired";
  await saveAudioDraft({ key, userId: "user1", file: new File(["a"], "a.mp3"), updatedAt: Date.now() - 8 * 86400_000 });
  expect(await loadAudioDraft(key, "user1")).toBeNull();
});

test("完成投影独立于文件恢复记录，按账号和目标恢复", async () => {
 const key = JSON.stringify(["projection-user", "reply:1"]);
 const media = { sourceUrl: "https://bucket.example/a.mp3", mediaId: "media", contentType: "audio/mpeg" as const, size: 100, durationMs: 1000 };
 await saveAudioDraft({ key, userId: "projection-user", file: new File(["a"], "a.mp3"), completed: media, updatedAt: Date.now() });
 await saveAudioProjection(key, "projection-user", media); await removeAudioDraft(key);
 expect(await loadAudioProjections(key, "projection-user")).toEqual([media]);
 expect(await loadAudioProjections(key, "other-user")).toEqual([]);
 expect(await loadAudioProjections(JSON.stringify(["projection-user", "reply:2"]), "projection-user")).toEqual([]);
 await saveAudioProjection(key, "projection-user", { ...media, size: 0 });
 expect(await loadAudioProjections(key, "projection-user")).toEqual([media]);
});

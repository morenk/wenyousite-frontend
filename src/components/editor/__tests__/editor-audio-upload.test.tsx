import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { CrepeBuilder } from "@milkdown/crepe/builder";
import type { RefObject } from "react";
import { useEditorAudioUpload } from "../use-editor-audio-upload";
import type { AudioDraftRecord } from "@/lib/audio-draft";
import type { AudioUploadCapability } from "@/lib/upload-audio";
const mocks = vi.hoisted(() => ({ upload: vi.fn(), load: vi.fn(), save: vi.fn(), remove: vi.fn(), insert: vi.fn(), clear: vi.fn(), capability: undefined as AudioUploadCapability | undefined }));
vi.mock("@/api/hooks/use-api-meta", () => ({ useApiMeta: () => ({ data: { audioUpload: mocks.capability } }) }));
vi.mock("@/api/hooks/use-upload-audio", () => ({ useUploadAudio: () => ({ mutateAsync: mocks.upload }) }));
vi.mock("@/lib/audio-draft", () => ({ loadAudioDraft: mocks.load, saveAudioDraft: mocks.save, removeAudioDraft: mocks.remove }));
vi.mock("../editor-audio-anchor", () => ({ createAudioUploadAnchor: () => ({
  plugin: {}, setTarget: (element: HTMLElement | null) => { if (element) document.body.append(element); }, start: vi.fn(), remove: mocks.clear, insert: mocks.insert,
}) }));
const capability: AudioUploadCapability = { version: 1, maxBytes: 31457280, maxDurationMs: 600000, contentTypes: ["audio/mpeg"], outputContentType: "audio/mpeg" };
const completed = { sourceUrl: "https://bucket.example/audio.mp3", mediaId: "media1", contentType: "audio/mpeg" as const, size: 100, durationMs: 1000 };
const view = { state: { doc: { descendants: vi.fn() } } };
const editor = { current: { editor: { action: (run: (ctx: { get: () => typeof view }) => unknown) => run({ get: () => view }) } } } as unknown as RefObject<CrepeBuilder | null>;
let file: File;
beforeEach(() => {
  vi.clearAllMocks(); mocks.capability = capability;
  mocks.load.mockResolvedValue(null); mocks.save.mockResolvedValue(undefined); mocks.remove.mockResolvedValue(undefined); mocks.insert.mockReturnValue(true); mocks.upload.mockReset();
  file = new File(["audio"], "rain.mp3", { type: "audio/mpeg" });
  vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(function () { Object.defineProperty(this, "files", { value: [file] }); fireEvent.change(this); });
});
afterEach(() => { cleanup(); document.body.replaceChildren(); vi.restoreAllMocks(); });
for (const change of ["account", "target"] as const) test(`${change} 切换失效占位/迟到预约/完成，保留旧本机草稿`, async () => {
  let finish!: (value: typeof completed) => void;
  mocks.upload.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  const hook = renderHook(({ user, key }) => useEditorAudioUpload(editor, user, key, false), { initialProps: { user: "user1", key: "reply:1" } });
  await waitFor(() => expect(hook.result.current.hasPending()).toBe(false));
  await act(async () => { hook.result.current.open(); });
  await waitFor(() => expect(mocks.upload).toHaveBeenCalledTimes(1));
  const oldOptions = mocks.upload.mock.calls[0][0].options;
  expect(hook.result.current.hasPending()).toBe(true);
  hook.rerender(change === "account" ? { user: "user2", key: "reply:1" } : { user: "user1", key: "reply:2" });
  expect(oldOptions.signal.aborted).toBe(true);
  await waitFor(() => expect(hook.result.current.hasPending()).toBe(false));
  await expect(oldOptions.onReservation({ mediaId: "late" })).rejects.toMatchObject({ name: "AbortError" });
  await act(async () => { finish(completed); });
  expect(mocks.insert).not.toHaveBeenCalled(); expect(mocks.remove).not.toHaveBeenCalled();
  expect(mocks.save.mock.calls.every(([record]: [AudioDraftRecord]) => record.key === JSON.stringify(["user1", "reply:1"]))).toBe(true);
  mocks.upload.mockResolvedValueOnce(completed);
  await waitFor(() => expect(hook.result.current.hasPending()).toBe(false));
  await act(async () => { hook.result.current.open(); });
  await waitFor(() => expect(mocks.insert).toHaveBeenCalledTimes(1));
  const saved = mocks.save.mock.calls.at(-1)![0] as AudioDraftRecord;
  expect(saved.key).toBe(JSON.stringify(change === "account" ? ["user2", "reply:1"] : ["user1", "reply:2"]));
  expect(mocks.upload.mock.calls[1][0].options.resume).toBeUndefined();
});
test("完成结果在上传能力关闭后仍可手动恢复，不重新上传", async () => {
  mocks.capability = undefined;
  mocks.load.mockResolvedValueOnce({ key: JSON.stringify(["user1", "reply:1"]), userId: "user1", file, mediaId: "media1", completed, updatedAt: Date.now() });
  const hook = renderHook(() => useEditorAudioUpload(editor, "user1", "reply:1", false));
  await waitFor(() => expect(hook.result.current.hasPending()).toBe(true));
  expect(hook.result.current.available).toBe(false); expect(mocks.upload).not.toHaveBeenCalled();
  await waitFor(() => expect(hook.result.current.placeholder).not.toBeNull());
  render(hook.result.current.placeholder);
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "继续" })); });
  expect(mocks.insert).toHaveBeenCalledWith(view, completed.sourceUrl);
  expect(mocks.upload).not.toHaveBeenCalled(); expect(hook.result.current.hasPending()).toBe(false);
});
test("加载旧草稿的迟到结果不能覆盖新目标", async () => {
  let resolve!: (value: AudioDraftRecord) => void;
  mocks.load.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
  const hook = renderHook(({ key }) => useEditorAudioUpload(editor, "user1", key, false), { initialProps: { key: "reply:1" } });
  hook.rerender({ key: "reply:2" });
  await act(async () => { resolve({ key: JSON.stringify(["user1", "reply:1"]), userId: "user1", file, mediaId: "old", updatedAt: Date.now() }); });
  expect(hook.result.current.hasPending()).toBe(false); expect(screen.queryByRole("status")).toBeNull();
});

test("本机草稿恢复完成前阻止提交空占位", async () => {
  let finish!: (value: null) => void;
  mocks.load.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  const hook = renderHook(() => useEditorAudioUpload(editor, "user1", "reply:1", false));
  expect(hook.result.current.hasPending()).toBe(true);
  await act(async () => { finish(null); });
  expect(hook.result.current.hasPending()).toBe(false);
});

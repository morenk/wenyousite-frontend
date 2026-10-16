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
  expect(mocks.insert).toHaveBeenCalledWith(view, completed.sourceUrl, file.name);
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

test("上传完成先登记完整投影再插入；普通重渲染不重复恢复", async () => {
 const received = vi.fn().mockResolvedValue(undefined); mocks.upload.mockResolvedValue(completed);
 const hook = renderHook(() => useEditorAudioUpload(editor, "user1", "reply:1", false, received));
 await waitFor(() => expect(hook.result.current.hasPending()).toBe(false));
 await act(async () => { hook.result.current.open(); });
 await waitFor(() => expect(mocks.insert).toHaveBeenCalledTimes(1));
 expect(received).toHaveBeenCalledExactlyOnceWith(completed);
 expect(received.mock.invocationCallOrder[0]).toBeLessThan(mocks.insert.mock.invocationCallOrder[0]);
 hook.rerender(); hook.rerender(); expect(mocks.load).toHaveBeenCalledTimes(1);
});
test("重开已入文完成草稿先保留投影，才清理文件记录", async () => {
 const received = vi.fn().mockResolvedValue(undefined);
 mocks.load.mockResolvedValueOnce({ key: "saved", userId: "user1", file, completed, updatedAt: Date.now() });
 view.state.doc.descendants.mockImplementationOnce((visit) => visit({ marks: [{ type: { name: "link" }, attrs: { href: completed.sourceUrl } }] }));
 const hook = renderHook(() => useEditorAudioUpload(editor, "user1", "reply:1", false, received));
 await waitFor(() => expect(mocks.remove).toHaveBeenCalledWith("saved"));
 expect(received).toHaveBeenCalledExactlyOnceWith(completed);
 expect(received.mock.invocationCallOrder[0]).toBeLessThan(mocks.remove.mock.invocationCallOrder[0]);
 hook.rerender(); expect(received).toHaveBeenCalledTimes(1); expect(mocks.insert).not.toHaveBeenCalled();
});

test("选中文件立即显示原名音频占位卡，无链接/音源；处理、取消、失败重试沿原状态", async () => {
 mocks.upload.mockImplementationOnce(({ options }) => new Promise((_resolve, reject) => options.signal.addEventListener("abort", () => reject(options.signal.reason), { once: true })));
 function Harness() {
  const upload = useEditorAudioUpload(editor, "user1", "reply:card", false);
  return <><button onClick={upload.open}>选择音频</button>{upload.placeholder}</>;
 }
 const mounted = render(<Harness />);
 await waitFor(() => expect(mocks.load).toHaveBeenCalledTimes(1));
 await act(async () => { fireEvent.click(screen.getByRole("button", { name: "选择音频" })); });
 await waitFor(() => expect(mocks.upload).toHaveBeenCalledTimes(1));
 const card = document.querySelector('[data-slot="audio-upload-card"]')!;
 expect(card).toHaveTextContent(file.name); expect(card.querySelector("a,audio")).toBeNull();
 expect(screen.getByRole("button", { name: "播放" })).toBeDisabled(); expect(screen.queryByRole("slider")).toBeNull();
 expect(screen.getByRole("progressbar", { name: "音频上传进度" })).toHaveAttribute("aria-valuenow", "0");
 act(() => mocks.upload.mock.calls[0][0].options.onProgress({ stage: "uploading", percent: 37 }));
 expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "37");
 expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuetext", "上传中 37%");
 expect(screen.queryByRole("button", { name: "保存到本地" })).toBeNull();
 act(() => mocks.upload.mock.calls[0][0].options.onProgress({ stage: "processing", percent: null }));
 expect(card).toHaveTextContent("处理中");
 expect(screen.getByRole("progressbar")).not.toHaveAttribute("aria-valuenow");
 expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuetext", "处理中…");
 expect(card.querySelector("audio")).toBeNull();
 await act(async () => { fireEvent.click(screen.getByRole("button", { name: "取消", exact: true })); });
 expect(card).toHaveTextContent("已暂停");
 mocks.upload.mockRejectedValueOnce(new Error("处理失败"));
 await act(async () => { fireEvent.click(screen.getByRole("button", { name: "继续" })); });
 expect(screen.getByRole("alert")).toHaveTextContent("处理失败");
 expect(screen.queryByText("上传失败", { exact: true })).toBeNull();
 mocks.upload.mockResolvedValueOnce(completed);
 await act(async () => { fireEvent.click(screen.getByRole("button", { name: "重试" })); });
 expect(mocks.insert).toHaveBeenCalledWith(view, completed.sourceUrl, file.name);
 expect(document.querySelector('[data-slot="audio-upload-card"]')).toBeNull();
 mounted.unmount();
});

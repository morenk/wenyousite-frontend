import { beforeEach, afterEach, expect, test, vi } from "vitest";
import { uploadAudio, validateAudioFile, audioFileMime, type AudioUploadCapability } from "../upload-audio";
const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), userId: "user1", listeners: new Set<() => void>() }));
vi.mock("@/api/client", () => ({ apiClient: { GET: mocks.get, POST: mocks.post } }));
vi.mock("@/lib/upload-media-file", () => ({ putMediaFile: mocks.put }));
vi.mock("@/lib/auth-store", () => ({ getAuthSnapshot: () => ({ user: { id: mocks.userId } }), subscribeAuthStore: (listener: () => void) => { mocks.listeners.add(listener); return () => mocks.listeners.delete(listener); } }));
const capability: AudioUploadCapability = { version: 1, maxBytes: 31457280, maxDurationMs: 600000, contentTypes: ["audio/mpeg", "audio/mp4", "audio/wav", "audio/ogg", "audio/flac"], outputContentType: "audio/mpeg" };
const media = { id: "media1", userId: "user1", url: "https://bucket.example/audio.mp3", purpose: "RICH_CONTENT_AUDIO", status: "COMPLETED", contentType: "audio/mpeg", size: 100, durationMs: 1000 };
const success = (value: unknown) => ({ data: { data: value } });
beforeEach(() => { vi.clearAllMocks(); mocks.userId = "user1"; mocks.get.mockReset(); mocks.post.mockReset(); mocks.put.mockReset(); mocks.put.mockResolvedValue(undefined); });
afterEach(() => { if (vi.isFakeTimers()) expect(vi.getTimerCount()).toBe(0); vi.restoreAllMocks(); vi.useRealTimers(); expect(mocks.listeners.size).toBe(0); });
test("输入 MIME 规范化及 30MiB 边界", () => {
  expect(audioFileMime(new File(["a"], "a.wav", { type: "audio/x-wav" }))).toBe("audio/wav");
  expect(audioFileMime(new File(["a"], "a.flac"))).toBe("audio/flac");
  expect(validateAudioFile(new File([], "a.mp3", { type: "audio/mpeg" }), capability)).toMatch("不能为空");
  expect(validateAudioFile(new File(["a"], "a.mp3", { type: "text/html" }), capability)).toMatch("请选择");
  const file = new File(["a"], "a.mp3", { type: "audio/mpeg" }); Object.defineProperty(file, "size", { value: 31457281 });
  expect(validateAudioFile(file, capability)).toMatch("30 MiB"); expect(mocks.post).not.toHaveBeenCalled();
});
test("规范 MIME 直传；仅 COMPLETED 返回正式投影", async () => {
  mocks.post.mockResolvedValueOnce(success({ mediaId: "media1", uploadUrl: "https://put.example/signed" })).mockResolvedValueOnce(success({ media }));
  const result = await uploadAudio(new File(["audio"], "a.wav", { type: "audio/x-wav" }), capability);
  expect(mocks.post.mock.calls[0][1].body).toMatchObject({ contentType: "audio/wav", purpose: "RICH_CONTENT_AUDIO", size: 5 });
  expect(mocks.put.mock.calls[0][0]).toBe("https://put.example/signed"); expect(mocks.put.mock.calls[0][1].type).toBe("audio/wav");
  expect(result).toEqual({ sourceUrl: media.url, mediaId: media.id, contentType: media.contentType, size: media.size, durationMs: media.durationMs });
});
test("断网后继续原 ID，已处理完成不重复 PUT 或创建", async () => {
  const file = new File(["audio"], "a.mp3", { type: "audio/mpeg" });
  mocks.post.mockResolvedValueOnce(success({ mediaId: "media1", uploadUrl: "https://put.example/signed" })).mockRejectedValueOnce(new TypeError("offline"));
  await expect(uploadAudio(file, capability)).rejects.toThrow("offline");
  mocks.get.mockResolvedValueOnce(success(media));
  await expect(uploadAudio(file, capability)).resolves.toMatchObject({ mediaId: "media1" });
  expect(mocks.post).toHaveBeenCalledTimes(2); expect(mocks.put).toHaveBeenCalledTimes(1);
});
test("UPLOADING 恢复先确认，缺对象才同 ID 续签", async () => {
  const file = new File(["audio"], "a.mp3", { type: "audio/mpeg" });
  mocks.post.mockResolvedValueOnce(success({ mediaId: "media1", uploadUrl: "https://put.example/first" })); mocks.put.mockRejectedValueOnce(new Error("offline"));
  await expect(uploadAudio(file, capability)).rejects.toThrow("offline");
  mocks.get.mockResolvedValueOnce(success({ ...media, status: "UPLOADING" }));
  mocks.post.mockResolvedValueOnce({ error: { code: 40419 } }).mockResolvedValueOnce(success({ mediaId: "media1", uploadUrl: "https://put.example/resigned" })).mockResolvedValueOnce(success({ media }));
  await uploadAudio(file, capability);
  expect(mocks.post.mock.calls.map((call) => call[0])).toEqual(["/api/v1/media/upload-url", "/api/v1/media/upload-done", "/api/v1/media/{id}/upload-url", "/api/v1/media/upload-done"]);
  expect(mocks.post.mock.calls[2][1].params.path.id).toBe("media1"); expect(mocks.put.mock.calls[1][0]).toBe("https://put.example/resigned");
});
test("处理按1/2/4/8/10秒查询，超过120秒继续，取消后只显式读取原ID", async () => {
  vi.useFakeTimers(); const file = new File(["audio"], "a.mp3", { type: "audio/mpeg" });
  mocks.post.mockResolvedValueOnce(success({ mediaId: "media1", uploadUrl: "https://put.example/signed" })).mockResolvedValueOnce(success({ media: { ...media, status: "PROCESSING" } }));
  mocks.get.mockResolvedValue(success({ ...media, status: "PROCESSING" }));
  const controller = new AbortController();
  const stopped = expect(uploadAudio(file, capability, { signal: controller.signal })).rejects.toMatchObject({ name: "AbortError" });
  await vi.advanceTimersByTimeAsync(0);
  for (const [index, interval] of [1000, 2000, 4000, 8000, 10000].entries()) {
    await vi.advanceTimersByTimeAsync(interval - 1); expect(mocks.get).toHaveBeenCalledTimes(index);
    await vi.advanceTimersByTimeAsync(1); expect(mocks.get).toHaveBeenCalledTimes(index + 1);
  }
  await vi.advanceTimersByTimeAsync(120_000); expect(mocks.get).toHaveBeenCalledTimes(17);
  controller.abort(); await stopped; expect(vi.getTimerCount()).toBe(0);
  await vi.advanceTimersByTimeAsync(60_000); expect(mocks.get).toHaveBeenCalledTimes(17);
  mocks.get.mockResolvedValueOnce(success(media)); await uploadAudio(file, capability);
  expect(mocks.get.mock.calls.at(-1)![1].params.path.id).toBe("media1");
  expect(mocks.post).toHaveBeenCalledTimes(2); expect(mocks.put).toHaveBeenCalledTimes(1);
});
for (const event of ["pagehide", "visibilitychange"]) test(`${event}停止处理，回前台不自动请求`, async () => {
  vi.useFakeTimers();
  mocks.get.mockResolvedValue(success({ ...media, status: "PROCESSING" }));
  const stopped = expect(uploadAudio(new File(["a"], "a.mp3", { type: "audio/mpeg" }), capability, { resume: { mediaId: "media1" } })).rejects.toMatchObject({ name: "AbortError" });
  await vi.advanceTimersByTimeAsync(0);
  if (event === "visibilitychange") { vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden"); document.dispatchEvent(new Event(event)); }
  else window.dispatchEvent(new Event(event));
  await stopped; expect(vi.getTimerCount()).toBe(0);
  vi.restoreAllMocks(); document.dispatchEvent(new Event("visibilitychange"));
  await vi.advanceTimersByTimeAsync(60_000);
  expect(mocks.get).toHaveBeenCalledTimes(1); expect(mocks.put).not.toHaveBeenCalled(); expect(mocks.post).not.toHaveBeenCalled();
});
test("状态请求挂起30秒退出并释放计时器", async () => {
  vi.useFakeTimers(); mocks.get.mockImplementation(() => new Promise(() => {}));
  const stopped = expect(uploadAudio(new File(["a"], "a.mp3", { type: "audio/mpeg" }), capability, { resume: { mediaId: "media1" } })).rejects.toMatchObject({ name: "TimeoutError" });
  await vi.advanceTimersByTimeAsync(30_000); await stopped;
  expect(mocks.get.mock.calls[0][1].signal.aborted).toBe(true); expect(vi.getTimerCount()).toBe(0); expect(mocks.put).not.toHaveBeenCalled();
});
test("PUT相同字节不续命，内部超时不取消外部会话", async () => {
  vi.useFakeTimers(); const controller = new AbortController();
  mocks.post.mockResolvedValueOnce(success({ mediaId: "media1", uploadUrl: "https://put.example/signed" }));
  mocks.put.mockImplementation(() => new Promise(() => {}));
  const stopped = expect(uploadAudio(new File(["audio"], "a.mp3", { type: "audio/mpeg" }), capability, { signal: controller.signal })).rejects.toMatchObject({ name: "TimeoutError" });
  await vi.advanceTimersByTimeAsync(0); const put = mocks.put.mock.calls[0]; expect(put[3]).toBe(300_000);
  await vi.advanceTimersByTimeAsync(20_000); put[4](2, 5);
  await vi.advanceTimersByTimeAsync(20_000); put[4](2, 5);
  await vi.advanceTimersByTimeAsync(10_000); await stopped;
  expect(controller.signal.aborted).toBe(false); expect(put[2].aborted).toBe(true); expect(vi.getTimerCount()).toBe(0);
});
for (const [code, message] of [["AUDIO_INVALID", "重新选择"], ["AUDIO_TOO_LONG", "10 分钟"], ["AUDIO_PROCESSING_FAILED", "处理失败"]]) test(`受控处理失败 ${code}`, async () => {
  mocks.post.mockResolvedValueOnce(success({ mediaId: "media1", uploadUrl: "https://put.example/signed" })).mockResolvedValueOnce(success({ media: { ...media, status: "FAILED", failureCode: code } }));
  await expect(uploadAudio(new File(["audio"], "a.mp3", { type: "audio/mpeg" }), capability)).rejects.toThrow(message);
});
test("账号切换中止上传，旧完成结果不返回", async () => {
  mocks.post.mockResolvedValueOnce(success({ mediaId: "media1", uploadUrl: "https://put.example/signed" }));
  mocks.put.mockImplementationOnce(async () => { mocks.userId = "user2"; for (const listener of mocks.listeners) listener(); });
  mocks.post.mockResolvedValueOnce(success({ media }));
  await expect(uploadAudio(new File(["audio"], "a.mp3", { type: "audio/mpeg" }), capability)).rejects.toMatchObject({ name: "AbortError" });
});

for (const patch of [{ id: "wrong" }, { purpose: "AVATAR" }, { userId: "someone-else" }]) test(`拒绝错配结果 ${JSON.stringify(patch)}`, async () => {
  mocks.post.mockResolvedValueOnce(success({ mediaId: "media1", uploadUrl: "https://put.example/signed" })).mockResolvedValueOnce(success({ media: { ...media, ...patch } }));
  await expect(uploadAudio(new File(["audio"], "a.mp3", { type: "audio/mpeg" }), capability)).rejects.toThrow("响应不匹配");
});
test("错配续签不能发起 PUT", async () => {
  mocks.get.mockResolvedValueOnce(success({ ...media, status: "UPLOADING" }));
  mocks.post.mockResolvedValueOnce({ error: { code: 40419 } }).mockResolvedValueOnce(success({ mediaId: "wrong", uploadUrl: "https://put.example/wrong" }));
  await expect(uploadAudio(new File(["audio"], "a.mp3", { type: "audio/mpeg" }), capability, { resume: { mediaId: "media1" } })).rejects.toThrow("续传响应不匹配");
  expect(mocks.put).not.toHaveBeenCalled();
});

test("通用二进制 MIME 仅按支持扩展名回退", () => {
  const file = new File(["audio"], "RAIN.MP3", { type: "application/octet-stream" });
  expect(audioFileMime(file)).toBe("audio/mpeg"); expect(validateAudioFile(file, capability)).toBeNull();
  expect(validateAudioFile(new File(["x"], "x.bin", { type: "application/octet-stream" }), capability)).toMatch("请选择");
});
test("MP4 文件选择器 MIME 归一化，真实音轨仍由服务端验证", () => {
  const file = new File(["audio"], "voice.mp4", { type: "video/mp4" });
  expect(audioFileMime(file)).toBe("audio/mp4"); expect(validateAudioFile(file, capability)).toBeNull();
});

for (const code of [42901, 42902]) test(`预算拒绝${code}保留文件及原mediaId，不自动新建或PUT`, async () => {
 const file = new File(["audio"], "budget.mp3", { type: "audio/mpeg" });
 mocks.post.mockResolvedValueOnce(success({ mediaId: "media1", uploadUrl: "https://put.example/signed" }));
 mocks.put.mockRejectedValueOnce(new TypeError("offline"));
 await expect(uploadAudio(file, capability)).rejects.toThrow("offline");
 mocks.get.mockResolvedValueOnce(success({ ...media, status: "UPLOADING" }));
 mocks.post.mockResolvedValueOnce({ error: { code, message: "预算限制" } });
 await expect(uploadAudio(file, capability)).rejects.toMatchObject({ code });
 expect(mocks.post).toHaveBeenCalledTimes(2); expect(mocks.put).toHaveBeenCalledTimes(1);
 mocks.get.mockResolvedValueOnce(success(media)); await expect(uploadAudio(file, capability)).resolves.toMatchObject({ mediaId: "media1" });
 expect(mocks.get.mock.calls.at(-1)![1].params.path.id).toBe("media1"); expect(mocks.post).toHaveBeenCalledTimes(2); expect(mocks.put).toHaveBeenCalledTimes(1);
});
for (const code of [42901, 42902]) test(`新预约预算拒绝${code}不进入上传`, async () => {
 mocks.post.mockResolvedValueOnce({ error: { code, message: "预算限制" } });
 await expect(uploadAudio(new File(["audio"], "budget.mp3", { type: "audio/mpeg" }), capability)).rejects.toMatchObject({ code });
 expect(mocks.put).not.toHaveBeenCalled(); expect(mocks.post).toHaveBeenCalledTimes(1);
});

test("确认请求超时保留预约，显式恢复只查询原ID", async () => {
 vi.useFakeTimers(); const file = new File(["audio"], "timeout.mp3", { type: "audio/mpeg" });
 mocks.post.mockResolvedValueOnce(success({ mediaId: "media1", uploadUrl: "https://put.example/signed" })).mockImplementationOnce(() => new Promise(() => {}));
 const failed = expect(uploadAudio(file, capability)).rejects.toMatchObject({ name: "TimeoutError" });
 await vi.advanceTimersByTimeAsync(30_000); await failed;
 mocks.get.mockResolvedValueOnce(success(media)); await expect(uploadAudio(file, capability)).resolves.toMatchObject({ mediaId: "media1" });
 expect(mocks.post).toHaveBeenCalledTimes(2); expect(mocks.put).toHaveBeenCalledTimes(1);
 expect(mocks.get.mock.calls[0][1].params.path.id).toBe("media1");
});
test("PUT持续增长仍受5分钟总时限，超时后忽略迟到progress", async () => {
 vi.useFakeTimers(); const progress = vi.fn();
 mocks.post.mockResolvedValueOnce(success({ mediaId: "media1", uploadUrl: "https://put.example/signed" })); mocks.put.mockImplementation(() => new Promise(() => {}));
 const failed = expect(uploadAudio(new File(["audio"], "total.mp3", { type: "audio/mpeg" }), capability, { onProgress: progress })).rejects.toMatchObject({ name: "TimeoutError" });
 await vi.advanceTimersByTimeAsync(0); const put = mocks.put.mock.calls[0];
 for (let bytes = 1; bytes <= 14; bytes++) { await vi.advanceTimersByTimeAsync(20_000); put[4](bytes, 100); }
 await vi.advanceTimersByTimeAsync(20_000); await failed;
 expect(progress).toHaveBeenCalledTimes(14); put[4](100,100); expect(progress).toHaveBeenCalledTimes(14);
});

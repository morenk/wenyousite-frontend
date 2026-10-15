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
afterEach(() => { vi.useRealTimers(); expect(mocks.listeners.size).toBe(0); });
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
test("处理轮询和超时可手动继续，不重新上传", async () => {
  vi.useFakeTimers(); const file = new File(["audio"], "a.mp3", { type: "audio/mpeg" });
  mocks.post.mockResolvedValueOnce(success({ mediaId: "media1", uploadUrl: "https://put.example/signed" })).mockResolvedValueOnce(success({ media: { ...media, status: "PROCESSING" } }));
  mocks.get.mockResolvedValue(success({ ...media, status: "PROCESSING" }));
  const failure = expect(uploadAudio(file, capability, { processingTimeoutMs: 100 })).rejects.toThrow("仍在处理中"); await vi.advanceTimersByTimeAsync(500); await failure;
  mocks.get.mockResolvedValueOnce(success(media)); await uploadAudio(file, capability);
  expect(mocks.put).toHaveBeenCalledTimes(1);
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

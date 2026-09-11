import { imageFixture } from "./image-fixtures";
/** uploadImage 工具函数测试 */

import { describe, test, expect, vi, afterEach, beforeEach } from "vitest";

vi.mock("@/api/client", () => ({
  apiClient: { POST: vi.fn(), GET: vi.fn() },
}));

import { clearAuthSession, setAuthSession } from "@/lib/auth-store";
import { apiClient } from "@/api/client";
import {
  type UploadReservation,
  type MediaUploadPurpose,
  RecoverableImageUploadError,
  getImageUploadKey,
  isUploadAbortError,
  normalizeImageForUpload,
  uploadImage,
  uploadImageFile,
  validateImageFile,
  validateAvatarFile,
  validateProfileCoverFile,
  getMarkdownImageVariantUrl,
} from "@/lib/upload-image";

type XhrMode = "success" | "pending" | "timeout" | "error" | "http-error" | "throw";

class FakeEventTarget {
  private listeners = new Map<string, Array<(event: ProgressEvent | Event) => void>>();

  addEventListener(type: string, listener: (event: ProgressEvent | Event) => void) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  emit(type: string, event: ProgressEvent | Event = new Event(type)) {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}

class FakeXMLHttpRequest extends FakeEventTarget {
  static instances: FakeXMLHttpRequest[] = [];
  static mode: XhrMode = "success";

  readonly upload = new FakeEventTarget();
  status = 200;
  timeout = 0;
  method = "";
  url = "";
  headers = new Map<string, string>();
  body: Document | XMLHttpRequestBodyInit | null = null;

  constructor() {
    super();
    FakeXMLHttpRequest.instances.push(this);
  }

  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }

  setRequestHeader(name: string, value: string) {
    this.headers.set(name, value);
  }

  send(body: Document | XMLHttpRequestBodyInit | null) {
    this.body = body;
    if (FakeXMLHttpRequest.mode === "throw") throw new Error("send failed");
    if (FakeXMLHttpRequest.mode === "pending") return;
    if (FakeXMLHttpRequest.mode === "timeout") {
      window.setTimeout(() => this.emit("timeout"), this.timeout);
      return;
    }
    if (FakeXMLHttpRequest.mode === "error") {
      queueMicrotask(() => this.emit("error"));
      return;
    }
    if (FakeXMLHttpRequest.mode === "http-error") this.status = 503;
    const total = body instanceof File ? body.size : 1;
    const progress = new Event("progress") as ProgressEvent;
    Object.defineProperties(progress, {
      lengthComputable: { value: true },
      loaded: { value: Math.floor(total / 2) },
      total: { value: total },
    });
    this.upload.emit("progress", progress);
    queueMicrotask(() => this.emit("load"));
  }

  abort() {
    this.emit("abort");
  }
}

function stubXhr(mode: XhrMode) {
  FakeXMLHttpRequest.instances = [];
  FakeXMLHttpRequest.mode = mode;
  vi.stubGlobal("XMLHttpRequest", FakeXMLHttpRequest);
}


async function reserveForRetry(file: File, mediaId: string, purpose: MediaUploadPurpose = "LEGACY") {
  vi.mocked(apiClient.POST).mockResolvedValueOnce({ data: { code: 0, message: "ok", data: { uploadUrl: "https://s3.example.com/reserve", mediaId, objectKey: "reserved", publicUrl: "https://cdn.example.com/reserved" } }, error: undefined });
  stubXhr("error");
  let reservation!: UploadReservation;
  await expect(uploadImageFile(file, { purpose, onReservation: (value) => { reservation = value; } })).rejects.toBeInstanceOf(RecoverableImageUploadError);
  vi.mocked(apiClient.POST).mockClear();
  return reservation;
}

describe("validateImageFile", () => {
  test("合法 jpeg 文件通过", () => {
    const file = new File(["dummy"], "photo.jpg", { type: "image/jpeg" });
    expect(validateImageFile(file)).toBeNull();
  });

  test("合法 png 文件通过", () => {
    const file = new File(["dummy"], "photo.png", { type: "image/png" });
    expect(validateImageFile(file)).toBeNull();
  });

  test("合法 webp 文件通过", () => {
    const file = new File(["dummy"], "photo.webp", { type: "image/webp" });
    expect(validateImageFile(file)).toBeNull();
  });

  test("合法 avif 文件通过", () => {
    const file = new File(["dummy"], "photo.avif", { type: "image/avif" });
    expect(validateImageFile(file)).toBeNull();
  });

  test("svg 文件在请求上传凭证前被拒绝", () => {
    const file = new File(["dummy"], "icon.svg", { type: "image/svg+xml" });
    expect(validateImageFile(file)).toMatch(/仅支持/);
  });

  test("合法 gif 文件通过", () => {
    const file = new File(["dummy"], "anime.gif", { type: "image/gif" });
    expect(validateImageFile(file)).toBeNull();
  });

  test("不支持的文件类型返回错误信息", () => {
    const file = new File(["dummy"], "doc.pdf", { type: "application/pdf" });
    expect(validateImageFile(file)).toMatch(/仅支持/);
  });

  test("超大文件返回错误信息", () => {
    const largeFile = new File(["x".repeat(11 * 1024 * 1024)], "big.jpg", {
      type: "image/jpeg",
    });
    const error = validateImageFile(largeFile);
    expect(error).toMatch(/不能超过 10MB/);
  });

  test("刚好 10MB 文件通过", () => {
    const size = 10 * 1024 * 1024;
    const content = new Uint8Array(size);
    const file = new File([content], "exact.jpg", { type: "image/jpeg" });
    expect(validateImageFile(file)).toBeNull();
  });

  test("空文件被拒绝，与后端 size 最小值保持一致", () => {
    const file = new File([], "empty.png", { type: "image/png" });
    expect(validateImageFile(file)).toMatch(/不能为空/);
  });
});

describe("validateAvatarFile", () => {
  test("合法 jpg/png/webp 通过", () => {
    expect(validateAvatarFile(new File(["x"], "a.jpg", { type: "image/jpeg" }))).toBeNull();
    expect(validateAvatarFile(new File(["x"], "a.png", { type: "image/png" }))).toBeNull();
    expect(validateAvatarFile(new File(["x"], "a.webp", { type: "image/webp" }))).toBeNull();
  });

  test("排除 svg（可能携带脚本）", () => {
    const svg = new File(["<svg/>"], "a.svg", { type: "image/svg+xml" });
    expect(validateAvatarFile(svg)).toMatch(/仅支持/);
  });

  test("排除 gif/avif", () => {
    expect(validateAvatarFile(new File(["x"], "a.gif", { type: "image/gif" }))).toMatch(/仅支持/);
    expect(validateAvatarFile(new File(["x"], "a.avif", { type: "image/avif" }))).toMatch(/仅支持/);
  });

  test("超大文件返回错误信息", () => {
    const largeFile = new File(["x".repeat(11 * 1024 * 1024)], "big.jpg", {
      type: "image/jpeg",
    });
    expect(validateAvatarFile(largeFile)).toMatch(/不能超过 10MB/);
  });

  test("空头像文件被拒绝", () => {
    expect(validateAvatarFile(new File([], "empty.png", { type: "image/png" }))).toMatch(/不能为空/);
  });
});

describe("validateProfileCoverFile", () => {
  test("背景图仅接受 jpg/png/webp", () => {
    expect(validateProfileCoverFile(new File(["x"], "cover.jpg", { type: "image/jpeg" }))).toBeNull();
    expect(validateProfileCoverFile(new File(["x"], "cover.png", { type: "image/png" }))).toBeNull();
    expect(validateProfileCoverFile(new File(["x"], "cover.webp", { type: "image/webp" }))).toBeNull();
    expect(validateProfileCoverFile(new File(["x"], "cover.gif", { type: "image/gif" }))).toMatch(/仅支持/);
  });

  test("背景图拒绝空文件和超过 10MB 的文件", () => {
    expect(validateProfileCoverFile(new File([], "empty.png", { type: "image/png" }))).toMatch(/不能为空/);
    const large = new File([new Uint8Array(10 * 1024 * 1024 + 1)], "large.png", { type: "image/png" });
    expect(validateProfileCoverFile(large)).toMatch(/不能超过 10MB/);
  });
});

describe("getMarkdownImageVariantUrl", () => {
  const baseUrl = "https://example.com/uploads/image.png";

  test("md 尺寸返回 _md.webp 后缀", () => {
    expect(getMarkdownImageVariantUrl(baseUrl, "md")).toBe(
      "https://example.com/uploads/image_md.webp",
    );
  });

  test("feed 尺寸返回 _feed.webp 后缀", () => {
    expect(getMarkdownImageVariantUrl(baseUrl, "feed")).toBe(
      "https://example.com/uploads/image_feed.webp",
    );
  });

  test("svg 文件不添加后缀（保持原 URL）", () => {
    const svgUrl = "https://example.com/uploads/icon.svg";
    expect(getMarkdownImageVariantUrl(svgUrl, "md")).toBe(svgUrl);
  });

  test("无扩展名的 URL 按 lastIndexOf '.' 处理", () => {
    const result = getMarkdownImageVariantUrl("https://example.com/uploads/img", "md");
    expect(result).toContain("_md.webp");
  });

  test("多级路径的图片正确替换", () => {
    const url = "https://cdn.example.com/a/b/c/photo.jpeg";
    expect(getMarkdownImageVariantUrl(url, "feed")).toBe(
      "https://cdn.example.com/a/b/c/photo_feed.webp",
    );
  });
});

describe("normalizeImageForUpload", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  test("静态大图限制最长边、清除源格式并输出 WebP", async () => {
    const close = vi.fn();
    const drawImage = vi.fn();
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue({
      width: 4000,
      height: 2000,
      close,
    }));
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage } as never);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback) => {
      callback(new Blob(["webp"], { type: "image/webp" }));
    });

    const source = new File([imageFixture("static.jpeg")], "camera.JPG", {
      type: "image/jpeg",
      lastModified: 123,
    });
    const result = await normalizeImageForUpload(source);

    expect(result).not.toBe(source);
    expect(result.name).toBe("camera.webp");
    expect(result.type).toBe("image/webp");
    expect(result.lastModified).toBe(123);
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 2560, 1280);
    expect(close).toHaveBeenCalledOnce();
  });

  test("Safari 不支持 Canvas WebP 编码而回退 PNG 时保留真实格式", async () => {
    const close = vi.fn();
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue({
      width: 1200,
      height: 800,
      close,
    }));
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage: vi.fn(),
    } as never);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback) => {
      callback(new Blob(["png-fallback"], { type: "image/png" }));
    });

    const source = new File([imageFixture("static.jpeg")], "camera.jpg", {
      type: "image/jpeg",
      lastModified: 456,
    });
    const result = await normalizeImageForUpload(source);

    expect(result.name).toBe("camera.png");
    expect(result.type).toBe("image/png");
    expect(result.lastModified).toBe(456);
    expect(close).toHaveBeenCalledOnce();
  });

  test("GIF 绕过 Canvas 转码以保留动画", async () => {
    const createBitmap = vi.fn();
    vi.stubGlobal("createImageBitmap", createBitmap);
    const source = new File([imageFixture("animated.gif")], "animated.gif", { type: "image/gif" });

    await expect(normalizeImageForUpload(source)).resolves.toBe(source);
    expect(createBitmap).not.toHaveBeenCalled();
  });
});

describe("uploadImageFile", () => {
  let file: File;
  let fileSequence = 0;
  const mediaPayload = (
    id: string,
    url: string,
    status: "UPLOADING" | "PROCESSING" | "COMPLETED" | "FAILED",
  ) => ({
    id,
    userId: "u1",
    url,
    thumbnailUrl: status === "COMPLETED" ? `${url}_thumb` : null,
    feedUrl: status === "COMPLETED" ? `${url}_feed` : null,
    mediumUrl: status === "COMPLETED" ? `${url}_md` : null,
    key: `uploads/${id}.jpg`,
    contentType: "image/jpeg",
    size: file.size,
    width: status === "COMPLETED" ? 800 : null,
    height: status === "COMPLETED" ? 600 : null,
    purpose: "LEGACY" as const,
    animated: false,
    status,
    createdAt: "2026-08-21T00:00:00.000Z",
  });

  beforeEach(() => {
    setAuthSession({ id: "test-owner", email: "test@example.invalid", username: "测试", avatar: null, role: "USER" }, "test-token", { announce: false });
    vi.stubGlobal("createImageBitmap", undefined);
    file = new File([imageFixture("static.jpeg")], "photo.jpg", {
      type: "image/jpeg",
      lastModified: 1_700_000_000_000 + fileSequence++,
    });
  });

  afterEach(() => {
    clearAuthSession({ announce: false });
    vi.mocked(apiClient.POST).mockReset();
    vi.mocked(apiClient.GET).mockReset();
    vi.unstubAllGlobals();
  });


  const login = (id: string, token = "token") => setAuthSession({ id, email: `${id}@example.invalid`, username: id, avatar: null, role: "USER" }, token, { announce: false });


  test("同名同size同mtime不同字节不会复用，显式resume也绑定内容", async () => {
    login("owner-a");
    file = new File([await file.arrayBuffer(), new Uint8Array([1, 2])], file.name, { type: file.type, lastModified: file.lastModified });
    const reservation = await reserveForRetry(file, "first", "RICH_CONTENT");
    const original = new Uint8Array(await file.arrayBuffer());
    // JPEG已允许尾随客户端元数据；末尾变动不改变大小或可解析容器。
    const changed = original.slice(); changed[changed.length - 1] ^= 1;
    const other = new File([changed], file.name, { type: file.type, lastModified: file.lastModified });
    expect(await getImageUploadKey(other, "RICH_CONTENT")).not.toBe(await getImageUploadKey(file, "RICH_CONTENT"));
    vi.mocked(apiClient.POST).mockResolvedValueOnce({ data: { code: 0, message: "ok", data: { uploadUrl: "https://s3.example.com/other", mediaId: "other", objectKey: "other", publicUrl: "/other" } }, error: undefined });
    stubXhr("error");
    await expect(uploadImageFile(other, { purpose: "RICH_CONTENT", resume: reservation })).rejects.toMatchObject({ reservation: { mediaId: "other" } });
    expect(apiClient.GET).not.toHaveBeenCalled();
  });

  test("重选内容相同的新File对象可续查，不受文件名和mtime变化影响", async () => {
    login("owner-a");
    await reserveForRetry(file, "same-bytes", "RICH_CONTENT");
    const selectedAgain = new File([await file.arrayBuffer()], "renamed.jpg", { type: file.type, lastModified: file.lastModified + 1 });
    vi.mocked(apiClient.GET).mockResolvedValueOnce({ data: { code: 0, message: "ok", data: mediaPayload("same-bytes", "/same.webp", "COMPLETED") }, error: undefined } as never);
    await expect(uploadImageFile(selectedAgain, { purpose: "RICH_CONTENT" })).resolves.toMatchObject({ mediaId: "same-bytes" });
    expect(apiClient.POST).not.toHaveBeenCalled();
  });


  test.each(["get", "confirm"])("换账号后忽略AbortSignal的迟到%s完成不能提交或复活恢复点", async (stage) => {
    login("owner-a");
    let resolveResponse!: (value: unknown) => void;
    const response = new Promise((resolve) => { resolveResponse = resolve; });
    let resume: UploadReservation | undefined;
    if (stage === "get") {
      resume = await reserveForRetry(file, "late", "RICH_CONTENT");
      vi.mocked(apiClient.GET).mockReturnValueOnce(response as never);
    } else {
      vi.mocked(apiClient.POST)
        .mockResolvedValueOnce({ data: { code: 0, message: "ok", data: { uploadUrl: "https://s3.example.com/late", mediaId: "late", objectKey: "late", publicUrl: "/late" } }, error: undefined })
        .mockReturnValueOnce(response as never);
      stubXhr("success");
    }
    const onCompleted = vi.fn();
    const upload = uploadImageFile(file, { purpose: "RICH_CONTENT", resume, onCompleted });
    const rejected = expect(upload).rejects.toMatchObject({ name: "AbortError" });
    await vi.waitFor(() => expect(stage === "get" ? apiClient.GET : apiClient.POST).toHaveBeenCalledTimes(stage === "get" ? 1 : 2));
    login("owner-b");
    const media = mediaPayload("late", "/late.webp", "COMPLETED");
    resolveResponse({ data: { code: 0, message: "ok", data: stage === "get" ? media : { media, processing: false } }, error: undefined });
    await rejected;
    expect(onCompleted).not.toHaveBeenCalled();
    vi.mocked(apiClient.POST).mockClear(); vi.mocked(apiClient.GET).mockClear();
    await reserveForRetry(file, "new-owner", "RICH_CONTENT");
    expect(apiClient.GET).not.toHaveBeenCalled();
  });

  test("同文件按用途隔离，同时保留原用途的续查", async () => {
    login("owner-a");
    const rich = await reserveForRetry(file, "rich", "RICH_CONTENT");
    await reserveForRetry(file, "moment", "MOMENT");
    expect(apiClient.GET).not.toHaveBeenCalled();
    vi.mocked(apiClient.GET).mockResolvedValueOnce({ data: { code: 0, message: "ok", data: mediaPayload("rich", "/rich.webp", "COMPLETED") }, error: undefined } as never);
    await expect(uploadImageFile(file, { purpose: "RICH_CONTENT", resume: rich })).resolves.toMatchObject({ mediaId: "rich" });
    expect(apiClient.POST).not.toHaveBeenCalled();
  });

  test.each(["switch", "logout-login"])("账号边界%s清除隐式续查，也拒绝旧显式reservation", async (mode) => {
    login("owner-a");
    const previous = await reserveForRetry(file, "old", "RICH_CONTENT");
    if (mode === "logout-login") clearAuthSession({ announce: false });
    login(mode === "switch" ? "owner-b" : "owner-a");
    vi.mocked(apiClient.POST).mockResolvedValueOnce({ data: { code: 0, message: "ok", data: { uploadUrl: "https://s3.example.com/new", mediaId: "new", objectKey: "new", publicUrl: "/new" } }, error: undefined });
    stubXhr("error");
    await expect(uploadImageFile(file, { purpose: "RICH_CONTENT", resume: previous })).rejects.toMatchObject({ reservation: { mediaId: "new" } });
    expect(apiClient.GET).not.toHaveBeenCalled();
    expect(apiClient.POST).toHaveBeenCalledWith("/api/v1/media/upload-url", expect.anything());
  });

  test("同账号token刷新保留续查，换账号立即中断进行中的上传", async () => {
    login("owner-a");
    const reservation = await reserveForRetry(file, "refresh", "RICH_CONTENT");
    login("owner-a", "new-token");
    vi.mocked(apiClient.GET).mockResolvedValueOnce({ data: { code: 0, message: "ok", data: mediaPayload("refresh", "/refresh.webp", "COMPLETED") }, error: undefined } as never);
    await expect(uploadImageFile(file, { purpose: "RICH_CONTENT", resume: reservation })).resolves.toMatchObject({ mediaId: "refresh" });
    vi.mocked(apiClient.POST).mockResolvedValueOnce({ data: { code: 0, message: "ok", data: { uploadUrl: "https://s3.example.com/pending", mediaId: "pending", objectKey: "pending", publicUrl: "/pending" } }, error: undefined });
    stubXhr("pending");
    const onCompleted = vi.fn();
    const upload = uploadImageFile(file, { purpose: "MOMENT", onCompleted });
    const rejected = expect(upload).rejects.toMatchObject({ name: "AbortError" });
    await vi.waitFor(() => expect(FakeXMLHttpRequest.instances).toHaveLength(1));
    login("owner-b");
    await rejected;
    expect(onCompleted).not.toHaveBeenCalled();
    expect(apiClient.POST).toHaveBeenCalledTimes(1);
  });

  test("upload-url 配额超限（code=42900）时抛出友好提示", async () => {
    vi.mocked(apiClient.POST).mockResolvedValueOnce({
      data: undefined,
      error: { code: 42900, message: "图片上传频率超限，请稍后再试", data: null },
    });

    await expect(uploadImageFile(file)).rejects.toThrow("上传图片太频繁，请稍后再试");
  });

  test("upload-url 其他业务错误透传后端 message", async () => {
    vi.mocked(apiClient.POST).mockResolvedValueOnce({
      data: undefined,
      error: { code: 40000, message: "文件类型不支持或超过大小限制", data: null },
    });

    await expect(uploadImageFile(file)).rejects.toThrow("文件类型不支持或超过大小限制");
  });

  test("无上传地址响应时使用稳定兜底错误，且文件键包含完整指纹", async () => {
    vi.mocked(apiClient.POST).mockResolvedValueOnce({ data: undefined, error: undefined });

    expect(await getImageUploadKey(file)).toMatch(/:LEGACY:image\/jpeg:[a-f0-9]{64}$/);
    await expect(uploadImageFile(file)).rejects.toThrow("获取上传地址失败");
  });

  test("开始前已取消时不发起请求，并可识别取消错误", async () => {
    const controller = new AbortController();
    controller.abort();

    const error = await uploadImageFile(file, { signal: controller.signal }).catch(
      (cause: unknown) => cause,
    );
    expect(isUploadAbortError(error)).toBe(true);
    expect(isUploadAbortError(new Error("普通错误"))).toBe(false);
    expect(apiClient.POST).not.toHaveBeenCalled();
  });

  test("完整上传流程返回公开 URL", async () => {
    const uploadUrl = "https://s3.example.com/upload";
    const publicUrl = "https://cdn.example.com/uploads/2026/08/03/u/a.png";

    vi.mocked(apiClient.POST)
      .mockResolvedValueOnce({
        data: {
          code: 0,
          message: "ok",
          data: {
            uploadUrl,
            mediaId: "media-1",
            objectKey: "uploads/2026/08/03/u/a.png",
            publicUrl,
          },
        },
        error: undefined,
      })
      .mockResolvedValueOnce({
        data: {
          code: 0,
          message: "ok",
          data: {
            media: {
              id: "media-1",
              status: "PROCESSING",
              url: publicUrl,
            },
            processing: true,
          },
        },
        error: undefined,
      });

    vi.mocked(apiClient.GET).mockResolvedValueOnce({
      data: {
        code: 0,
        message: "ok",
        data: {
          id: "media-1",
          status: "COMPLETED",
          url: publicUrl,
          thumbnailUrl: `${publicUrl}_thumb`,
          feedUrl: `${publicUrl}_feed`,
          mediumUrl: `${publicUrl}_md`,
          width: 800,
          height: 600,
          contentType: "image/jpeg",
        },
      },
      error: undefined,
    } as never);

    stubXhr("success");
    const onProgress = vi.fn();

    await expect(uploadImageFile(file, { onProgress })).resolves.toEqual(
      expect.objectContaining({
        url: publicUrl,
        mediaId: "media-1",
        width: 800,
        height: 600,
      }),
    );
    const request = FakeXMLHttpRequest.instances[0];
    expect(request.method).toBe("PUT");
    expect(request.url).toBe(uploadUrl);
    expect(request.headers.get("Content-Type")).toBe("image/jpeg");
    expect(request.body).toBe(file);
    expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({
      stage: "uploading",
      loadedBytes: Math.floor(file.size / 2),
      totalBytes: file.size,
      percent: 50,
    }));
    expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({
      stage: "processing",
      percent: 100,
    }));
  });

  test("调用方取消时立即中止对象存储直传，且不确认上传完成", async () => {
    vi.mocked(apiClient.POST).mockResolvedValueOnce({
      data: {
        code: 0,
        message: "ok",
        data: {
          uploadUrl: "https://s3.example.com/upload",
          mediaId: "media-cancelled",
          objectKey: "uploads/cancelled.jpg",
          publicUrl: "https://cdn.example.com/uploads/cancelled.jpg",
        },
      },
      error: undefined,
    });
    stubXhr("pending");

    const controller = new AbortController();
    const upload = uploadImageFile(file, { signal: controller.signal });
    await vi.waitFor(() => expect(FakeXMLHttpRequest.instances).toHaveLength(1));
    controller.abort();

    await expect(upload).rejects.toMatchObject({ name: "AbortError" });
    expect(apiClient.POST).toHaveBeenCalledTimes(1);
  });

  test("对象存储直传超时后给出可操作的错误", async () => {
    vi.mocked(apiClient.POST).mockResolvedValueOnce({
      data: {
        code: 0,
        message: "ok",
        data: {
          uploadUrl: "https://s3.example.com/upload",
          mediaId: "media-timeout",
          objectKey: "uploads/timeout.jpg",
          publicUrl: "https://cdn.example.com/uploads/timeout.jpg",
        },
      },
      error: undefined,
    });
    stubXhr("timeout");

    const onReservation = vi.fn();
    const upload = uploadImageFile(file, { timeoutMs: 1, onReservation });

    await expect(upload).rejects.toMatchObject({
      message: "图片上传超时，请检查网络后重试",
      reservation: { mediaId: "media-timeout" },
    });
    await expect(upload).rejects.toBeInstanceOf(RecoverableImageUploadError);
    expect(onReservation).toHaveBeenCalledWith({ mediaId: "media-timeout" });
    expect(apiClient.POST).toHaveBeenCalledTimes(1);
  });

  test.each(["error", "http-error", "throw"] as const)(
    "对象存储 %s 异常保留 mediaId 供重试",
    async (mode) => {
      vi.mocked(apiClient.POST).mockResolvedValueOnce({
        data: {
          code: 0,
          message: "ok",
          data: {
            uploadUrl: "https://s3.example.com/upload",
            mediaId: `media-${mode}`,
            objectKey: `uploads/${mode}.jpg`,
            publicUrl: `https://cdn.example.com/uploads/${mode}.jpg`,
          },
        },
        error: undefined,
      });
      stubXhr(mode);

      await expect(uploadImageFile(file)).rejects.toMatchObject({
        message: "上传失败，请检查网络后重试",
        reservation: { mediaId: `media-${mode}` },
      });
    },
  );

  test("确认发现对象缺失时重签同一 mediaId 并重新直传", async () => {
    const publicUrl = "https://cdn.example.com/uploads/recover.jpg";
    vi.mocked(apiClient.POST)
      .mockResolvedValueOnce({
        data: {
          code: 0,
          message: "ok",
          data: {
            uploadUrl: "https://s3.example.com/first",
            mediaId: "media-recover",
            objectKey: "uploads/recover.jpg",
            publicUrl,
          },
        },
        error: undefined,
      })
      .mockResolvedValueOnce({
        data: undefined,
        error: { code: 40419, message: "文件不存在或上传未完成", data: null },
      } as never)
      .mockResolvedValueOnce({
        data: {
          code: 0,
          message: "ok",
          data: {
            uploadUrl: "https://s3.example.com/reissued",
            mediaId: "media-recover",
            objectKey: "uploads/recover.jpg",
            publicUrl,
          },
        },
        error: undefined,
      })
      .mockResolvedValueOnce({
        data: {
          code: 0,
          message: "ok",
          data: { media: mediaPayload("media-recover", publicUrl, "PROCESSING"), processing: true },
        },
        error: undefined,
      });
    vi.mocked(apiClient.GET).mockResolvedValueOnce({
      data: { code: 0, message: "ok", data: mediaPayload("media-recover", publicUrl, "COMPLETED") },
      error: undefined,
    } as never);
    stubXhr("success");

    await expect(uploadImageFile(file)).resolves.toMatchObject({
      mediaId: "media-recover",
      url: publicUrl,
    });

    expect(FakeXMLHttpRequest.instances.map((request) => request.url)).toEqual([
      "https://s3.example.com/first",
      "https://s3.example.com/reissued",
    ]);
    expect(vi.mocked(apiClient.POST).mock.calls[2]?.[0]).toBe(
      "/api/v1/media/{id}/upload-url",
    );
  });

  test("手动重试会从原 UPLOADING mediaId 继续，不新建媒体记录", async () => {
    const reservation = await reserveForRetry(file, "media-resume");
    const publicUrl = "https://cdn.example.com/uploads/resume.jpg";
    vi.mocked(apiClient.GET)
      .mockResolvedValueOnce({
        data: { code: 0, message: "ok", data: mediaPayload("media-resume", publicUrl, "UPLOADING") },
        error: undefined,
      } as never)
      .mockResolvedValueOnce({
        data: { code: 0, message: "ok", data: mediaPayload("media-resume", publicUrl, "COMPLETED") },
        error: undefined,
      } as never);
    vi.mocked(apiClient.POST)
      .mockResolvedValueOnce({
        data: undefined,
        error: { code: 40419, message: "文件不存在或上传未完成", data: null },
      } as never)
      .mockResolvedValueOnce({
        data: {
          code: 0,
          message: "ok",
          data: {
            uploadUrl: "https://s3.example.com/resume",
            mediaId: "media-resume",
            objectKey: "uploads/resume.jpg",
            publicUrl,
          },
        },
        error: undefined,
      })
      .mockResolvedValueOnce({
        data: {
          code: 0,
          message: "ok",
          data: { media: mediaPayload("media-resume", publicUrl, "PROCESSING"), processing: true },
        },
        error: undefined,
      });
    stubXhr("success");

    await expect(
      uploadImageFile(file, { resume: reservation }),
    ).resolves.toMatchObject({ mediaId: "media-resume", url: publicUrl });

    const postPaths = vi.mocked(apiClient.POST).mock.calls as unknown as Array<[string]>;
    expect(postPaths.map(([path]) => path)).not.toContain("/api/v1/media/upload-url");
  });

  test("已完成的 reservation 直接复用，uploadImage 只返回 URL", async () => {
    const reservation = await reserveForRetry(file, "media-complete");
    const publicUrl = "https://cdn.example.com/uploads/already-complete.jpg";
    vi.mocked(apiClient.GET).mockResolvedValueOnce({
      data: {
        code: 0,
        message: "ok",
        data: mediaPayload("media-complete", publicUrl, "COMPLETED"),
      },
      error: undefined,
    } as never);

    await expect(
      uploadImage(file, { resume: reservation }),
    ).resolves.toBe(publicUrl);
    expect(apiClient.POST).not.toHaveBeenCalled();
  });

  test("PROCESSING reservation 从状态轮询继续，不重复直传", async () => {
    const reservation = await reserveForRetry(file, "media-processing");
    const publicUrl = "https://cdn.example.com/uploads/processing.jpg";
    vi.mocked(apiClient.GET)
      .mockResolvedValueOnce({
        data: {
          code: 0,
          message: "ok",
          data: mediaPayload("media-processing", publicUrl, "PROCESSING"),
        },
        error: undefined,
      } as never)
      .mockResolvedValueOnce({
        data: {
          code: 0,
          message: "ok",
          data: mediaPayload("media-processing", publicUrl, "COMPLETED"),
        },
        error: undefined,
      } as never);

    await expect(
      uploadImageFile(file, {
        resume: reservation,
        processingTimeoutMs: 1_000,
      }),
    ).resolves.toMatchObject({ mediaId: "media-processing", url: publicUrl });
    expect(apiClient.POST).not.toHaveBeenCalled();
  });

  test("不可继续的 reservation 会丢弃并创建新媒体记录", async () => {
    const reservation = await reserveForRetry(file, "media-failed");
    const publicUrl = "https://cdn.example.com/uploads/replaced.jpg";
    vi.mocked(apiClient.GET).mockResolvedValueOnce({
      data: {
        code: 0,
        message: "ok",
        data: mediaPayload("media-failed", publicUrl, "FAILED"),
      },
      error: undefined,
    } as never);
    vi.mocked(apiClient.POST)
      .mockResolvedValueOnce({
        data: {
          code: 0,
          message: "ok",
          data: {
            uploadUrl: "https://s3.example.com/replaced",
            mediaId: "media-replaced",
            objectKey: "uploads/replaced.jpg",
            publicUrl,
          },
        },
        error: undefined,
      })
      .mockResolvedValueOnce({
        data: {
          code: 0,
          message: "ok",
          data: {
            media: mediaPayload("media-replaced", publicUrl, "COMPLETED"),
            processing: false,
          },
        },
        error: undefined,
      });
    stubXhr("success");

    await expect(
      uploadImageFile(file, { resume: reservation }),
    ).resolves.toMatchObject({ mediaId: "media-replaced" });
    expect(vi.mocked(apiClient.POST).mock.calls[0]?.[0]).toBe("/api/v1/media/upload-url");
  });

  test("确认的网络和 5xx 错误会重试，最终沿用同一 mediaId", async () => {
    const publicUrl = "https://cdn.example.com/uploads/confirm-retry.jpg";
    vi.mocked(apiClient.POST)
      .mockResolvedValueOnce({
        data: {
          code: 0,
          message: "ok",
          data: {
            uploadUrl: "https://s3.example.com/confirm-retry",
            mediaId: "media-confirm-retry",
            objectKey: "uploads/confirm-retry.jpg",
            publicUrl,
          },
        },
        error: undefined,
      })
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce({
        data: undefined,
        error: { code: 50000, message: "temporary", data: null },
        response: { status: 503 },
      } as never)
      .mockResolvedValueOnce({
        data: {
          code: 0,
          message: "ok",
          data: {
            media: mediaPayload("media-confirm-retry", publicUrl, "COMPLETED"),
            processing: false,
          },
        },
        error: undefined,
      });
    stubXhr("success");

    await expect(uploadImageFile(file)).resolves.toMatchObject({
      mediaId: "media-confirm-retry",
    });
    expect(apiClient.POST).toHaveBeenCalledTimes(4);
  });

  test("处理轮询的 4xx 和超时均保留 reservation", async () => {
    const publicUrl = "https://cdn.example.com/uploads/poll-error.jpg";
    vi.mocked(apiClient.POST)
      .mockResolvedValueOnce({
        data: {
          code: 0,
          message: "ok",
          data: {
            uploadUrl: "https://s3.example.com/poll-error",
            mediaId: "media-poll-error",
            objectKey: "uploads/poll-error.jpg",
            publicUrl,
          },
        },
        error: undefined,
      })
      .mockResolvedValueOnce({
        data: {
          code: 0,
          message: "ok",
          data: {
            media: mediaPayload("media-poll-error", publicUrl, "PROCESSING"),
            processing: true,
          },
        },
        error: undefined,
      });
    vi.mocked(apiClient.GET).mockResolvedValueOnce({
      data: undefined,
      error: { code: 40400, message: "媒体不存在", data: null },
      response: { status: 404 },
    } as never);
    stubXhr("success");

    await expect(
      uploadImageFile(file, { processingTimeoutMs: 1_000 }),
    ).rejects.toMatchObject({
      message: "媒体不存在",
      reservation: { mediaId: "media-poll-error" },
    });

    const timeoutFile = new File([imageFixture("static.jpeg"), "timeout-case"], "timeout-poll.jpg", {
      type: "image/jpeg",
      lastModified: file.lastModified + 1,
    });
    vi.mocked(apiClient.POST)
      .mockResolvedValueOnce({
        data: {
          code: 0,
          message: "ok",
          data: {
            uploadUrl: "https://s3.example.com/poll-timeout",
            mediaId: "media-poll-timeout",
            objectKey: "uploads/poll-timeout.jpg",
            publicUrl,
          },
        },
        error: undefined,
      })
      .mockResolvedValueOnce({
        data: {
          code: 0,
          message: "ok",
          data: {
            media: mediaPayload("media-poll-timeout", publicUrl, "PROCESSING"),
            processing: true,
          },
        },
        error: undefined,
      });

    await expect(
      uploadImageFile(timeoutFile, { processingTimeoutMs: 0 }),
    ).rejects.toMatchObject({
      message: "图片仍在处理中，请稍后重试查询；无需重新上传",
      reservation: { mediaId: "media-poll-timeout" },
    });

    const putsBeforeResume = FakeXMLHttpRequest.instances.length;
    const postsBeforeResume = vi.mocked(apiClient.POST).mock.calls.length;
    const display = { url: "https://cdn.example.com/full.webp", contentType: "image/webp", width: 800, height: 600, bytes: 1000, animated: true, frameCount: 2, durationMs: 2000, loopCount: 0 };
    vi.mocked(apiClient.GET).mockResolvedValueOnce({ data: { code: 0, message: "ok", data: { ...mediaPayload("media-poll-timeout", publicUrl, "COMPLETED"), display } }, error: undefined } as never);
    const onCompleted = vi.fn();
    await expect(uploadImageFile(timeoutFile, { onCompleted })).resolves.toMatchObject({ mediaId: "media-poll-timeout", url: publicUrl, display });
    expect(onCompleted).toHaveBeenCalledWith(expect.objectContaining({ mediaId: "media-poll-timeout", url: publicUrl, display }));
    expect(FakeXMLHttpRequest.instances).toHaveLength(putsBeforeResume);
    expect(vi.mocked(apiClient.POST).mock.calls).toHaveLength(postsBeforeResume);
  });
});

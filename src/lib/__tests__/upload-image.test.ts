/** uploadImage 工具函数测试 */

import { describe, test, expect, vi, afterEach, beforeEach } from "vitest";

vi.mock("@/api/client", () => ({
  apiClient: { POST: vi.fn(), GET: vi.fn() },
}));

import { apiClient } from "@/api/client";
import {
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

    const source = new File(["jpeg-with-exif"], "camera.JPG", {
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

  test("GIF 绕过 Canvas 转码以保留动画", async () => {
    const createBitmap = vi.fn();
    vi.stubGlobal("createImageBitmap", createBitmap);
    const source = new File(["gif"], "animated.gif", { type: "image/gif" });

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
    vi.stubGlobal("createImageBitmap", undefined);
    file = new File(["dummy"], "photo.jpg", {
      type: "image/jpeg",
      lastModified: 1_700_000_000_000 + fileSequence++,
    });
  });

  afterEach(() => {
    vi.mocked(apiClient.POST).mockReset();
    vi.mocked(apiClient.GET).mockReset();
    vi.unstubAllGlobals();
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

    expect(getImageUploadKey(file)).toBe(
      [file.name, file.size, file.type, file.lastModified].join(":"),
    );
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
      percent: 40,
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
      uploadImageFile(file, { resume: { mediaId: "media-resume" } }),
    ).resolves.toMatchObject({ mediaId: "media-resume", url: publicUrl });

    const postPaths = vi.mocked(apiClient.POST).mock.calls as unknown as Array<[string]>;
    expect(postPaths.map(([path]) => path)).not.toContain("/api/v1/media/upload-url");
  });

  test("已完成的 reservation 直接复用，uploadImage 只返回 URL", async () => {
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
      uploadImage(file, { resume: { mediaId: "media-complete" } }),
    ).resolves.toBe(publicUrl);
    expect(apiClient.POST).not.toHaveBeenCalled();
  });

  test("PROCESSING reservation 从状态轮询继续，不重复直传", async () => {
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
        resume: { mediaId: "media-processing" },
        processingTimeoutMs: 1_000,
      }),
    ).resolves.toMatchObject({ mediaId: "media-processing", url: publicUrl });
    expect(apiClient.POST).not.toHaveBeenCalled();
  });

  test("不可继续的 reservation 会丢弃并创建新媒体记录", async () => {
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
      uploadImageFile(file, { resume: { mediaId: "media-failed" } }),
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

    const timeoutFile = new File(["dummy"], "timeout-poll.jpg", {
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
      message: "图片处理超时，请稍后重试",
      reservation: { mediaId: "media-poll-timeout" },
    });
  });
});

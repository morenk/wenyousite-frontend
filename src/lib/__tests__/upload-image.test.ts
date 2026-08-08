/** uploadImage 工具函数测试 */

import { describe, test, expect, vi, afterEach } from "vitest";

vi.mock("@/api/client", () => ({
  apiClient: { POST: vi.fn(), GET: vi.fn() },
}));

import { apiClient } from "@/api/client";
import {
  uploadImageFile,
  validateImageFile,
  validateAvatarFile,
  getImageUrlBySize,
} from "@/lib/upload-image";

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

describe("getImageUrlBySize", () => {
  const baseUrl = "https://example.com/uploads/image.png";

  test("md 尺寸返回 _md.webp 后缀", () => {
    expect(getImageUrlBySize(baseUrl, "md")).toBe(
      "https://example.com/uploads/image_md.webp",
    );
  });

  test("thumb 尺寸返回 _thumb.webp 后缀", () => {
    expect(getImageUrlBySize(baseUrl, "thumb")).toBe(
      "https://example.com/uploads/image_thumb.webp",
    );
  });

  test("feed 尺寸返回 _feed.webp 后缀", () => {
    expect(getImageUrlBySize(baseUrl, "feed")).toBe(
      "https://example.com/uploads/image_feed.webp",
    );
  });

  test("svg 文件不添加后缀（保持原 URL）", () => {
    const svgUrl = "https://example.com/uploads/icon.svg";
    expect(getImageUrlBySize(svgUrl, "md")).toBe(svgUrl);
    expect(getImageUrlBySize(svgUrl, "thumb")).toBe(svgUrl);
  });

  test("无扩展名的 URL 按 lastIndexOf '.' 处理", () => {
    const result = getImageUrlBySize("https://example.com/uploads/img", "md");
    expect(result).toContain("_md.webp");
  });

  test("多级路径的图片正确替换", () => {
    const url = "https://cdn.example.com/a/b/c/photo.jpeg";
    expect(getImageUrlBySize(url, "thumb")).toBe(
      "https://cdn.example.com/a/b/c/photo_thumb.webp",
    );
  });
});

describe("uploadImageFile", () => {
  const file = new File(["dummy"], "photo.jpg", { type: "image/jpeg" });

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
            id: "media-1",
            status: "PROCESSING",
            url: publicUrl,
          },
        },
        error: undefined,
      });

    vi.mocked(apiClient.GET).mockResolvedValueOnce({
      data: {
        code: 0,
        message: "ok",
        data: { id: "media-1", status: "COMPLETED", url: publicUrl },
      },
      error: undefined,
    } as never);

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));

    await expect(uploadImageFile(file)).resolves.toEqual({
      url: publicUrl,
      mediaId: "media-1",
    });
    expect(global.fetch).toHaveBeenCalledWith(uploadUrl, expect.objectContaining({
      method: "PUT",
      signal: expect.any(AbortSignal),
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
    vi.stubGlobal("fetch", vi.fn((_input, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
    })));

    const controller = new AbortController();
    const upload = uploadImageFile(file, { signal: controller.signal });
    await vi.waitFor(() => expect(global.fetch).toHaveBeenCalledOnce());
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
    vi.stubGlobal("fetch", vi.fn((_input, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
    })));

    await expect(uploadImageFile(file, { timeoutMs: 1 })).rejects.toThrow("图片上传超时，请检查网络后重试");
    expect(apiClient.POST).toHaveBeenCalledTimes(1);
  });
});

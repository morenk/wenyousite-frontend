/** AvatarUploader 组件测试：展示/裁剪上传/移除 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const { mockUploadImageFile, mockValidateAvatarFile } = vi.hoisted(() => ({
  mockUploadImageFile: vi.fn(),
  mockValidateAvatarFile: vi.fn(),
}));

const { mockSetAvatar, mockRemoveAvatar } = vi.hoisted(() => ({
  mockSetAvatar: { mutateAsync: vi.fn() },
  mockRemoveAvatar: { mutateAsync: vi.fn() },
}));

vi.mock("react-easy-crop", () => ({
  default: ({ onCropComplete }: { onCropComplete: (a: unknown, b: unknown) => void }) => {
    queueMicrotask(() => onCropComplete({}, { x: 0, y: 0, width: 100, height: 100 }));
    return <div data-testid="cropper" />;
  },
}));

vi.mock("@/lib/upload-image", () => ({
  uploadImageFile: mockUploadImageFile,
  validateAvatarFile: mockValidateAvatarFile,
  isUploadAbortError: (error: unknown) => error instanceof DOMException && error.name === "AbortError",
  getImageUrlBySize: (url: string, size: "md" | "thumb") =>
    size === "thumb" && !url.endsWith(".svg") ? url.replace(/\.[^.]+$/, "_thumb.webp") : url,
}));

vi.mock("@/lib/avatar-crop", () => ({
  getCroppedBlob: vi.fn(async () => new Blob(["fake-webp"])),
}));

vi.mock("@/api/hooks/use-set-avatar", () => ({
  useSetAvatar: () => ({ setAvatar: mockSetAvatar, removeAvatar: mockRemoveAvatar }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { toast } from "sonner";
import { AvatarUploader } from "@/components/user/avatar-uploader";

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  }
  Wrapper.displayName = "QueryClientWrapper";
  return Wrapper;
}

function renderUploader(props: Partial<{ username: string; avatar: string | null }> = {}) {
  return render(
    <AvatarUploader username={props.username ?? "tester"} avatar={props.avatar ?? null} />,
    { wrapper: createWrapper() },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockValidateAvatarFile.mockReturnValue(null);
  mockUploadImageFile.mockResolvedValue({ url: "https://example.com/avatar.webp", mediaId: "m1" });
  mockSetAvatar.mutateAsync.mockResolvedValue(undefined);
  mockRemoveAvatar.mutateAsync.mockResolvedValue(undefined);
  vi.stubGlobal("URL", { ...URL, createObjectURL: vi.fn(() => "blob:fake"), revokeObjectURL: vi.fn() });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("AvatarUploader", () => {
  test("无头像显示首字母占位与更换按钮，无移除按钮", () => {
    renderUploader();
    expect(screen.getByTestId("avatar-placeholder").textContent).toBe("T");
    expect(screen.getByRole("button", { name: /更换头像/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /移除头像/ })).not.toBeInTheDocument();
  });

  test("有头像显示缩略图与移除按钮", () => {
    renderUploader({ avatar: "https://example.com/uploads/avatar.png" });
    expect(screen.queryByTestId("avatar-placeholder")).not.toBeInTheDocument();
    expect(screen.getByRole("img")).toHaveAttribute(
      "src",
      "https://example.com/uploads/avatar_thumb.webp",
    );
    expect(screen.getByRole("button", { name: /移除头像/ })).toBeInTheDocument();
  });

  test("选择文件后裁剪确认触发上传并设置头像", async () => {
    renderUploader();
    const file = new File(["x"], "photo.png", { type: "image/png" });
    fireEvent.change(screen.getByTestId("avatar-file-input"), { target: { files: [file] } });

    await waitFor(() => expect(screen.getByRole("dialog", { name: "裁剪头像" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "保存头像" }));

    await waitFor(() => {
      expect(mockUploadImageFile).toHaveBeenCalled();
    });
    const uploaded = mockUploadImageFile.mock.calls[0][0] as File;
    expect(uploaded.type).toBe("image/webp");
    expect(uploaded.name).toBe("avatar.webp");

    await waitFor(() => {
      expect(mockSetAvatar.mutateAsync).toHaveBeenCalledWith("m1");
    });
    expect(toast.success).toHaveBeenCalledWith("头像已更新");
  });

  test("头像直传期间展示上传百分比", async () => {
    let resolveUpload!: (value: { url: string; mediaId: string }) => void;
    mockUploadImageFile.mockImplementationOnce((_file: File, options: {
      onProgress?: (progress: Record<string, unknown>) => void;
    }) => {
      options.onProgress?.({
        stage: "uploading",
        loadedBytes: 1 * 1024 * 1024,
        totalBytes: 4 * 1024 * 1024,
        percent: 25,
      });
      return new Promise((resolve) => { resolveUpload = resolve; });
    });
    renderUploader();
    fireEvent.change(screen.getByTestId("avatar-file-input"), {
      target: { files: [new File(["x"], "photo.png", { type: "image/png" })] },
    });
    await waitFor(() => expect(screen.getByRole("dialog", { name: "裁剪头像" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "保存头像" }));

    expect(await screen.findByText("25%")).toBeInTheDocument();
    resolveUpload({ url: "https://example.com/avatar.webp", mediaId: "m1" });
    await waitFor(() => expect(mockSetAvatar.mutateAsync).toHaveBeenCalledWith("m1"));
  });

  test("非法文件直接提示错误，不打开裁剪", () => {
    mockValidateAvatarFile.mockReturnValue("头像仅支持 jpg/png/webp 格式");
    renderUploader();
    const file = new File(["<svg/>"], "icon.svg", { type: "image/svg+xml" });
    fireEvent.change(screen.getByTestId("avatar-file-input"), { target: { files: [file] } });
    expect(toast.error).toHaveBeenCalledWith("头像仅支持 jpg/png/webp 格式");
    expect(screen.queryByText("裁剪头像")).not.toBeInTheDocument();
  });

  test("点击移除头像触发移除并提示", async () => {
    renderUploader({ avatar: "https://example.com/uploads/avatar.png" });
    fireEvent.click(screen.getByRole("button", { name: /移除头像/ }));
    await waitFor(() => {
      expect(mockRemoveAvatar.mutateAsync).toHaveBeenCalled();
    });
    expect(toast.success).toHaveBeenCalledWith("头像已移除");
  });
});

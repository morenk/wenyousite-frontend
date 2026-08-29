/** AvatarUploader 组件测试：展示/裁剪上传/移除 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const { mockUploadImageFile, mockValidateAvatarFile, mockGetCroppedBlob } = vi.hoisted(() => ({
  mockUploadImageFile: vi.fn(),
  mockValidateAvatarFile: vi.fn(),
  mockGetCroppedBlob: vi.fn(),
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
}));

vi.mock("@/lib/avatar-crop", () => ({
  getCroppedBlob: mockGetCroppedBlob,
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
  mockGetCroppedBlob.mockResolvedValue(new Blob(["fake-webp"], { type: "image/webp" }));
  mockUploadImageFile.mockResolvedValue({ url: "https://example.com/avatar.webp", mediaId: "m1" });
  mockSetAvatar.mutateAsync.mockResolvedValue(undefined);
  mockRemoveAvatar.mutateAsync.mockResolvedValue(undefined);
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:fake");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("AvatarUploader", () => {
  test("无头像显示首字母占位与更换按钮，无移除按钮", () => {
    renderUploader();
    expect(screen.getByTestId("user-avatar-placeholder").textContent).toBe("T");
    expect(screen.getByRole("button", { name: /更换头像/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /移除头像/ })).not.toBeInTheDocument();
  });

  test("有头像显示母版与移除按钮", () => {
    renderUploader({ avatar: "https://example.com/uploads/avatar.png" });
    expect(screen.queryByTestId("user-avatar-placeholder")).not.toBeInTheDocument();
    expect(screen.getByRole("img")).toHaveAttribute(
      "src",
      "https://example.com/uploads/avatar.png",
    );
    expect(screen.getByRole("button", { name: /移除头像/ })).toBeInTheDocument();
  });

  test("头像加载失败时复用统一首字符占位", () => {
    renderUploader({ username: "茶馆", avatar: "https://example.com/uploads/broken.png" });
    fireEvent.error(screen.getByRole("img", { name: "茶馆" }));
    expect(screen.getByTestId("user-avatar-placeholder")).toHaveTextContent("茶");
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

  test("Safari 裁剪回退为 PNG 时按真实格式上传", async () => {
    mockGetCroppedBlob.mockResolvedValueOnce(
      new Blob(["png-fallback"], { type: "image/png" }),
    );
    renderUploader();
    fireEvent.change(screen.getByTestId("avatar-file-input"), {
      target: { files: [new File(["x"], "photo.jpg", { type: "image/jpeg" })] },
    });
    await waitFor(() =>
      expect(screen.getByRole("dialog", { name: "裁剪头像" })).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("button", { name: "保存头像" }));

    await waitFor(() => expect(mockUploadImageFile).toHaveBeenCalledOnce());
    const uploaded = mockUploadImageFile.mock.calls[0][0] as File;
    expect(uploaded.name).toBe("avatar.png");
    expect(uploaded.type).toBe("image/png");
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

  test("头像绑定失败后重试复用已上传 mediaId", async () => {
    mockSetAvatar.mutateAsync
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(undefined);
    renderUploader();
    fireEvent.change(screen.getByTestId("avatar-file-input"), {
      target: { files: [new File(["x"], "photo.png", { type: "image/png" })] },
    });
    await waitFor(() => expect(screen.getByRole("dialog", { name: "裁剪头像" })).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "保存头像" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "保存头像" }));

    await waitFor(() => expect(mockSetAvatar.mutateAsync).toHaveBeenCalledTimes(2));
    expect(mockUploadImageFile).toHaveBeenCalledTimes(1);
    expect(mockSetAvatar.mutateAsync).toHaveBeenLastCalledWith("m1");
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

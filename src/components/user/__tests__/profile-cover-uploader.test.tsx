/** ProfileCoverUploader 组件测试：双画幅预览、裁切上传、重试与原子绑定。 */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const { mockUploadImageFile, mockValidateProfileCoverFile } = vi.hoisted(() => ({
  mockUploadImageFile: vi.fn(),
  mockValidateProfileCoverFile: vi.fn(),
}));

const { mockSetProfileCover, mockRemoveProfileCover } = vi.hoisted(() => ({
  mockSetProfileCover: { mutateAsync: vi.fn(), isPending: false },
  mockRemoveProfileCover: { mutateAsync: vi.fn(), isPending: false },
}));

const { mockGetCroppedProfileCoverBlob } = vi.hoisted(() => ({
  mockGetCroppedProfileCoverBlob: vi.fn(),
}));

vi.mock("react-easy-crop", () => ({
  default: ({ onCropComplete }: { onCropComplete: (a: unknown, b: unknown) => void }) => {
    queueMicrotask(() => onCropComplete({}, { x: 0, y: 0, width: 100, height: 100 }));
    return <div data-testid="profile-cover-cropper" />;
  },
}));

vi.mock("@/lib/upload-image", () => ({
  uploadImageFile: mockUploadImageFile,
  validateProfileCoverFile: mockValidateProfileCoverFile,
  isUploadAbortError: (error: unknown) =>
    error instanceof DOMException && error.name === "AbortError",
}));

vi.mock("@/lib/profile-cover-crop", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/profile-cover-crop")>();
  return {
    ...original,
    getCroppedProfileCoverBlob: mockGetCroppedProfileCoverBlob,
  };
});

vi.mock("@/api/hooks/use-set-profile-cover", () => ({
  useSetProfileCover: () => ({
    setProfileCover: mockSetProfileCover,
    removeProfileCover: mockRemoveProfileCover,
  }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { toast } from "sonner";
import { ProfileCoverUploader } from "@/components/user/profile-cover-uploader";

const legacyCover = {
  url: "https://example.com/profile-cover.webp",
  mediumUrl: "https://example.com/profile-cover_md.webp",
  width: 1920,
  height: 640,
  mobile: null,
};

function renderUploader(profileCover = null as typeof legacyCover | null) {
  return render(
    <ProfileCoverUploader username="tester" avatar={null} profileCover={profileCover} />,
  );
}

async function openCropDialog() {
  const file = new File(["x"], "scene.png", { type: "image/png" });
  fireEvent.change(screen.getByTestId("profile-cover-file-input"), {
    target: { files: [file] },
  });
  await waitFor(() =>
    expect(
      screen.getByRole("dialog", { name: "调整主页背景" }),
    ).toBeInTheDocument(),
  );
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "保存背景" })).toBeEnabled(),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUploadImageFile.mockReset();
  mockValidateProfileCoverFile.mockReturnValue(null);
  mockGetCroppedProfileCoverBlob.mockResolvedValue(new Blob(["fake-webp"]));
  mockUploadImageFile
    .mockResolvedValueOnce({ url: "https://example.com/web.webp", mediaId: "web-media" })
    .mockResolvedValueOnce({ url: "https://example.com/mobile.webp", mediaId: "mobile-media" });
  mockSetProfileCover.mutateAsync.mockResolvedValue(undefined);
  mockRemoveProfileCover.mutateAsync.mockResolvedValue(undefined);
  vi.stubGlobal("URL", {
    ...URL,
    createObjectURL: vi.fn(() => "blob:profile-cover"),
    revokeObjectURL: vi.fn(),
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ProfileCoverUploader", () => {
  test("同时展示 Web 3:1 与移动端 2:1 预览，旧数据明确使用 Web 兜底", () => {
    renderUploader(legacyCover);

    expect(screen.getByText("电脑端 · 3:1")).toBeInTheDocument();
    expect(screen.getByText("移动端 · 2:1")).toBeInTheDocument();
    expect(screen.getByText("沿用电脑端背景")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "tester 的移动端主页背景" })).toHaveAttribute(
      "src",
      legacyCover.url,
    );
  });

  test("从同一原图生成并上传两个规格，再一次性绑定两个 mediaId", async () => {
    renderUploader();
    await openCropDialog();

    expect(screen.getAllByTestId("profile-cover-cropper")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "保存背景" }));

    await waitFor(() => expect(mockUploadImageFile).toHaveBeenCalledTimes(2));
    const webFile = mockUploadImageFile.mock.calls[0][0] as File;
    const mobileFile = mockUploadImageFile.mock.calls[1][0] as File;
    expect(webFile.name).toBe("profile-cover-web.webp");
    expect(mobileFile.name).toBe("profile-cover-mobile.webp");
    expect(webFile.type).toBe("image/webp");
    expect(mobileFile.type).toBe("image/webp");
    expect(mockGetCroppedProfileCoverBlob).toHaveBeenNthCalledWith(
      1,
      "blob:profile-cover",
      expect.any(Object),
      "web",
    );
    expect(mockGetCroppedProfileCoverBlob).toHaveBeenNthCalledWith(
      2,
      "blob:profile-cover",
      expect.any(Object),
      "mobile",
    );

    await waitFor(() =>
      expect(mockSetProfileCover.mutateAsync).toHaveBeenCalledWith({
        mediaId: "web-media",
        mobileMediaId: "mobile-media",
      }),
    );
    expect(toast.success).toHaveBeenCalledWith("主页背景已更新");
  });

  test("第二张上传失败后重试会复用已上传的 Web mediaId", async () => {
    mockUploadImageFile.mockReset();
    mockUploadImageFile
      .mockResolvedValueOnce({ url: "https://example.com/web.webp", mediaId: "web-media" })
      .mockRejectedValueOnce(new Error("mobile upload failed"))
      .mockResolvedValueOnce({ url: "https://example.com/mobile.webp", mediaId: "mobile-media" });
    renderUploader();
    await openCropDialog();

    fireEvent.click(screen.getByRole("button", { name: "保存背景" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "保存背景" }));

    await waitFor(() => expect(mockUploadImageFile).toHaveBeenCalledTimes(3));
    await waitFor(() =>
      expect(mockSetProfileCover.mutateAsync).toHaveBeenCalledWith({
        mediaId: "web-media",
        mobileMediaId: "mobile-media",
      }),
    );
  });

  test("移除操作会清除两端背景", async () => {
    renderUploader(legacyCover);
    fireEvent.click(screen.getByRole("button", { name: "移除背景" }));

    await waitFor(() => expect(mockRemoveProfileCover.mutateAsync).toHaveBeenCalledOnce());
    expect(toast.success).toHaveBeenCalledWith("主页背景已移除");
  });
});

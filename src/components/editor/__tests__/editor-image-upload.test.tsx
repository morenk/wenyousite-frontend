import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterAll, afterEach, expect, test, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { UploadImageOptions } from "@/lib/upload-image";
import { MilkdownEditor } from "../milkdown-editor-core";

vi.mock("@/lib/auth", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("@/api/hooks/use-save-draft", () => ({ useSaveDraft: () => ({ mutateAsync: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
afterAll(async () => { await new Promise((resolve) => setTimeout(resolve, 3100)); });

test("替换上传忽略旧进度与完成，取消后迟到图片不插入编辑器", async () => {
  const requests: Array<{ options: UploadImageOptions; finish: (url: string) => void }> = [];
  const upload = vi.fn((_file: File, options?: UploadImageOptions) => new Promise<string>((finish) => {
    requests.push({ options: options!, finish });
  }));
  vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(function (this: HTMLInputElement) {
    Object.defineProperty(this, "files", { value: [new File(["image"], "image.png", { type: "image/png" })] });
    fireEvent.change(this);
  });
  const { container } = render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MilkdownEditor onUploadImage={upload} /></QueryClientProvider>);
  const imageButton = await waitFor(() => {
    const button = container.querySelector<HTMLElement>('.milkdown-top-bar .top-bar-item[title="图片"]');
    expect(button).not.toBeNull();
    return button!;
  });
  fireEvent.pointerDown(imageButton);
  await waitFor(() => expect(requests).toHaveLength(1));
  fireEvent.pointerDown(imageButton);
  await waitFor(() => expect(requests).toHaveLength(2));
  expect(requests[0].options.signal?.aborted).toBe(true);
  act(() => {
    requests[1].options.onProgress!({ stage: "uploading", loadedBytes: 25, totalBytes: 100, percent: 25 });
    requests[0].options.onProgress!({ stage: "uploading", loadedBytes: 90, totalBytes: 100, percent: 90 });
  });
  expect(screen.getByText("25%")).toBeInTheDocument();
  expect(screen.queryByText("90%")).not.toBeInTheDocument();
  await act(async () => {
    requests[0].options.onCompleted!({ url: "https://example.test/current.png", display: { url: "https://example.test/stale-display.webp", contentType: "image/webp", width: 1, height: 1, bytes: 10, animated: false, frameCount: 1, durationMs: 0, loopCount: 0 }, mediaId: "old", thumbnailUrl: null, feedUrl: null, mediumUrl: null, width: 1, height: 1, contentType: "image/png", animated: false });
    requests[0].finish("https://example.test/old.png");
  });
  expect(container.querySelector(".ProseMirror img")).toBeNull();
  expect(screen.getByText("25%")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "取消" }));
  await act(async () => requests[1].finish("https://example.test/cancelled.png"));
  expect(container.querySelector(".ProseMirror img")).toBeNull();
  expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  fireEvent.pointerDown(imageButton);
  await waitFor(() => expect(requests).toHaveLength(3));
  await act(async () => requests[2].finish("https://example.test/current.png"));
  await waitFor(() => expect(container.querySelector('.ProseMirror img[src="https://example.test/current.png"]')).not.toBeNull());
  expect(container.querySelector('.ProseMirror img[src="https://example.test/stale-display.webp"]')).toBeNull();
});

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ImageLightbox } from "@/components/shared/image-lightbox";

const close = vi.fn();

function renderLightbox() {
  render(<ImageLightbox src="https://example.com/original.jpg" alt="测试原图" onClose={close} />);
  const image = screen.getByRole("img", { name: "测试原图" }) as HTMLImageElement;
  Object.defineProperty(image, "naturalWidth", { value: 2000, configurable: true });
  Object.defineProperty(image, "naturalHeight", { value: 4000, configurable: true });
  fireEvent.load(image);
  return image;
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ImageLightbox", () => {
  it("以自然尺寸为基准适应屏幕并切换 1:1", async () => {
    const user = userEvent.setup();
    const image = renderLightbox();
    expect(await screen.findByText("19%")).toBeInTheDocument();
    expect(image).toHaveStyle({ width: "2000px", height: "4000px", maxWidth: "none" });

    await user.click(image);
    expect(screen.getByRole("button", { name: "切换 1:1 显示" })).toHaveTextContent("100%");
    await user.click(screen.getByRole("button", { name: "适应屏幕" }));
    expect(screen.getByRole("button", { name: "切换 1:1 显示" })).toHaveTextContent("19%");
  });

  it("支持按钮、滚轮缩放和放大后拖拽", async () => {
    const user = userEvent.setup();
    const image = renderLightbox();
    const dialog = screen.getByRole("dialog");
    await screen.findByText("19%");
    fireEvent.wheel(dialog, { deltaY: -100, clientX: 0, clientY: 0 });
    expect(screen.getByRole("button", { name: "切换 1:1 显示" })).toHaveTextContent("24%");
    await user.click(screen.getByRole("button", { name: "适应屏幕" }));
    await user.click(screen.getByRole("button", { name: "1:1 原图" }));
    fireEvent.pointerDown(image, { clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(image, { clientX: 40, clientY: 30, pointerId: 1 });
    fireEvent.pointerUp(image, { clientX: 40, clientY: 30, pointerId: 1 });
    expect(image.getAttribute("style")).toContain("translate(30px, 20px)");
    await user.click(screen.getByRole("button", { name: "缩小" }));
    await user.click(screen.getByRole("button", { name: "放大" }));
  });

  it("支持遮罩、关闭按钮和 Escape 关闭", async () => {
    const user = userEvent.setup();
    renderLightbox();
    await user.click(screen.getByRole("button", { name: "关闭" }));
    await user.keyboard("{Escape}");
    fireEvent.click(screen.getByRole("dialog"));
    expect(close).toHaveBeenCalledTimes(3);
  });
});

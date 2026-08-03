/** ImageLightbox 组件测试：缩放/1:1/平移/关闭交互 */

import { describe, test, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ImageLightbox } from "@/components/thread/image-lightbox";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const URL = "https://cos.example.com/wenyou/uploads/2026/01/01/u1/123-abc.jpg";
const ALT = "测试原图";
const CLOSE = vi.fn();
const PERCENT = () => screen.getByRole("button", { name: "切换 1:1 显示" }).textContent;

function renderLightbox() {
  return render(<ImageLightbox src={URL} alt={ALT} onClose={CLOSE} />);
}

/** 模拟图片加载后的自然尺寸，触发 onLoad */
function loadWithNaturalSize(w: number, h: number) {
  const img = screen.getByRole("img", { name: ALT }) as HTMLImageElement;
  Object.defineProperty(img, "naturalWidth", { value: w, configurable: true });
  Object.defineProperty(img, "naturalHeight", { value: h, configurable: true });
  fireEvent.load(img);
}

describe("ImageLightbox", () => {
  test("渲染原图与工具条", () => {
    renderLightbox();
    expect(screen.getByRole("dialog", { name: "查看原图" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: ALT })).toHaveAttribute("src", URL);
    expect(screen.getByRole("button", { name: "关闭" })).toBeInTheDocument();
  });

  test("点击遮罩关闭", async () => {
    const user = userEvent.setup();
    renderLightbox();
    await user.click(screen.getByRole("dialog"));
    expect(CLOSE).toHaveBeenCalledTimes(1);
  });

  test("按 Esc 关闭", async () => {
    const user = userEvent.setup();
    renderLightbox();
    await user.keyboard("{Escape}");
    expect(CLOSE).toHaveBeenCalledTimes(1);
  });

  test("点击关闭按钮关闭", async () => {
    const user = userEvent.setup();
    renderLightbox();
    await user.click(screen.getByRole("button", { name: "关闭" }));
    expect(CLOSE).toHaveBeenCalledTimes(1);
  });

  test("加载后默认适应屏幕", async () => {
    renderLightbox();
    loadWithNaturalSize(2000, 4000);
    expect(await screen.findByText("19%")).toBeInTheDocument();
  });

  test("单击图片在适应屏幕与 1:1 之间切换", async () => {
    const user = userEvent.setup();
    renderLightbox();
    loadWithNaturalSize(2000, 4000);
    await screen.findByText("19%");

    await user.click(screen.getByRole("img", { name: ALT }));
    expect(PERCENT()).toBe("100%");
    expect(CLOSE).not.toHaveBeenCalled();

    await user.click(screen.getByRole("img", { name: ALT }));
    expect(PERCENT()).toBe("19%");
    expect(CLOSE).not.toHaveBeenCalled();
  });

  test("使用原图自然尺寸作为缩放基准，避免被全局 max-width 重复缩小", async () => {
    renderLightbox();
    loadWithNaturalSize(2000, 4000);
    const img = screen.getByRole("img", { name: ALT });
    await screen.findByText("19%");

    expect(img).toHaveStyle({
      width: "2000px",
      height: "4000px",
      maxWidth: "none",
      maxHeight: "none",
      flexShrink: "0",
    });
  });

  test("滚轮向上放大、向下缩小，且不低于适应屏幕", async () => {
    renderLightbox();
    loadWithNaturalSize(2000, 4000);
    const container = screen.getByRole("dialog");
    await screen.findByText("19%");

    fireEvent.wheel(container, { deltaY: -100 });
    expect(PERCENT()).toBe("24%");

    fireEvent.wheel(container, { deltaY: 100 });
    expect(PERCENT()).toBe("19%");

    // 继续缩小不会低于适应屏幕
    fireEvent.wheel(container, { deltaY: 100 });
    expect(PERCENT()).toBe("19%");
  });

  test("放大/缩小按钮与 1:1、适应屏幕按钮", async () => {
    const user = userEvent.setup();
    renderLightbox();
    loadWithNaturalSize(2000, 4000);
    await screen.findByText("19%");

    await user.click(screen.getByRole("button", { name: "放大" }));
    expect(PERCENT()).toBe("24%");

    await user.click(screen.getByRole("button", { name: "缩小" }));
    expect(PERCENT()).toBe("19%");

    await user.click(screen.getByRole("button", { name: "1:1 原图" }));
    expect(PERCENT()).toBe("100%");

    await user.click(screen.getByRole("button", { name: "适应屏幕" }));
    expect(PERCENT()).toBe("19%");
  });

  test("放大后拖拽平移更新 transform", async () => {
    const user = userEvent.setup();
    renderLightbox();
    loadWithNaturalSize(2000, 4000);
    await screen.findByText("19%");
    await user.click(screen.getByRole("button", { name: "1:1 原图" }));
    expect(PERCENT()).toBe("100%");

    const img = screen.getByRole("img", { name: ALT });
    fireEvent.pointerDown(img, { clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(img, { clientX: 40, clientY: 30, pointerId: 1 });
    fireEvent.pointerUp(img, { clientX: 40, clientY: 30, pointerId: 1 });
    expect(img.getAttribute("style")).toContain("translate(30px, 20px)");
  });

  test("未放大时拖拽不产生平移", async () => {
    renderLightbox();
    loadWithNaturalSize(2000, 4000);
    const img = screen.getByRole("img", { name: ALT });
    await screen.findByText("19%");

    fireEvent.pointerDown(img, { clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(img, { clientX: 40, clientY: 30, pointerId: 1 });
    fireEvent.pointerUp(img, { clientX: 40, clientY: 30, pointerId: 1 });
    expect(img.getAttribute("style")).toContain("translate(0px, 0px)");
  });

  test("小图不超过 1:1（不放大）", async () => {
    const user = userEvent.setup();
    renderLightbox();
    loadWithNaturalSize(300, 200);
    const img = screen.getByRole("img", { name: ALT });
    await screen.findByText("100%");

    await user.click(img);
    expect(PERCENT()).toBe("100%");
    await user.click(screen.getByRole("button", { name: "放大" }));
    expect(PERCENT()).toBe("100%");
  });

  test("未加载完成（自然尺寸未知）时显示安全", async () => {
    renderLightbox();
    expect(screen.getByRole("img", { name: ALT })).toHaveAttribute("src", URL);
    expect(PERCENT()).toBe("100%");
  });
});

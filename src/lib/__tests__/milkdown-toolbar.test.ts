import { describe, expect, test, vi } from "vitest";
import {
  positionMilkdownHeadingDropdowns,
  revealFocusedMilkdownToolbarItem,
  syncMilkdownToolbarSemantics,
  syncMilkdownToolbarVisibility,
} from "@/lib/milkdown-toolbar";

function rect({
  left,
  right,
  top = 0,
  bottom = 0,
}: {
  left: number;
  right: number;
  top?: number;
  bottom?: number;
}): DOMRect {
  return {
    x: left,
    y: top,
    left,
    right,
    top,
    bottom,
    width: right - left,
    height: bottom - top,
    toJSON: () => ({}),
  };
}

describe("syncMilkdownToolbarVisibility", () => {
  test("上传结束恢复可编辑后清除 Crepe 遗留的隐藏样式", () => {
    const root = document.createElement("div");
    root.innerHTML = '<div class="milkdown-top-bar" style="display: none"></div>';

    syncMilkdownToolbarVisibility(root, false);

    expect(root.querySelector<HTMLElement>(".milkdown-top-bar")?.style.display).toBe("");
  });

  test("只影响当前编辑器宿主内的顶栏", () => {
    const first = document.createElement("div");
    const second = document.createElement("div");
    first.innerHTML = '<div class="milkdown-top-bar"></div>';
    second.innerHTML = '<div class="milkdown-top-bar"></div>';

    syncMilkdownToolbarVisibility(first, true);

    expect(first.querySelector<HTMLElement>(".milkdown-top-bar")?.style.display).toBe("none");
    expect(second.querySelector<HTMLElement>(".milkdown-top-bar")?.style.display).toBe("");
  });

  test("补齐水平格式工具栏语义", () => {
    const root = document.createElement("div");
    root.innerHTML = '<div class="milkdown-top-bar"></div>';

    syncMilkdownToolbarSemantics(root);

    const toolbar = root.querySelector(".milkdown-top-bar");
    expect(toolbar).toHaveAttribute("role", "toolbar");
    expect(toolbar).toHaveAttribute("aria-label", "正文格式工具栏");
    expect(toolbar).toHaveAttribute("aria-orientation", "horizontal");
  });

  test("键盘焦点移到右侧屏外按钮时只推进工具栏横向位置", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <div class="milkdown-top-bar">
        <button class="top-bar-item"></button>
      </div>
    `;
    const toolbar = root.querySelector<HTMLElement>(".milkdown-top-bar")!;
    const button = root.querySelector<HTMLElement>(".top-bar-item")!;
    toolbar.scrollLeft = 100;
    vi.spyOn(toolbar, "getBoundingClientRect").mockReturnValue(rect({ left: 100, right: 300 }));
    vi.spyOn(button, "getBoundingClientRect").mockReturnValue(rect({ left: 290, right: 330 }));

    revealFocusedMilkdownToolbarItem(button);

    expect(toolbar.scrollLeft).toBe(138);
  });

  test("标题菜单在视口内靠近触发按钮定位，空间不足时翻到上方", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <div class="top-bar-heading-selector">
        <button class="top-bar-heading-button"></button>
        <div class="top-bar-heading-dropdown"></div>
      </div>
    `;
    const trigger = root.querySelector<HTMLElement>(".top-bar-heading-button")!;
    const dropdown = root.querySelector<HTMLElement>(".top-bar-heading-dropdown")!;
    vi.spyOn(trigger, "getBoundingClientRect").mockReturnValue(
      rect({ left: 280, right: 312, top: 170, bottom: 202 }),
    );
    vi.spyOn(dropdown, "getBoundingClientRect").mockReturnValue(
      rect({ left: 0, right: 120, top: 0, bottom: 100 }),
    );

    positionMilkdownHeadingDropdowns(root, { width: 320, height: 240 });

    expect(dropdown.dataset.editorFloating).toBe("true");
    expect(dropdown.style.left).toBe("192px");
    expect(dropdown.style.top).toBe("64px");
  });
});

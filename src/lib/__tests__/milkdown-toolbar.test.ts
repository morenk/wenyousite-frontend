import { describe, expect, test, vi } from "vitest";
import {
  applyMilkdownToolbarDensity,
  fitMilkdownToolbar,
  getMilkdownMoreCapabilities,
  positionMilkdownHeadingDropdowns,
  syncMilkdownHeadingOptions,
  syncMilkdownMoreMenuState,
  syncMilkdownToolbarItems,
  syncMilkdownToolbarSemantics,
  syncMilkdownToolbarVisibility,
} from "@/lib/milkdown-toolbar";
import {
  EDITOR_CAPABILITY_LABELS,
  EDITOR_CONTENT_POLICY,
  EDITOR_DENSITY_ORDER,
  EDITOR_MORE_FALLBACK,
  EDITOR_MORE_BY_DENSITY,
  EDITOR_PRIMARY_BY_DENSITY,
  EDITOR_PRIMARY_NARROW,
  EDITOR_PRIMARY_WIDE,
  EDITOR_WEB_CAPABILITIES,
  EDITOR_WEB_LAYOUT,
  editorCapabilityLabels,
} from "@/lib/editor-capabilities";

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
    root.innerHTML =
      '<div class="milkdown-top-bar" style="display: none"></div>';

    syncMilkdownToolbarVisibility(root, false);

    expect(
      root.querySelector<HTMLElement>(".milkdown-top-bar")?.style.display,
    ).toBe("");
  });

  test("只影响当前编辑器宿主内的顶栏", () => {
    const first = document.createElement("div");
    const second = document.createElement("div");
    first.innerHTML = '<div class="milkdown-top-bar"></div>';
    second.innerHTML = '<div class="milkdown-top-bar"></div>';

    syncMilkdownToolbarVisibility(first, true);

    expect(
      first.querySelector<HTMLElement>(".milkdown-top-bar")?.style.display,
    ).toBe("none");
    expect(
      second.querySelector<HTMLElement>(".milkdown-top-bar")?.style.display,
    ).toBe("");
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

  test("为第三方按钮补齐稳定能力 ID 与无障碍名称", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <div class="milkdown-top-bar">
        <button class="top-bar-heading-button"></button>
        <button class="top-bar-item"></button>
        <button class="top-bar-item"></button>
      </div>
    `;

    syncMilkdownToolbarItems(root, [
      { key: "bold", label: "粗体" },
      { key: "more", label: "更多" },
    ]);

    expect(
      root.querySelector('[data-editor-tool="heading"]'),
    ).toHaveAccessibleName("切换正文样式");
    expect(
      root.querySelector('[data-editor-tool="bold"]'),
    ).toHaveAccessibleName("粗体");
    expect(
      root.querySelector('[data-editor-tool="more"]'),
    ).toHaveAccessibleName("更多");
  });

  test("窄容器依次收纳草稿与删除线，不启用横向滚动", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <div class="milkdown-top-bar">
        <div class="top-bar-inner"></div>
      </div>
    `;
    const toolbar = root.querySelector<HTMLElement>(".milkdown-top-bar")!;
    Object.defineProperty(toolbar, "clientWidth", {
      configurable: true,
      value: 320,
    });
    Object.defineProperty(toolbar, "scrollWidth", {
      configurable: true,
      get: () =>
        toolbar.dataset.editorDensity === "expanded"
          ? 800
          : toolbar.dataset.editorDensity === "with-more"
            ? 360
            : toolbar.dataset.editorDensity === "without-draft"
              ? 330
              : 300,
    });

    expect(fitMilkdownToolbar(toolbar)).toBe("compact");
    expect(toolbar.dataset.editorDensity).toBe("compact");
  });

  test("中等宽度只收纳草稿", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <div class="milkdown-top-bar">
        <div class="top-bar-inner"></div>
      </div>
    `;
    const toolbar = root.querySelector<HTMLElement>(".milkdown-top-bar")!;
    Object.defineProperty(toolbar, "clientWidth", {
      configurable: true,
      value: 340,
    });
    Object.defineProperty(toolbar, "scrollWidth", {
      configurable: true,
      get: () =>
        toolbar.dataset.editorDensity === "expanded"
          ? 800
          : toolbar.dataset.editorDensity === "with-more"
            ? 360
            : 330,
    });

    expect(fitMilkdownToolbar(toolbar)).toBe("without-draft");
  });

  test("宽栏平铺全部常用能力，窄栏才使用更多", () => {
    expect(editorCapabilityLabels(EDITOR_PRIMARY_NARROW)).toEqual([
      "正文样式",
      "粗体",
      "斜体",
      "图片",
      "更多",
    ]);
    expect(EDITOR_PRIMARY_WIDE).not.toContain("more");
    for (const capability of EDITOR_MORE_FALLBACK) {
      expect(EDITOR_PRIMARY_WIDE).toContain(capability);
    }
    for (const capability of ["task-list", "code-block", "table"]) {
      expect(EDITOR_CAPABILITY_LABELS).not.toHaveProperty(capability);
      expect(EDITOR_PRIMARY_WIDE).not.toContain(capability);
    }
    expect(EDITOR_CAPABILITY_LABELS.more).toBe("更多");
  });

  test("四档收纳、正文测量与能力生命周期直接来自 Foundation", () => {
    expect(EDITOR_DENSITY_ORDER).toEqual([
      "expanded",
      "with-more",
      "without-draft",
      "compact",
    ]);
    expect(EDITOR_PRIMARY_BY_DENSITY.compact).toEqual(EDITOR_PRIMARY_NARROW);
    expect(EDITOR_MORE_BY_DENSITY["with-more"]).toEqual([
      "inline-code",
      "bullet-list",
      "ordered-list",
      "alignment",
    ]);
    expect(EDITOR_WEB_LAYOUT).toMatchObject({
      frameMaxRem: 50,
      textMeasurePx: 680,
      contentInlinePaddingPx: 24,
      toolbarInlinePaddingPx: 12,
      firstControlInternalInsetPx: 12,
    });
    expect(EDITOR_WEB_CAPABILITIES.mention.roundTrip).toBe(
      "identity-preserving",
    );
    expect(EDITOR_CONTENT_POLICY).toMatchObject({
      markdownContractVersion: 4,
      structuredCapabilitySource: "toolbar",
      unsupportedClientBehavior: "literal-text-silent",
      maximumListDepth: 3,
    });
  });

  test("展开态隐藏更多，标准栏保留链接、引用、分隔线和骰子直达", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <div class="milkdown-top-bar">
        <div class="top-bar-inner">
          <div data-editor-tool="heading"></div>
          <div class="top-bar-divider"></div>
          <button data-editor-tool="bold"></button>
          <button data-editor-tool="inline-code"></button>
          <div class="top-bar-divider"></div>
          <button data-editor-tool="bullet-list"></button>
          <button data-editor-tool="ordered-list"></button>
          <div class="top-bar-divider"></div>
          <button data-editor-tool="link"></button>
          <button data-editor-tool="image"></button>
          <div class="top-bar-divider"></div>
          <button data-editor-tool="quote"></button>
          <button data-editor-tool="hr"></button>
          <div class="top-bar-divider"></div>
          <button data-editor-tool="dice"></button>
          <div class="top-bar-divider"></div>
          <button data-editor-tool="draft"></button>
          <div class="top-bar-divider"></div>
          <button data-editor-tool="more"></button>
        </div>
      </div>
    `;
    const toolbar = root.querySelector<HTMLElement>(".milkdown-top-bar")!;

    applyMilkdownToolbarDensity(toolbar, "expanded");
    expect(
      root.querySelector<HTMLElement>('[data-editor-tool="inline-code"]'),
    ).not.toHaveAttribute("hidden");
    expect(
      root.querySelector<HTMLElement>('[data-editor-tool="more"]'),
    ).toHaveAttribute("hidden");

    applyMilkdownToolbarDensity(toolbar, "with-more");
    expect(
      root.querySelector<HTMLElement>('[data-editor-tool="inline-code"]'),
    ).toHaveAttribute("hidden");
    expect(
      root.querySelector<HTMLElement>('[data-editor-tool="bullet-list"]'),
    ).toHaveAttribute("hidden");
    for (const tool of ["link", "quote", "hr", "dice"]) {
      expect(
        root.querySelector<HTMLElement>(`[data-editor-tool="${tool}"]`),
      ).not.toHaveAttribute("hidden");
    }
    expect(
      root.querySelector<HTMLElement>('[data-editor-tool="more"]'),
    ).not.toHaveAttribute("hidden");
    expect(
      root.querySelector<HTMLElement>('[data-editor-tool="draft"]'),
    ).not.toHaveAttribute("hidden");
    expect(root.querySelectorAll(".top-bar-divider[hidden]")).toHaveLength(1);
  });

  test("更多菜单按工具栏密度只返回当前隐藏能力", () => {
    expect(getMilkdownMoreCapabilities("with-more", true)).toEqual([
      "inline-code",
      "bullet-list",
      "ordered-list",
      "alignment",
    ]);
    expect(getMilkdownMoreCapabilities("without-draft", true)).toEqual([
      "inline-code",
      "bullet-list",
      "ordered-list",
      "alignment",
      "draft",
    ]);
    expect(getMilkdownMoreCapabilities("compact", true)).toEqual([
      "strikethrough",
      ...EDITOR_MORE_FALLBACK,
      "draft",
    ]);
  });

  test("标题菜单只开放正文、二级和三级标题，仍可显示其他历史层级", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <button class="top-bar-heading-option">正文</button>
      <button class="top-bar-heading-option">标题 1</button>
      <button class="top-bar-heading-option">标题 2</button>
      <button class="top-bar-heading-option">标题 3</button>
      <button class="top-bar-heading-option">标题 4</button>
    `;

    syncMilkdownHeadingOptions(root, new Set(["正文", "标题 2", "标题 3"]));

    const options = root.querySelectorAll<HTMLButtonElement>(
      ".top-bar-heading-option",
    );
    expect(options[0]).not.toHaveAttribute("hidden");
    expect(options[1]).toHaveAttribute("hidden");
    expect(options[2]).not.toHaveAttribute("hidden");
    expect(options[3]).not.toHaveAttribute("hidden");
    expect(options[4]).toHaveAttribute("hidden");
  });

  test("更多按钮同步弹出菜单状态", () => {
    const root = document.createElement("div");
    root.innerHTML = '<button data-editor-tool="more"></button>';

    syncMilkdownMoreMenuState(root, true);

    expect(root.querySelector("button")).toHaveAttribute(
      "aria-haspopup",
      "menu",
    );
    expect(root.querySelector("button")).toHaveAttribute(
      "aria-expanded",
      "true",
    );
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
    const dropdown = root.querySelector<HTMLElement>(
      ".top-bar-heading-dropdown",
    )!;
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

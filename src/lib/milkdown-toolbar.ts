import {
  EDITOR_DENSITY_ORDER,
  EDITOR_MORE_BY_DENSITY,
  EDITOR_PRIMARY_BY_DENSITY,
  isEditorToolbarCapabilityVisible,
  type EditorCapabilityId,
  type EditorToolbarDensity,
} from "@/lib/editor-capabilities";

import { isEditorToolbarTool, type EditorToolbarPreference, type EditorToolbarTool } from "./editor-toolbar-preference";

/** 将 Crepe 顶栏的内联可见性与编辑器只读状态保持一致。 */
export function syncMilkdownToolbarVisibility(
  root: ParentNode,
  readonly: boolean,
): void {
  root.querySelectorAll<HTMLElement>(".milkdown-top-bar").forEach((topBar) => {
    topBar.style.display = readonly ? "none" : "";
  });
}

const originalToolbarChildren = new WeakMap<HTMLElement, HTMLElement[]>();
function reorderToolbarChildren(inner: HTMLElement, ordered: HTMLElement[]) {
  ordered.forEach((child, index) => {
    if (inner.children[index] !== child) inner.insertBefore(child, inner.children[index] ?? null);
  });
}
const TOOLBAR_VIEWPORT_GAP = 8;
const TOOLBAR_POPOVER_GAP = 6;

/** 给第三方生成的顶栏补上稳定的水平工具栏语义。 */
export function syncMilkdownToolbarSemantics(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>(".milkdown-top-bar").forEach((topBar) => {
    topBar.setAttribute("role", "toolbar");
    topBar.setAttribute("aria-label", "正文格式工具栏");
    topBar.setAttribute("aria-orientation", "horizontal");
  });
}

export interface MilkdownToolbarItemMetadata {
  key: string;
  label: string;
}

/** 为 Crepe 生成的无文本按钮补齐名称与稳定能力 ID。 */
export function syncMilkdownToolbarItems(
  root: ParentNode,
  items: readonly MilkdownToolbarItemMetadata[],
): void {
  root.querySelectorAll(".milkdown-top-bar").forEach((topBar) => {
    const heading = topBar.querySelector<HTMLButtonElement>(
      ".top-bar-heading-button",
    );
    if (heading) {
      heading.title = "切换正文样式";
      heading.setAttribute("aria-label", "切换正文样式");
      heading.dataset.editorTool = "heading";
      heading.tabIndex = -1;
    }

    topBar
      .querySelectorAll<HTMLButtonElement>(".top-bar-item")
      .forEach((button, index) => {
        const item = items.find((candidate) => candidate.key === button.dataset.editorTool) ?? items[index];
        if (!item) return;
        button.title = item.label;
        button.setAttribute("aria-label", item.label);
        button.dataset.editorTool = item.key;
        button.tabIndex = -1;
        if (["bold", "italic", "strikethrough", "inline-code", "link"].includes(item.key)) {
          button.setAttribute("aria-pressed", String(button.classList.contains("active")));
        }
        if (item.key === "more") {
          button.setAttribute("aria-haspopup", topBar.getAttribute("data-editor-density") === "custom" ? "dialog" : "menu");
          if (!button.hasAttribute("aria-expanded")) {
            button.setAttribute("aria-expanded", "false");
          }
        }
      });
  });
}

/** 标题读取兼容 H1–H6，但创建菜单只暴露产品允许的层级。 */
export function syncMilkdownHeadingOptions(
  root: ParentNode,
  allowedLabels: ReadonlySet<string>,
): void {
  root
    .querySelectorAll<HTMLButtonElement>(".top-bar-heading-option")
    .forEach((option) => {
      option.hidden = !allowedLabels.has(option.textContent?.trim() ?? "");
      option.tabIndex = -1;
    });
}

export type MilkdownToolbarDensity = EditorToolbarDensity;

/** 同步每级密度的可见按钮，并移除没有可见按钮的空分组分隔线。 */
export function applyMilkdownToolbarDensity(
  topBar: HTMLElement,
  density: MilkdownToolbarDensity,
  alignmentEnabled = true,
): void {
  topBar.dataset.editorDensity = density;
  const primary = new Set<string>(EDITOR_PRIMARY_BY_DENSITY[density]);
  topBar.querySelectorAll<HTMLElement>("[data-editor-tool]").forEach((item) => {
    const tool = item.dataset.editorTool ?? "";
    const capability = tool === "align-center" || tool === "align-right" ? "alignment" : tool;
    item.hidden = !primary.has(capability)
      || !isEditorToolbarCapabilityVisible(capability)
      || (capability === "alignment" && !alignmentEnabled);
  });

  const inner = topBar.querySelector<HTMLElement>(".top-bar-inner");
  if (!inner) return;
  const children = Array.from(inner.children) as HTMLElement[];
  children.forEach((child, index) => {
    if (!child.classList.contains("top-bar-divider")) return;
    const group = children
      .slice(index + 1)
      .findIndex((candidate) =>
        candidate.classList.contains("top-bar-divider"),
      );
    const end = group === -1 ? children.length : index + 1 + group;
    child.hidden = !children
      .slice(index + 1, end)
      .some((candidate) => !candidate.hidden);
  });
}

/** “更多”只列出当前密度确实隐藏的能力，避免与一级按钮重复。 */
export function getMilkdownMoreCapabilities(
  density: MilkdownToolbarDensity,
  hasDraft: boolean,
  alignmentEnabled = true,
): EditorCapabilityId[] {
  if (density === "expanded") return [];

  return EDITOR_MORE_BY_DENSITY[density].filter(
    (capability): capability is EditorCapabilityId =>
      isEditorToolbarCapabilityVisible(capability)
      && (capability !== "draft" || hasDraft)
      && (capability !== "alignment" || alignmentEnabled),
  );
}

/** 按真实容器宽度逐级收纳可选一级项，始终不启用横向滚动。 */
export function fitMilkdownToolbar(
  topBar: HTMLElement,
  alignmentEnabled = true,
): MilkdownToolbarDensity {
  topBar.querySelectorAll<HTMLElement>("[data-editor-toolbar-order]").forEach((item) => {
    item.style.order = "";
    item.hidden = false;
    delete item.dataset.editorToolbarOrder;
  });
  const inner = topBar.querySelector<HTMLElement>(".top-bar-inner");
  const original = originalToolbarChildren.get(topBar);
  if (inner && original?.every((child) => child.parentElement === inner)) reorderToolbarChildren(inner, original);
  for (const density of EDITOR_DENSITY_ORDER) {
    applyMilkdownToolbarDensity(topBar, density, alignmentEnabled);
    if (!inner || topBar.scrollWidth <= topBar.clientWidth) return density;
  }
  return "compact";
}

export function syncMilkdownMoreMenuState(
  root: ParentNode,
  open: boolean,
): void {
  root
    .querySelectorAll<HTMLElement>('[data-editor-tool="more"]')
    .forEach((trigger) => {
      trigger.setAttribute("aria-haspopup", trigger.closest(".milkdown-top-bar")?.getAttribute("data-editor-density") === "custom" ? "dialog" : "menu");
      trigger.setAttribute("aria-expanded", String(open));
    });
}

interface ToolbarViewport {
  width: number;
  height: number;
}

/**
 * 编辑器外框会裁切绝对定位子元素，因此标题菜单改用视口坐标浮动。
 * 菜单仍留在原 DOM 中，Crepe 自带的选择与点击外部关闭逻辑可以继续工作。
 */
export function positionMilkdownHeadingDropdowns(
  root: ParentNode,
  viewport: ToolbarViewport = {
    width: window.innerWidth,
    height: window.innerHeight,
  },
): void {
  root
    .querySelectorAll<HTMLElement>(".top-bar-heading-dropdown")
    .forEach((dropdown) => {
      const selector = dropdown.closest<HTMLElement>(
        ".top-bar-heading-selector",
      );
      const trigger = selector?.querySelector<HTMLElement>(
        ".top-bar-heading-button",
      );
      if (!trigger) return;

      dropdown.dataset.editorFloating = "true";
      const triggerRect = trigger.getBoundingClientRect();
      const dropdownRect = dropdown.getBoundingClientRect();
      const width = Math.min(
        dropdownRect.width,
        Math.max(0, viewport.width - TOOLBAR_VIEWPORT_GAP * 2),
      );
      const height = Math.min(
        dropdownRect.height,
        Math.max(0, viewport.height - TOOLBAR_VIEWPORT_GAP * 2),
      );
      const maxLeft = Math.max(
        TOOLBAR_VIEWPORT_GAP,
        viewport.width - width - TOOLBAR_VIEWPORT_GAP,
      );
      const belowTop = triggerRect.bottom + TOOLBAR_POPOVER_GAP;
      const top =
        belowTop + height <= viewport.height - TOOLBAR_VIEWPORT_GAP
          ? belowTop
          : Math.max(
              TOOLBAR_VIEWPORT_GAP,
              triggerRect.top - height - TOOLBAR_POPOVER_GAP,
            );

      dropdown.style.top = `${top}px`;
      dropdown.style.left = `${Math.max(
        TOOLBAR_VIEWPORT_GAP,
        Math.min(maxLeft, triggerRect.left),
      )}px`;
    });
}

/** 用户排序仅调整呈现顺序，不重挂载编辑器；溢出时从主栏末尾稳定收纳。 */
export function fitCustomMilkdownToolbar(
  topBar: HTMLElement,
  preference: EditorToolbarPreference,
  available: ReadonlySet<EditorToolbarTool>,
): EditorToolbarTool[] {
  topBar.dataset.editorDensity = "custom";
  const buttons = Array.from(topBar.querySelectorAll<HTMLElement>("[data-editor-tool]"));
  const toolFor = (item: HTMLElement) => {
    const key = item.dataset.editorTool;
    return key === "align-center" || key === "align-right" ? "alignment" : key;
  };
  const elementFor = (item: HTMLElement) => item.dataset.editorTool === "heading"
    ? item.closest<HTMLElement>(".top-bar-heading-selector") ?? item : item;
  const inner = topBar.querySelector<HTMLElement>(".top-bar-inner");
  if (inner && !originalToolbarChildren.get(topBar)?.every((child) => child.parentElement === inner)) originalToolbarChildren.set(topBar, Array.from(inner.children) as HTMLElement[]);
  const primary = preference.primary.filter((id) => available.has(id));
  const more = preference.more.filter((id) => available.has(id));
  const apply = () => {
    for (const button of buttons) {
      const id = toolFor(button);
      const element = elementFor(button);
      button.hidden = false;
      element.hidden = id !== "more" && (!isEditorToolbarTool(id) || !primary.includes(id));
      element.dataset.editorToolbarOrder = "true";
      element.style.order = String(id === "more" ? primary.length * 2 + 1
        : isEditorToolbarTool(id) ? primary.indexOf(id) * 2 + (button.dataset.editorTool === "align-right" ? 1 : 0) : -1);
      button.tabIndex = element.hidden ? -1 : 0;
      if (id === "more") button.setAttribute("aria-haspopup", "dialog");
    }
    topBar.querySelectorAll<HTMLElement>(".top-bar-divider").forEach((divider) => { divider.hidden = true; });
  };
  apply();
  const overflow: EditorToolbarTool[] = [];
  while (primary.length && topBar.scrollWidth > topBar.clientWidth) {
    overflow.unshift(primary.pop()!);
    apply();
  }
  if (inner) {
    const ordered = (Array.from(inner.children) as HTMLElement[]).sort((a, b) => {
        if (a.hidden !== b.hidden) return a.hidden ? 1 : -1;
        return Number(a.style.order || 0) - Number(b.style.order || 0);
      });
    reorderToolbarChildren(inner, ordered);
  }
  return [...overflow, ...more];
}

/** 自定义主栏按实际 DOM 顺序支持键盘，复用 Crepe 的原命令和选区。 */
export function handleCustomToolbarKeyDown(event: KeyboardEvent): void {
  const target = event.target instanceof HTMLElement ? event.target : null;
  const toolbar = target?.closest<HTMLElement>('.milkdown-top-bar[data-editor-density="custom"]');
  if (!target || !toolbar || !target.matches("button")) return;
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    target.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true }));
    return;
  }
  const options = toolbar.querySelector<HTMLElement>(".top-bar-heading-dropdown");
  const scope = options && target.closest(".top-bar-heading-dropdown") ? options : toolbar;
  const buttons = Array.from(scope.querySelectorAll<HTMLButtonElement>("button")).filter((button) => !button.closest("[hidden]") && !button.disabled
    && (scope !== toolbar || !button.closest(".top-bar-heading-dropdown")));
  const index = buttons.indexOf(target as HTMLButtonElement);
  let next = index;
  if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % buttons.length;
  else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (index - 1 + buttons.length) % buttons.length;
  else if (event.key === "Home") next = 0;
  else if (event.key === "End") next = buttons.length - 1;
  else return;
  event.preventDefault();
  buttons[next]?.focus();
}

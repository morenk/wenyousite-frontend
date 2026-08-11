/** 将 Crepe 顶栏的内联可见性与编辑器只读状态保持一致。 */
export function syncMilkdownToolbarVisibility(
  root: ParentNode,
  readonly: boolean,
): void {
  root.querySelectorAll<HTMLElement>(".milkdown-top-bar").forEach((topBar) => {
    topBar.style.display = readonly ? "none" : "";
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
    const heading = topBar.querySelector<HTMLButtonElement>(".top-bar-heading-button");
    if (heading) {
      heading.title = "切换正文样式";
      heading.setAttribute("aria-label", "切换正文样式");
      heading.dataset.editorTool = "heading";
    }

    topBar.querySelectorAll<HTMLButtonElement>(".top-bar-item").forEach((button, index) => {
      const item = items[index];
      if (!item) return;
      button.title = item.label;
      button.setAttribute("aria-label", item.label);
      button.dataset.editorTool = item.key;
      if (item.key === "more") {
        button.setAttribute("aria-haspopup", "menu");
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
  root.querySelectorAll<HTMLButtonElement>(".top-bar-heading-option").forEach((option) => {
    option.hidden = !allowedLabels.has(option.textContent?.trim() ?? "");
  });
}

export type MilkdownToolbarDensity =
  | "expanded"
  | "with-more"
  | "without-draft"
  | "compact";

const MORE_FALLBACK_TOOLS = new Set([
  "link",
  "inline-code",
  "quote",
  "bullet-list",
  "ordered-list",
  "hr",
  "dice",
]);

/** 同步每级密度的可见按钮，并移除没有可见按钮的空分组分隔线。 */
export function applyMilkdownToolbarDensity(
  topBar: HTMLElement,
  density: MilkdownToolbarDensity,
): void {
  topBar.dataset.editorDensity = density;
  topBar.querySelectorAll<HTMLElement>("[data-editor-tool]").forEach((item) => {
    const tool = item.dataset.editorTool ?? "";
    item.hidden = density === "expanded"
      ? tool === "more"
      : MORE_FALLBACK_TOOLS.has(tool)
        || (tool === "draft" && ["without-draft", "compact"].includes(density))
        || (tool === "strikethrough" && density === "compact");
  });

  const inner = topBar.querySelector<HTMLElement>(".top-bar-inner");
  if (!inner) return;
  const children = Array.from(inner.children) as HTMLElement[];
  children.forEach((child, index) => {
    if (!child.classList.contains("top-bar-divider")) return;
    const group = children.slice(index + 1).findIndex((candidate) =>
      candidate.classList.contains("top-bar-divider"),
    );
    const end = group === -1 ? children.length : index + 1 + group;
    child.hidden = !children
      .slice(index + 1, end)
      .some((candidate) => !candidate.hidden);
  });
}

/** 按真实容器宽度逐级收纳可选一级项，始终不启用横向滚动。 */
export function fitMilkdownToolbar(topBar: HTMLElement): MilkdownToolbarDensity {
  const inner = topBar.querySelector<HTMLElement>(".top-bar-inner");
  const densities: readonly MilkdownToolbarDensity[] = [
    "expanded",
    "with-more",
    "without-draft",
    "compact",
  ];

  for (const density of densities) {
    applyMilkdownToolbarDensity(topBar, density);
    if (!inner || topBar.scrollWidth <= topBar.clientWidth) return density;
  }
  return "compact";
}

export function syncMilkdownMoreMenuState(root: ParentNode, open: boolean): void {
  root.querySelectorAll<HTMLElement>('[data-editor-tool="more"]').forEach((trigger) => {
    trigger.setAttribute("aria-haspopup", "menu");
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
  root.querySelectorAll<HTMLElement>(".top-bar-heading-dropdown").forEach((dropdown) => {
    const selector = dropdown.closest<HTMLElement>(".top-bar-heading-selector");
    const trigger = selector?.querySelector<HTMLElement>(".top-bar-heading-button");
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
    const top = belowTop + height <= viewport.height - TOOLBAR_VIEWPORT_GAP
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

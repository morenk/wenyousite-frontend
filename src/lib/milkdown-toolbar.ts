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

/** 键盘焦点进入被横向裁切的按钮时，仅滚动工具栏，不带动页面。 */
export function revealFocusedMilkdownToolbarItem(target: Element): void {
  const item = target.closest<HTMLElement>(
    ".top-bar-item, .top-bar-heading-button",
  );
  const topBar = item?.closest<HTMLElement>(".milkdown-top-bar");
  if (!item || !topBar) return;

  const itemRect = item.getBoundingClientRect();
  const topBarRect = topBar.getBoundingClientRect();
  if (itemRect.left < topBarRect.left + TOOLBAR_VIEWPORT_GAP) {
    topBar.scrollLeft -= topBarRect.left + TOOLBAR_VIEWPORT_GAP - itemRect.left;
  } else if (itemRect.right > topBarRect.right - TOOLBAR_VIEWPORT_GAP) {
    topBar.scrollLeft += itemRect.right - topBarRect.right + TOOLBAR_VIEWPORT_GAP;
  }
}

interface ToolbarViewport {
  width: number;
  height: number;
}

/**
 * 横向滚动容器会裁切绝对定位子元素，因此标题菜单改用视口坐标浮动。
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

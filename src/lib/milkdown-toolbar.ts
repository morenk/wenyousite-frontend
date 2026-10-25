import { editorIconSvg } from "./editor-icons";
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
      // 标题、文字颜色和字体共用 T 入口；保留上游标签节点供其更新当前标题状态。
      if (!heading.querySelector(".top-bar-style-icon")) {
        const icon = heading.ownerDocument.createElement("span");
        icon.className = "top-bar-style-icon";
        icon.setAttribute("aria-hidden", "true");
        const svg = new DOMParser().parseFromString(editorIconSvg("heading"), "image/svg+xml").documentElement;
        icon.appendChild(heading.ownerDocument.importNode(svg, true));
        heading.prepend(icon);
      }
      heading.title = "切换正文样式";
      heading.setAttribute("aria-label", "切换正文样式");
      heading.dataset.editorTool = "heading";
      heading.tabIndex = 0;
      heading.setAttribute("aria-haspopup", "dialog");
      if (!heading.hasAttribute("aria-expanded")) heading.setAttribute("aria-expanded", "false");
    }

    topBar
      .querySelectorAll<HTMLButtonElement>(".top-bar-item")
      .forEach((button, index) => {
        const item = items.find((candidate) => candidate.key === button.dataset.editorTool) ?? items[index];
        if (!item) return;
        button.title = item.label;
        button.setAttribute("aria-label", item.label);
        button.dataset.editorTool = item.key;
        button.tabIndex = item.key === "more" && topBar.getAttribute("data-editor-audio-enabled") === "true" ? 0 : -1;
        if (["bold", "italic", "strikethrough", "inline-code", "link"].includes(item.key)) {
          button.setAttribute("aria-pressed", String(button.classList.contains("active")));
        }
        if (item.key === "more") {
          button.setAttribute("aria-haspopup", topBar.getAttribute("data-editor-density") === "custom" || topBar.getAttribute("data-editor-audio-enabled") === "true" ? "dialog" : "menu");
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

/** 同步每级密度的可见按钮；组间分隔线始终退出布局和溢出测量。 */
export function applyMilkdownToolbarDensity(
  topBar: HTMLElement,
  density: MilkdownToolbarDensity,
  alignmentEnabled = true,
  audioEnabled = false,
): void {
  topBar.dataset.editorDensity = density;
  topBar.dataset.editorAudioEnabled = String(audioEnabled);
  const primary = new Set<string>(EDITOR_PRIMARY_BY_DENSITY[density]);
  if (audioEnabled) primary.add("more");
  topBar.querySelectorAll<HTMLElement>("[data-editor-tool]").forEach((item) => {
    const tool = item.dataset.editorTool ?? "";
    const capability = tool === "align-center" || tool === "align-right" ? "alignment" : tool;
    if (capability === "more" && audioEnabled) { item.tabIndex = 0; item.setAttribute("aria-haspopup", "dialog"); }
    item.hidden = !primary.has(capability)
      || !isEditorToolbarCapabilityVisible(capability)
      || (capability === "alignment" && !alignmentEnabled);
  });

  topBar.querySelectorAll<HTMLElement>(".top-bar-divider").forEach((divider) => { divider.hidden = true; });
}

/** “更多”只列出当前密度确实隐藏的能力，避免与一级按钮重复。 */
export function getMilkdownMoreCapabilities(
  density: MilkdownToolbarDensity,
  hasDraft: boolean,
  alignmentEnabled = true,
  audioEnabled = false,
): EditorCapabilityId[] {
  return [...EDITOR_MORE_BY_DENSITY[density], ...(audioEnabled ? ["audio" as const] : [])].filter(
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
  audioEnabled = false,
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
    applyMilkdownToolbarDensity(topBar, density, alignmentEnabled, audioEnabled);
    if (!inner || topBar.scrollWidth <= topBar.clientWidth) return density;
  }
  return "compact";
}

/** 最低默认密度仍放不下时，继续按实际宽度收纳末尾工具，并把动态结果交给 More。 */
export function fitDefaultMilkdownToolbar(
  topBar: HTMLElement,
  hasDraft = true,
  alignmentEnabled = true,
  audioEnabled = false,
): EditorCapabilityId[] {
  const density = fitMilkdownToolbar(topBar, alignmentEnabled, audioEnabled);
  const more = getMilkdownMoreCapabilities(density, hasDraft, alignmentEnabled, audioEnabled);
  if (topBar.scrollWidth <= topBar.clientWidth) return more;
  const primary = EDITOR_PRIMARY_BY_DENSITY[density].filter((id) => id !== "more" && isEditorToolbarCapabilityVisible(id));
  const overflow: EditorCapabilityId[] = [];
  while (primary.length && topBar.scrollWidth > topBar.clientWidth) {
    const id = primary.pop()!;
    overflow.unshift(id);
    topBar.querySelectorAll<HTMLElement>(`[data-editor-tool="${id}"]`).forEach((button) => {
      const element = id === "heading" ? button.closest<HTMLElement>(".top-bar-heading-selector") ?? button : button;
      element.hidden = true;
      element.dataset.editorToolbarOrder = "true";
    });
  }
  return [...overflow, ...more];
}

export function syncMilkdownMoreMenuState(
  root: ParentNode,
  open: boolean,
): void {
  root
    .querySelectorAll<HTMLElement>('[data-editor-tool="more"]')
    .forEach((trigger) => {
      trigger.setAttribute("aria-haspopup", trigger.closest(".milkdown-top-bar")?.getAttribute("data-editor-density") === "custom" || trigger.closest(".milkdown-top-bar")?.getAttribute("data-editor-audio-enabled") === "true" ? "dialog" : "menu");
      trigger.setAttribute("aria-expanded", String(open));
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
  const toolbar = target?.closest<HTMLElement>(".milkdown-top-bar");
  if (!target || !toolbar || !target.matches("button")) return;
  if (toolbar.dataset.editorDensity !== "custom" && !(target.dataset.editorTool === "more" && toolbar.dataset.editorAudioEnabled === "true")) return;
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

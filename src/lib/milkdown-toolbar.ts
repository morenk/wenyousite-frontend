/** 将 Crepe 顶栏的内联可见性与编辑器只读状态保持一致。 */
export function syncMilkdownToolbarVisibility(
  root: ParentNode,
  readonly: boolean,
): void {
  root.querySelectorAll<HTMLElement>(".milkdown-top-bar").forEach((topBar) => {
    topBar.style.display = readonly ? "none" : "";
  });
}

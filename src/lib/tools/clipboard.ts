/** 仅在用户点击时调用；失败保持结果可选中，不接入原生桥。 */
export async function copyToolText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const active = document.activeElement;
    const selection = document.getSelection();
    const ranges = selection ? Array.from({ length: selection.rangeCount }, (_, index) => selection.getRangeAt(index).cloneRange()) : [];
    const input = document.createElement("textarea");
    input.value = text;
    input.readOnly = true;
    input.style.position = "fixed";
    input.style.opacity = "0";
    document.body.append(input);
    try {
      input.select();
      input.setSelectionRange(0, text.length);
      return document.execCommand("copy");
    } catch {
      return false;
    } finally {
      input.remove();
      if (active instanceof HTMLElement) active.focus({ preventScroll: true });
      selection?.removeAllRanges();
      ranges.forEach((range) => selection?.addRange(range));
    }
  }
}

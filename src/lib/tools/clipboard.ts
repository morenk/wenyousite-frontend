/** 普通文本复制；仅由用户操作触发，不承载邀请凭据或站内富文本协议。 */
export async function copyToolText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const active = document.activeElement;
    const inputSelection = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement
      ? { start: active.selectionStart, end: active.selectionEnd, direction: active.selectionDirection }
      : null;
    const selection = document.getSelection();
    const ranges = selection ? Array.from({ length: selection.rangeCount }, (_, index) => selection.getRangeAt(index).cloneRange()) : [];
    const input = document.createElement("textarea");
    input.value = text;
    input.readOnly = true;
    input.style.position = "fixed";
    input.style.opacity = "0";
    // 留在当前弹窗的焦点范围内，避免 focus trap 将临时选区移走。
    const container = active instanceof Element
      ? active.closest('[role="dialog"], [role="alertdialog"], dialog')
      : null;
    (container ?? document.body).append(input);
    try {
      input.focus({ preventScroll: true });
      input.select();
      input.setSelectionRange(0, text.length);
      return document.execCommand("copy");
    } catch {
      return false;
    } finally {
      input.remove();
      if (active instanceof HTMLElement) active.focus({ preventScroll: true });
      if (inputSelection?.start != null && inputSelection.end != null
        && (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement)) {
        active.setSelectionRange(inputSelection.start, inputSelection.end, inputSelection.direction ?? undefined);
      }
      selection?.removeAllRanges();
      ranges.forEach((range) => selection?.addRange(range));
    }
  }
}

import { useRef } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { EditorResizeHandle } from "../editor-resize-handle";

function Harness({ disabled = false }: { disabled?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  return <div ref={ref} data-testid="editor"><div className="ProseMirror">正文</div><EditorResizeHandle containerRef={ref} minHeight={120} maxHeight={200} disabled={disabled} /></div>;
}
afterEach(cleanup);
test("拖高超过初始上限，不替换正文节点，向上拖动保留最小高度", () => {
  render(<Harness />);
  const grip = screen.getByRole("separator", { name: "调整编辑器高度" });
  const body = screen.getByText("正文");
  vi.spyOn(body, "getBoundingClientRect").mockReturnValue({ height: 180 } as DOMRect);
  grip.setPointerCapture = vi.fn(); grip.releasePointerCapture = vi.fn();
  fireEvent.pointerDown(grip, { button: 0, pointerId: 1, clientY: 200 });
  fireEvent.pointerMove(grip, { pointerId: 1, clientY: 500 });
  expect(screen.getByTestId("editor").style.getPropertyValue("--editor-user-height")).toBe("480px");
  expect(screen.getByText("正文")).toBe(body);
  fireEvent.pointerMove(grip, { pointerId: 1, clientY: 0 });
  expect(grip).toHaveAttribute("aria-valuenow", "120");
  fireEvent.pointerUp(grip, { pointerId: 1 });
  fireEvent.pointerMove(grip, { pointerId: 1, clientY: 800 });
  expect(grip).toHaveAttribute("aria-valuenow", "120");
});
test("键盘可调高与恢复最小值，禁用时不能调整", () => {
  const view = render(<Harness />);
  const grip = screen.getByRole("separator");
  fireEvent.keyDown(grip, { key: "ArrowDown" });
  expect(grip).toHaveAttribute("aria-valuenow", "160");
  fireEvent.keyDown(grip, { key: "End" });
  expect(grip).toHaveAttribute("aria-valuenow", "1200");
  fireEvent.keyDown(grip, { key: "Home" });
  expect(grip).toHaveAttribute("aria-valuenow", "120");
  view.rerender(<Harness disabled />);
  fireEvent.keyDown(grip, { key: "ArrowDown" });
  expect(grip).toHaveAttribute("aria-valuenow", "120");
  expect(grip).toHaveAttribute("tabindex", "-1");
});

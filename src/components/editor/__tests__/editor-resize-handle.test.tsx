import { useRef } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { EditorResizeHandle } from "../editor-resize-handle";

function Harness({ disabled = false, edge = "bottom" }: { disabled?: boolean; edge?: "top" | "bottom" }) {
  const ref = useRef<HTMLDivElement>(null);
  return <div ref={ref} data-testid="editor"><div className="ProseMirror">正文</div><EditorResizeHandle containerRef={ref} minHeight={120} maxHeight={200} disabled={disabled} edge={edge} /></div>;
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

test("底部浮动编辑器拖上边框向上增高，限制在可见区域且不显示图标", () => {
  render(<Harness edge="top" />);
  const border = screen.getByRole("separator");
  const body = screen.getByText("正文");
  const wrapper = screen.getByTestId("editor");
  vi.spyOn(body, "getBoundingClientRect").mockReturnValue({ height: 180 } as DOMRect);
  vi.spyOn(wrapper, "getBoundingClientRect").mockReturnValue({ height: 280, bottom: 750 } as DOMRect);
  border.setPointerCapture = vi.fn(); border.releasePointerCapture = vi.fn();
  expect(border).toHaveAttribute("data-resize-edge", "top");
  expect(border).toBeEmptyDOMElement();
  fireEvent.pointerDown(border, { button: 0, pointerId: 2, clientY: 450 });
  fireEvent.pointerMove(border, { pointerId: 2, clientY: 290 });
  expect(wrapper.style.getPropertyValue("--editor-user-height")).toBe("340px");
  fireEvent.pointerMove(border, { pointerId: 2, clientY: -1000 });
  expect(wrapper.style.getPropertyValue("--editor-user-height")).toBe("634px");
  expect(screen.getByText("正文")).toBe(body);
  fireEvent.pointerUp(border, { pointerId: 2 });
  fireEvent.keyDown(border, { key: "ArrowUp" });
  expect(border).toHaveAttribute("aria-valuenow", "220");
});

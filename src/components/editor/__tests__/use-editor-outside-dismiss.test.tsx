import { createPortal } from "react-dom";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { useEditorOutsideDismiss } from "../use-editor-outside-dismiss";

function Harness({ dismiss, disabled = false }: { dismiss: () => Promise<unknown>; disabled?: boolean }) {
  const onPointerDownCapture = useEditorOutsideDismiss(dismiss, disabled);
  return <div onPointerDownCapture={onPointerDownCapture}>
    <textarea aria-label="正文" />
    {createPortal(<button>编辑器弹出菜单</button>, document.body)}
  </div>;
}
afterEach(cleanup);
test("正文和 Portal 菜单不触发收起，外部主键点击仅触发一次", async () => {
  let finish: () => void = () => {};
  const dismiss = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
  render(<Harness dismiss={dismiss} />);
  fireEvent.pointerDown(screen.getByLabelText("正文"), { button: 0 });
  fireEvent.pointerDown(screen.getByRole("button", { name: "编辑器弹出菜单" }), { button: 0 });
  fireEvent.pointerDown(document.body, { button: 2 });
  expect(dismiss).not.toHaveBeenCalled();
  fireEvent.pointerDown(document.body, { button: 0 });
  fireEvent.pointerDown(document.body, { button: 0 });
  expect(dismiss).toHaveBeenCalledOnce();
  finish();
  await waitFor(() => expect(dismiss).toHaveBeenCalledOnce());
});
test("禁用与全局确认对话框交互不会触发收起，卸载移除监听", () => {
  const dismiss = vi.fn().mockResolvedValue(false);
  const view = render(<Harness dismiss={dismiss} disabled />);
  fireEvent.pointerDown(document.body, { button: 0 });
  expect(dismiss).not.toHaveBeenCalled();
  view.rerender(<><Harness dismiss={dismiss} /><div role="alertdialog"><button>保留正文</button></div></>);
  fireEvent.pointerDown(screen.getByText("保留正文"), { button: 0 });
  expect(dismiss).not.toHaveBeenCalled();
  view.unmount();
  fireEvent.pointerDown(document.body, { button: 0 });
  expect(dismiss).not.toHaveBeenCalled();
});

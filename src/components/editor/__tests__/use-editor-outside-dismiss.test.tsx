import { createPortal, flushSync } from "react-dom";
import { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { useEditorOutsideDismiss } from "../use-editor-outside-dismiss";

function Harness({ dismiss, disabled = false }: { dismiss: () => Promise<unknown>; disabled?: boolean }) {
  const events = useEditorOutsideDismiss(dismiss, disabled);
  return <div {...events}>
    <textarea aria-label="正文" />
    {createPortal(<button>编辑器弹出菜单</button>, document.body)}
  </div>;
}
afterEach(cleanup);
test("正文与 Portal 菜单不收起，外部点击完成后仅关闭一次", async () => {
  let finish: () => void = () => {};
  const dismiss = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
  render(<Harness dismiss={dismiss} />);
  fireEvent.click(screen.getByLabelText("正文"));
  fireEvent.click(screen.getByRole("button", { name: "编辑器弹出菜单" }));
  fireEvent.click(document.body, { button: 2 });
  fireEvent.pointerDown(document.body, { button: 0 });
  await Promise.resolve();
  expect(dismiss).not.toHaveBeenCalled();
  fireEvent.click(document.body, { button: 0 });
  fireEvent.click(document.body, { button: 0 });
  await waitFor(() => expect(dismiss).toHaveBeenCalledOnce());
  finish();
});
test("从正文拖动到外部不收起，禁用和全局确认流程也不收起", async () => {
  const dismiss = vi.fn().mockResolvedValue(false);
  const view = render(<Harness dismiss={dismiss} />);
  fireEvent.pointerDown(screen.getByLabelText("正文"), { button: 0 });
  fireEvent.click(document.body, { detail: 1 });
  await Promise.resolve();
  expect(dismiss).not.toHaveBeenCalled();
  view.rerender(<Harness dismiss={dismiss} disabled />);
  fireEvent.click(document.body);
  await Promise.resolve();
  expect(dismiss).not.toHaveBeenCalled();
  view.rerender(<><Harness dismiss={dismiss} /><div role="alertdialog"><button>保留正文</button></div></>);
  fireEvent.click(screen.getByText("保留正文"));
  await Promise.resolve();
  expect(dismiss).not.toHaveBeenCalled();
  view.unmount();
  fireEvent.click(document.body);
  await Promise.resolve();
  expect(dismiss).not.toHaveBeenCalled();
});

test("打开编辑器的同一次点击不会被新挂载的外部监听器误判为关闭", async () => {
  const dismiss = vi.fn().mockResolvedValue(false);
  function Entry() {
    const [open, setOpen] = useState(false);
    return <><button onClick={() => flushSync(() => setOpen(true))}>编辑楼层</button>{open && <Harness dismiss={dismiss} />}</>;
  }
  render(<Entry />);
  fireEvent.click(screen.getByRole("button", { name: "编辑楼层" }));
  await Promise.resolve();
  expect(screen.getByLabelText("正文")).toBeInTheDocument();
  expect(dismiss).not.toHaveBeenCalled();
  fireEvent.click(document.body);
  await waitFor(() => expect(dismiss).toHaveBeenCalledOnce());
});

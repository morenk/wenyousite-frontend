import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { Dialog, DialogPortal, DialogPopup, DialogTitle } from "@/components/ui/dialog";
import { copyToolText } from "../clipboard";

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

test("共享 Dialog 的真实焦点圈定允许普通复制降级并恢复焦点", async () => {
  const user = userEvent.setup();
  const write = vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("denied"));
  const done = vi.fn();
  render(<><button>外部按钮</button><Dialog open><DialogPortal><DialogPopup><DialogTitle>复制本地正文</DialogTitle>
    <button onClick={() => void copyToolText("保留本地正文").then(done)}>复制</button>
  </DialogPopup></DialogPortal></Dialog></>);
  const dialog = screen.getByRole("dialog");
  const button = screen.getByRole("button", { name: "复制" });
  const execute = vi.fn(() => {
    const temporary = document.activeElement as HTMLTextAreaElement;
    expect(dialog.contains(temporary)).toBe(true);
    expect(temporary.tagName).toBe("TEXTAREA");
    expect(temporary.value.slice(temporary.selectionStart, temporary.selectionEnd)).toBe("保留本地正文");
    return true;
  });
  Object.defineProperty(document, "execCommand", { configurable: true, value: execute });
  await user.click(button);
  await waitFor(() => expect(done).toHaveBeenCalledWith(true));
  expect(write).toHaveBeenCalledWith("保留本地正文");
  expect(execute).toHaveBeenCalledWith("copy");
  expect(button).toHaveFocus();
  expect(dialog.querySelector("textarea")).toBeNull();
});

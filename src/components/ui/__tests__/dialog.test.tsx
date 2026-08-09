import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";

import {
  Dialog,
  DialogBackdrop,
  DialogCloseButton,
  DialogPopup,
  DialogPortal,
  DialogTitle,
  DialogViewport,
} from "@/components/ui/dialog";

afterEach(cleanup);

describe("Dialog", () => {
  test("提供模态语义、统一表面和关闭按钮命中区", () => {
    render(
      <Dialog open>
        <DialogPortal>
          <DialogBackdrop />
          <DialogViewport>
            <DialogPopup>
              <DialogTitle>编辑内容</DialogTitle>
              <DialogCloseButton label="关闭编辑" />
            </DialogPopup>
          </DialogViewport>
        </DialogPortal>
      </Dialog>,
    );

    expect(screen.getByRole("dialog", { name: "编辑内容" })).toHaveAttribute(
      "data-slot",
      "dialog-popup",
    );
    expect(screen.getByRole("button", { name: "关闭编辑" })).toHaveClass("size-8");
  });

  test("Esc 通过受控状态回调关闭弹层", async () => {
    const onOpenChange = vi.fn();
    render(
      <Dialog open onOpenChange={onOpenChange}>
        <DialogPortal>
          <DialogBackdrop />
          <DialogViewport>
            <DialogPopup>
              <DialogTitle>键盘弹层</DialogTitle>
              <DialogCloseButton />
            </DialogPopup>
          </DialogViewport>
        </DialogPortal>
      </Dialog>,
    );

    await userEvent.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenCalledWith(
      false,
      expect.objectContaining({ reason: "escape-key" }),
    );
  });
});

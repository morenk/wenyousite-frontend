import { afterEach, describe, expect, test } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  ConfirmProvider,
  useConfirm,
} from "@/components/ui/confirm-provider";

function ConfirmProbe() {
  const confirm = useConfirm();
  return (
    <button
      type="button"
      onClick={async () => {
        const accepted = await confirm({
          title: "删除帖子？",
          description: "删除后将无法恢复。",
          confirmLabel: "确认删除",
          destructive: true,
        });
        document.body.dataset.confirmResult = String(accepted);
      }}
    >
      打开确认框
    </button>
  );
}

afterEach(() => {
  cleanup();
  delete document.body.dataset.confirmResult;
});

describe("ConfirmProvider", () => {
  test("以 alertdialog 呈现操作语义并返回确认结果", async () => {
    const user = userEvent.setup();
    render(
      <ConfirmProvider>
        <ConfirmProbe />
      </ConfirmProvider>,
    );

    await user.click(screen.getByRole("button", { name: "打开确认框" }));

    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveAccessibleName("删除帖子？");
    expect(dialog).toHaveAccessibleDescription("删除后将无法恢复。");

    await user.click(screen.getByRole("button", { name: "确认删除" }));
    expect(document.body.dataset.confirmResult).toBe("true");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  test("取消时返回 false", async () => {
    const user = userEvent.setup();
    render(
      <ConfirmProvider>
        <ConfirmProbe />
      </ConfirmProvider>,
    );

    await user.click(screen.getByRole("button", { name: "打开确认框" }));
    await user.click(screen.getByRole("button", { name: "取消" }));

    expect(document.body.dataset.confirmResult).toBe("false");
  });
});

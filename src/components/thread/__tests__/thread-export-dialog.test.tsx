import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";

import { ThreadExportDialog } from "@/components/thread/thread-export-dialog";

const { mockMutateAsync } = vi.hoisted(() => ({
  mockMutateAsync: vi.fn(),
}));

vi.mock("@/api/hooks/use-thread-export", () => ({
  useThreadExport: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
    error: null,
  }),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("ThreadExportDialog", () => {
  test("默认保留纪念所需信息，并将配置提交给导出接口", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const blob = new Blob(["zip"], { type: "application/zip" });
    mockMutateAsync.mockResolvedValue({ blob, filename: "archive.zip" });
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:archive"),
      revokeObjectURL: vi.fn(),
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    render(
      <ThreadExportDialog
        threadId="thread-1"
        threadTitle="测试主题"
        open
        onOpenChange={onOpenChange}
      />,
    );

    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes).toHaveLength(6);
    expect(checkboxes.filter((checkbox) => (checkbox as HTMLInputElement).checked)).toHaveLength(5);

    await user.click(screen.getByRole("checkbox", { name: /保留站内来源链接/ }));
    await user.click(screen.getByRole("button", { name: "下载 ZIP" }));

    expect(mockMutateAsync).toHaveBeenCalledWith({
      threadId: "thread-1",
      options: {
        includeAuthors: true,
        includeTimestamps: true,
        includeFloorNumbers: true,
        includeReplyTargets: true,
        includeSourceLinks: true,
        includeMedia: true,
      },
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

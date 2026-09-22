import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

const { submit } = vi.hoisted(() => ({ submit: vi.fn().mockResolvedValue({}) }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: vi.fn() }),
}));

vi.mock("@/api/hooks/use-moderation-actions", () => ({
  useSubmitReport: () => ({ isPending: false, mutateAsync: submit }),
}));

import { ReportForm } from "@/components/user/report-form";

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("ReportForm", () => {
  test.each([[1000, true], [1001, false]])("举报说明%s个emoji按码点限制", async (count, allowed) => {
    render(<ReportForm targetType="MOMENT_COMMENT" targetId="comment-id" />);
    fireEvent.change(screen.getByLabelText("补充说明"), { target: { value: "😀".repeat(count) } });
    fireEvent.click(screen.getByRole("button", { name: "提交举报" }));
    if (allowed) await waitFor(() => expect(submit).toHaveBeenCalledWith(expect.objectContaining({ details: "😀".repeat(count) })));
    else {
      expect(await screen.findByText("补充说明最多 1000 个字")).toBeInTheDocument();
      expect(submit).not.toHaveBeenCalled();
    }
  });

  test("使用用户可理解的目标名称且不展示内部类型与编号", () => {
    render(<ReportForm targetType="MOMENT_COMMENT" targetId="comment-internal-id" />);

    expect(screen.getByRole("heading", { name: "举报评论" })).toBeInTheDocument();
    expect(screen.queryByText(/MOMENT_COMMENT|comment-internal-id/)).toBeNull();
  });
});

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: vi.fn() }),
}));

vi.mock("@/api/hooks/use-moderation-actions", () => ({
  useSubmitReport: () => ({ isPending: false, mutateAsync: vi.fn() }),
}));

import { ReportForm } from "@/components/user/report-form";

afterEach(cleanup);

describe("ReportForm", () => {
  test("使用用户可理解的目标名称且不展示内部类型与编号", () => {
    render(<ReportForm targetType="MOMENT_COMMENT" targetId="comment-internal-id" />);

    expect(screen.getByRole("heading", { name: "举报评论" })).toBeInTheDocument();
    expect(screen.queryByText(/MOMENT_COMMENT|comment-internal-id/)).toBeNull();
  });
});

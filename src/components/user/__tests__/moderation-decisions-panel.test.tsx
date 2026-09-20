import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  decisions: vi.fn(),
  appeal: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}));

vi.mock("@/api/hooks/use-moderation-actions", () => ({
  useMyModerationDecisions: (...args: unknown[]) => mocks.decisions(...args),
  useSubmitModerationAppeal: (...args: unknown[]) => mocks.appeal(...args),
}));

import { ModerationDecisionsPanel } from "@/components/user/moderation-decisions-panel";

afterEach(cleanup);

describe("ModerationDecisionsPanel", () => {
  test.each([[9, false], [10, true], [2000, true], [2001, false]])("申诉%s个emoji按码点验证上下限", async (count, allowed) => {
    const submit = vi.fn().mockResolvedValue({});
    mocks.decisions.mockReturnValue({ data: [{ id: "decision-1", active: true, action: "HIDE_CONTENT", targetType: "THREAD", policyCode: "SPAM", createdAt: "2026-08-23T00:00:00Z", publicExplanation: "测试", appeal: null }], isLoading: false, isError: false });
    mocks.appeal.mockReturnValue({ isPending: false, mutateAsync: submit });
    render(<ModerationDecisionsPanel />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "😀".repeat(count) } });
    fireEvent.click(screen.getByRole("button", { name: "提交申诉" }));
    if (allowed) await waitFor(() => expect(submit).toHaveBeenCalledWith({ decisionId: "decision-1", statement: "😀".repeat(count) }));
    else {
      expect(await screen.findByText(count < 10 ? "请至少写 10 个字" : "申诉最多 2000 个字")).toBeInTheDocument();
      expect(submit).not.toHaveBeenCalled();
    }
  });

  test("用自然语言展示决定且隐藏内部枚举与目标编号", () => {
    mocks.decisions.mockReturnValue({
      data: [{
        id: "decision-1",
        targetType: "THREAD",
        targetId: "thread-internal-id",
        action: "HIDE_CONTENT",
        policyCode: "HARASSMENT",
        publicExplanation: "该主题帖包含针对他人的攻击内容。",
        active: true,
        reversedAt: null,
        createdAt: "2026-08-23T00:00:00.000Z",
        appeal: {
          id: "appeal-1",
          statement: "请结合完整上下文重新复核。",
          status: "PENDING",
          handledNote: null,
          createdAt: "2026-08-23T01:00:00.000Z",
          handledAt: null,
        },
      }],
      isLoading: false,
      isError: false,
    });
    mocks.appeal.mockReturnValue({ isPending: false, mutateAsync: vi.fn() });

    render(<ModerationDecisionsPanel />);

    expect(screen.getByText("隐藏内容")).toBeInTheDocument();
    expect(screen.getByText("骚扰或人身攻击 · 主题帖")).toBeInTheDocument();
    expect(screen.getByText("待复核")).toBeInTheDocument();
    expect(screen.queryByText(/HIDE_CONTENT|HARASSMENT|THREAD|thread-internal-id|PENDING/)).toBeNull();
  });
});

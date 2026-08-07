/** 创建主题帖页面测试：自动创建草稿的并发保护 */

import { StrictMode } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";

import CreateThreadPage from "../page";

const mutateAsync = vi.fn();
let createNew: (() => void) | undefined;

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    user: { id: "user-1", emailVerified: true },
    isInitialized: true,
  }),
}));

vi.mock("@/api/hooks/use-create-thread", () => ({
  useCreateThread: () => ({ mutateAsync }),
}));

vi.mock("@/api/hooks/use-delete-thread", () => ({
  useDeleteThread: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock("@/api/hooks/use-thread-detail", () => ({
  useThreadDetail: () => ({
    data: undefined,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

vi.mock("@/components/thread/thread-draft-picker", () => ({
  ThreadDraftPicker: ({ onCreateNew }: { onCreateNew: () => void }) => {
    createNew = onCreateNew;
    return <button onClick={onCreateNew}>新建主题帖</button>;
  },
}));

vi.mock("@/components/forms/thread-create-form", () => ({
  ThreadCreateForm: () => <div>主题帖表单</div>,
}));

describe("CreateThreadPage", () => {
  beforeEach(() => {
    createNew = undefined;
    mutateAsync.mockReset();
    mutateAsync.mockImplementation(() => new Promise(() => undefined));
  });

  test("Strict Mode 下重复触发点击回调也只创建一个草稿", async () => {
    const user = userEvent.setup();
    render(
      <StrictMode>
        <CreateThreadPage />
      </StrictMode>,
    );

    await user.click(screen.getByRole("button", { name: "新建主题帖" }));
    await act(async () => {
      createNew?.();
      await Promise.resolve();
    });

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    expect(mutateAsync).toHaveBeenCalledWith({
      category: "DEDUCTION",
      visibility: "PUBLIC",
      clientRequestId: expect.any(String),
    });
  });

  test("创建响应失败后重试复用同一 clientRequestId", async () => {
    mutateAsync
      .mockRejectedValueOnce(new Error("network down"))
      .mockImplementationOnce(() => new Promise(() => undefined));
    const user = userEvent.setup();
    render(<CreateThreadPage />);

    await user.click(screen.getByRole("button", { name: "新建主题帖" }));
    await user.click(await screen.findByRole("button", { name: "重试" }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(2));
    expect(mutateAsync.mock.calls[1][0].clientRequestId).toBe(
      mutateAsync.mock.calls[0][0].clientRequestId,
    );
  });
});

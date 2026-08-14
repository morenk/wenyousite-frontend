import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { LoadError } from "@/components/shared/load-error";
import { LoadingState } from "@/components/shared/loading-state";

afterEach(cleanup);

describe("Foundation 反馈状态", () => {
  test("加载态使用 polite 状态播报并暴露中央状态 ID", () => {
    render(<LoadingState label="正在加载主题帖" />);

    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
    expect(screen.getByRole("status")).toHaveAttribute("data-feedback-state", "loading");
  });

  test("阻塞失败保留在上下文并使用稳定重试动词", () => {
    const retry = vi.fn();
    render(<LoadError title="主题帖加载失败" onRetry={retry} />);

    expect(screen.getByRole("status")).toHaveAttribute("data-feedback-state", "error");
    expect(screen.getByRole("button", { name: "重试" })).toBeInTheDocument();
  });
});

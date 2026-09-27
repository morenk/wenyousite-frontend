import { afterEach, expect, it } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { PreviewBoundary } from "./preview-boundary";
import { getAuthAccessToken, setAuthSession } from "@/lib/auth-store";
afterEach(cleanup);
it("批次失效卸载业务树并清除内存凭证，明确要求重新载入", () => {
  setAuthSession({ id: "a", username: "a", email: "a@example.test", avatar: null, role: "USER" }, "memory-token");
  render(<PreviewBoundary><div>旧业务缓存</div></PreviewBoundary>);
  expect(screen.getByText("旧业务缓存")).toBeInTheDocument();
  act(() => window.dispatchEvent(new Event("wenyou-preview-expired")));
  expect(screen.queryByText("旧业务缓存")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "重新载入" })).toBeInTheDocument();
  expect(getAuthAccessToken()).toBeNull();
});

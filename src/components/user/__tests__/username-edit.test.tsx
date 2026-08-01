/** UsernameEdit 组件测试：默认只读、未改动不提交、非法字符报错、合法修改调 PATCH */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const { mockUseAuth } = vi.hoisted(() => ({ mockUseAuth: vi.fn() }));
const { mockUseUpdateProfile } = vi.hoisted(() => ({
  mockUseUpdateProfile: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/api/hooks/use-update-profile", () => ({
  useUpdateProfile: () => mockUseUpdateProfile(),
}));

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual("@tanstack/react-query");
  return {
    ...actual,
    useQueryClient: () => ({ invalidateQueries: vi.fn().mockResolvedValue(undefined) }),
  };
});

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { toast } from "sonner";
import { UsernameEdit } from "@/components/user/username-edit";

function renderWithQC(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("UsernameEdit", () => {
  const setAuth = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: { id: "u1", username: "morenk" },
      accessToken: "token-1",
      setAuth,
    });
    mockUseUpdateProfile.mockReturnValue({
      isPending: false,
      mutateAsync: vi.fn().mockResolvedValue(undefined),
    });
  });

  afterEach(() => cleanup());

  test("默认只读展示当前用户名，不显示输入框", () => {
    renderWithQC(<UsernameEdit currentUsername="morenk" />);
    expect(screen.getByText("morenk")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "修改用户名" })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("输入新用户名")).not.toBeInTheDocument();
  });

  test("点修改用户名进入编辑态", async () => {
    const user = userEvent.setup();
    renderWithQC(<UsernameEdit currentUsername="morenk" />);
    await user.click(screen.getByRole("button", { name: "修改用户名" }));
    expect(screen.getByPlaceholderText("输入新用户名")).toHaveValue("morenk");
  });

  test("未修改用户名直接保存：不发请求，仅收起", async () => {
    const user = userEvent.setup();
    const mutateAsync = vi.fn().mockResolvedValue(undefined);
    mockUseUpdateProfile.mockReturnValue({ isPending: false, mutateAsync });

    renderWithQC(<UsernameEdit currentUsername="morenk" />);
    await user.click(screen.getByRole("button", { name: "修改用户名" }));
    await user.click(screen.getByRole("button", { name: "保存" }));

    expect(mutateAsync).not.toHaveBeenCalled();
    expect(screen.queryByPlaceholderText("输入新用户名")).not.toBeInTheDocument();
  });

  test("非法字符显示校验错误且不调接口", async () => {
    const user = userEvent.setup();
    const mutateAsync = vi.fn().mockResolvedValue(undefined);
    mockUseUpdateProfile.mockReturnValue({ isPending: false, mutateAsync });

    renderWithQC(<UsernameEdit currentUsername="morenk" />);
    await user.click(screen.getByRole("button", { name: "修改用户名" }));
    await user.clear(screen.getByPlaceholderText("输入新用户名"));
    await user.type(screen.getByPlaceholderText("输入新用户名"), "bad name!");
    await user.click(screen.getByRole("button", { name: "保存" }));

    expect(screen.getByText("用户名只能包含字母、数字和中文")).toBeInTheDocument();
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  test("合法修改：PATCH 只传 username 并同步 setAuth", async () => {
    const user = userEvent.setup();
    const mutateAsync = vi.fn().mockResolvedValue(undefined);
    mockUseUpdateProfile.mockReturnValue({ isPending: false, mutateAsync });

    renderWithQC(<UsernameEdit currentUsername="morenk" />);
    await user.click(screen.getByRole("button", { name: "修改用户名" }));
    await user.clear(screen.getByPlaceholderText("输入新用户名"));
    await user.type(screen.getByPlaceholderText("输入新用户名"), "newuser");
    await user.click(screen.getByRole("button", { name: "保存" }));

    expect(mutateAsync).toHaveBeenCalledWith({ username: "newuser" });
    expect(setAuth).toHaveBeenCalledWith(
      expect.objectContaining({ id: "u1", username: "newuser" }),
      "token-1",
    );
    expect(toast.success).toHaveBeenCalledWith("用户名已更新");
  });

  test("用户名冲突提示已被占用", async () => {
    const user = userEvent.setup();
    mockUseUpdateProfile.mockReturnValue({
      isPending: false,
      mutateAsync: vi.fn().mockRejectedValueOnce({ code: 409, message: "用户名已被占用" }),
    });

    renderWithQC(<UsernameEdit currentUsername="morenk" />);
    await user.click(screen.getByRole("button", { name: "修改用户名" }));
    await user.clear(screen.getByPlaceholderText("输入新用户名"));
    await user.type(screen.getByPlaceholderText("输入新用户名"), "taken");
    await user.click(screen.getByRole("button", { name: "保存" }));

    expect(screen.getByText("用户名已被占用")).toBeInTheDocument();
  });
});

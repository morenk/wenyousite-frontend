/** FloorForm 组件测试：3 种认证状态 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockUseAuth = vi.fn();
vi.mock("@/lib/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

const mockMutateAsync = vi.fn().mockResolvedValue({ id: "new-post" });
const mockCreatePost = vi.fn(() => ({
  mutateAsync: mockMutateAsync,
  isPending: false,
}));
vi.mock("@/api/hooks/use-create-post", () => ({
  useCreatePost: () => mockCreatePost(),
}));

const mockJoin = { mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false };
const mockExit = { mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false };
vi.mock("@/api/hooks/use-member-actions", () => ({
  useMemberActions: () => ({ join: mockJoin, exit: mockExit }),
}));

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual("@tanstack/react-query");
  return { ...actual, useQueryClient: () => ({ invalidateQueries: vi.fn().mockResolvedValue(undefined) }) };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import { FloorForm } from "@/components/thread/floor-form";

function renderWithQC(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("FloorForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => cleanup());

  test("未登录时显示登录提示", () => {
    mockUseAuth.mockReturnValue({ user: null, isInitialized: true });
    renderWithQC(
      <FloorForm subthreadId="s1" threadId="t1" isMember={false} />,
    );
    expect(screen.getByText("登录后即可参与讨论")).toBeInTheDocument();
    expect(screen.getByText("登录")).toBeInTheDocument();
  });

  test("已登录但未加入时显示加入按钮", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "u1", username: "test", emailVerified: true },
      isInitialized: true,
    });
    renderWithQC(
      <FloorForm subthreadId="s1" threadId="t1" isMember={false} />,
    );
    expect(
      screen.getByText("加入主题帖后即可参与讨论"),
    ).toBeInTheDocument();
    expect(screen.getByText("加入")).toBeInTheDocument();
  });

  test("已加入时显示输入框", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "u1", username: "test", emailVerified: true },
      isInitialized: true,
    });
    renderWithQC(
      <FloorForm subthreadId="s1" threadId="t1" isMember={true} />,
    );
    expect(
      screen.getByPlaceholderText("输入正文内容（支持 Markdown）..."),
    ).toBeInTheDocument();
  });

  test("输入框为空时发布按钮禁用", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "u1", username: "test", emailVerified: true },
      isInitialized: true,
    });
    renderWithQC(
      <FloorForm subthreadId="s1" threadId="t1" isMember={true} />,
    );
    const btns = screen.getAllByText("发布");
    const publishBtn = btns.find((el) => el.closest("button")?.hasAttribute("disabled"));
    expect(publishBtn).toBeInTheDocument();
  });
});

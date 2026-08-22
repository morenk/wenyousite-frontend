/** FloorForm 组件测试：登录即可发帖（发帖自动入候选池），错误码映射 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThreadComposerProvider } from "@/components/thread/thread-composer-context";

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
vi.mock("@/api/hooks/use-update-post", () => ({
  useUpdatePost: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock("@/api/hooks/use-upload-image", () => ({
  useUploadImage: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock("@/components/editor/milkdown-editor", () => ({
  MilkdownEditor: ({
    defaultValue,
    onChange,
    placeholder,
  }: {
    defaultValue?: string;
    onChange?: (v: string) => void;
    placeholder?: string;
  }) => (
    <textarea
      data-testid="milkdown-editor"
      defaultValue={defaultValue}
      placeholder={placeholder}
      onChange={(e) => onChange?.(e.target.value)}
    />
  ),
}));

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual("@tanstack/react-query");
  return { ...actual, useQueryClient: () => ({ invalidateQueries: vi.fn().mockResolvedValue(undefined) }) };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/threads/thread-1",
}));

import { toast } from "sonner";
import { FloorForm } from "@/components/thread/floor-form";
import { ReplyForm } from "@/components/thread/reply-form";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function renderWithQC(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ThreadComposerProvider>{ui}</ThreadComposerProvider>
    </QueryClientProvider>,
  );
}

const loggedInUser = { id: "u1", username: "test" };

describe("FloorForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMutateAsync.mockResolvedValue({ id: "new-post" });
  });

  afterEach(() => cleanup());

  test("未登录时显示登录提示", () => {
    mockUseAuth.mockReturnValue({ user: null, isInitialized: true });
    renderWithQC(
      <FloorForm subthreadId="s1" />,
    );
    expect(screen.getByText("登录后即可参与讨论")).toBeInTheDocument();
    expect(screen.getByText("登录")).toBeInTheDocument();
  });

  test("已登录仅显示轻量入口，点击后才挂载编辑器", async () => {
    const user = userEvent.setup();
    mockUseAuth.mockReturnValue({
      user: loggedInUser,
      isInitialized: true,
    });
    renderWithQC(
      <FloorForm subthreadId="s1" />,
    );
    expect(screen.queryByTestId("milkdown-editor")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "发表回复…" }));
    expect(screen.getAllByTestId("milkdown-editor")).toHaveLength(1);
    expect(screen.queryByText("加入")).toBeNull();
  });

  test("输入框为空时发布按钮禁用", async () => {
    mockUseAuth.mockReturnValue({
      user: loggedInUser,
      isInitialized: true,
    });
    renderWithQC(
      <FloorForm subthreadId="s1" />,
    );
    await userEvent.setup().click(screen.getByRole("button", { name: "发表回复…" }));
    expect(screen.getByRole("button", { name: "发布" })).toBeDisabled();
  });

  test("发布成功后清空输入框并提示", async () => {
    const user = userEvent.setup();
    mockUseAuth.mockReturnValue({ user: loggedInUser, isInitialized: true });
    renderWithQC(<FloorForm subthreadId="s1" />);

    await user.click(screen.getByRole("button", { name: "发表回复…" }));
    const textarea = screen.getByTestId("milkdown-editor");
    await user.type(textarea, "新的回复内容");
    await user.click(screen.getByText("发布"));

    expect(mockMutateAsync).toHaveBeenCalledWith({
      subthreadId: "s1",
      content: "新的回复内容",
      clientRequestId: expect.any(String),
    });
    expect(toast.success).toHaveBeenCalledWith("发布成功");
  });

  test("仅限玩家发帖时提示错误码 40303", async () => {
    const user = userEvent.setup();
    mockUseAuth.mockReturnValue({ user: loggedInUser, isInitialized: true });
    mockMutateAsync.mockRejectedValueOnce({
      code: 40303,
      message: "该子贴仅限玩家发帖",
    });
    renderWithQC(<FloorForm subthreadId="s1" />);

    await user.click(screen.getByRole("button", { name: "发表回复…" }));
    await user.type(screen.getByTestId("milkdown-editor"), "内容");
    await user.click(screen.getByText("发布"));

    expect(toast.error).toHaveBeenCalledWith("该子贴仅限玩家发帖");
  });

  test("仅限协作者发帖时提示错误码 40302", async () => {
    const user = userEvent.setup();
    mockUseAuth.mockReturnValue({ user: loggedInUser, isInitialized: true });
    mockMutateAsync.mockRejectedValueOnce({
      code: 40302,
      message: "该子贴仅限协作者发帖",
    });
    renderWithQC(<FloorForm subthreadId="s1" />);

    await user.click(screen.getByRole("button", { name: "发表回复…" }));
    await user.type(screen.getByTestId("milkdown-editor"), "内容");
    await user.click(screen.getByText("发布"));

    expect(toast.error).toHaveBeenCalledWith("该子贴仅限协作者发帖");
  });

  test("其他错误显示后端 message", async () => {
    const user = userEvent.setup();
    mockUseAuth.mockReturnValue({ user: loggedInUser, isInitialized: true });
    mockMutateAsync.mockRejectedValueOnce({ code: 40001, message: "内容不能为空" });
    renderWithQC(<FloorForm subthreadId="s1" />);

    await user.click(screen.getByRole("button", { name: "发表回复…" }));
    await user.type(screen.getByTestId("milkdown-editor"), "内容");
    await user.click(screen.getByText("发布"));

    expect(toast.error).toHaveBeenCalledWith("内容不能为空");
  });

  test("楼中楼入口复用相同挂载逻辑并保留回复会话参数", async () => {
    const user = userEvent.setup();
    mockUseAuth.mockReturnValue({ user: loggedInUser, isInitialized: true });
    renderWithQC(
      <ReplyForm
        subthreadId="s1"
        parentPostId="floor-1"
        replyToPostId="post-2"
        label="回复 tester"
      />,
    );

    expect(document.querySelector('[data-icon-semantic="action.reply"]')).not.toBeNull();
    await user.click(screen.getByRole("button", { name: "发表回复…" }));
    await user.type(screen.getByTestId("milkdown-editor"), "楼中楼回复");
    await user.click(screen.getByRole("button", { name: "回复" }));

    expect(mockMutateAsync).toHaveBeenCalledWith({
      subthreadId: "s1",
      content: "楼中楼回复",
      clientRequestId: expect.any(String),
      parentPostId: "floor-1",
      replyToPostId: "post-2",
    });
    expect(toast.success).toHaveBeenCalledWith("回复成功");
  });
});

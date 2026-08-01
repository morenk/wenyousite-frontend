/** ReplyForm 组件测试：楼中楼回复发布 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockMutateAsync = vi.fn().mockResolvedValue({ id: "reply-1" });
const mockCreatePost = vi.fn(() => ({
  mutateAsync: mockMutateAsync,
  isPending: false,
}));
vi.mock("@/api/hooks/use-create-post", () => ({
  useCreatePost: () => mockCreatePost(),
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
  return {
    ...actual,
    useQueryClient: () => ({ invalidateQueries: vi.fn().mockResolvedValue(undefined) }),
  };
});

import { toast } from "sonner";
import { ReplyForm } from "@/components/thread/reply-form";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function renderWithQC(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("ReplyForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMutateAsync.mockResolvedValue({ id: "reply-1" });
  });

  afterEach(() => cleanup());

  test("显示回复目标上下文", () => {
    renderWithQC(
      <ReplyForm subthreadId="s1" parentPostId="post-1" replyToLabel="#1 测试用户" />,
    );
    expect(screen.getByText("回复 #1 测试用户")).toBeInTheDocument();
  });

  test("发布楼中楼回复：带 parentPostId 与 replyToPostId", async () => {
    const user = userEvent.setup();
    const onReplied = vi.fn();
    renderWithQC(
      <ReplyForm subthreadId="s1" parentPostId="post-1" onReplied={onReplied} />,
    );

    await user.type(screen.getByTestId("milkdown-editor"), "楼中楼内容");
    await user.click(screen.getByRole("button", { name: "回复" }));

    expect(mockMutateAsync).toHaveBeenCalledWith({
      subthreadId: "s1",
      content: "楼中楼内容",
      parentPostId: "post-1",
      replyToPostId: "post-1",
    });
    expect(toast.success).toHaveBeenCalledWith("回复成功");
    expect(onReplied).toHaveBeenCalled();
  });

  test("内容为空时回复按钮禁用", () => {
    renderWithQC(<ReplyForm subthreadId="s1" parentPostId="post-1" />);
    expect(screen.getByRole("button", { name: "回复" })).toBeDisabled();
  });

  test("错误码 40303 提示玩家限制", async () => {
    const user = userEvent.setup();
    mockMutateAsync.mockRejectedValueOnce({ code: 40303, message: "该子贴仅限玩家发帖" });
    renderWithQC(<ReplyForm subthreadId="s1" parentPostId="post-1" />);

    await user.type(screen.getByTestId("milkdown-editor"), "内容");
    await user.click(screen.getByRole("button", { name: "回复" }));

    expect(toast.error).toHaveBeenCalledWith("该子贴仅限玩家发帖");
  });
});

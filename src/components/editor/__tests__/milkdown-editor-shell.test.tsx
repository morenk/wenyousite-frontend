import { createRef, useImperativeHandle } from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, test, vi } from "vitest";
import { MilkdownEditor } from "../milkdown-editor-core";
import type { MilkdownEditorHostProps } from "../milkdown-editor-host";
import type { EditorSubmissionHandle } from "../use-editor-submission";

const state = vi.hoisted(() => ({ uploading: false, composing: false }));
vi.mock("@/api/hooks/use-api-meta", () => ({ useApiMeta: () => ({ data: { markdownContractVersion: 5 } }) }));
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("@/api/hooks/use-save-draft", () => ({ useSaveDraft: () => ({ mutateAsync: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
vi.mock("../milkdown-editor-host", () => ({ MilkdownEditorHost: function Host(props: MilkdownEditorHostProps) {
  useImperativeHandle(props.editorRef, () => ({ flush: () => "正文", isComposing: () => state.composing, hasPendingUpload: () => state.uploading }));
  return <div data-slot="milkdown-editor-footer-status" />;
} }));
afterEach(() => { cleanup(); state.uploading = false; state.composing = false; });

test("上下文插槽与编辑宿主共用外框，位于宿主之前且缺省不占位", () => {
  const client = new QueryClient();
  const view = render(<QueryClientProvider client={client}><MilkdownEditor headerContent={<span>回复 #32 玛利亚</span>} /></QueryClientProvider>);
  const header = view.container.querySelector('[data-slot="milkdown-editor-header"]');
  expect(header).toHaveTextContent("回复 #32 玛利亚");
  expect(header?.nextElementSibling).toHaveAttribute("data-slot", "milkdown-editor-footer-status");
  view.rerender(<QueryClientProvider client={client}><MilkdownEditor /></QueryClientProvider>);
  expect(view.container.querySelector('[data-slot="milkdown-editor-header"]')).toBeNull();
});

test("共享页脚把业务操作放在字数右侧，可关闭高度调节", async () => {
  const view = render(<QueryClientProvider client={new QueryClient()}><MilkdownEditor defaultValue="正文" footerActions={<button>发布</button>} resizable={false} /></QueryClientProvider>);
  const action = await screen.findByRole("button", { name: "发布" });
  expect(action.previousElementSibling).toHaveTextContent("2/10000");
  expect(view.container.querySelector('[data-slot="milkdown-editor-footer-status"]')).toContainElement(action);
  expect(screen.queryByRole("separator", { name: "调整编辑器高度" })).not.toBeInTheDocument();
});
test("外部关闭与保存共用组词、音频上传保护，完成后才能离开", async () => {
  const ref = createRef<EditorSubmissionHandle>();
  render(<QueryClientProvider client={new QueryClient()}><MilkdownEditor defaultValue="正文" editorRef={ref} /></QueryClientProvider>);
  await waitFor(() => expect(ref.current?.canClose?.()).toBe(true));
  state.uploading = true;
  expect(ref.current?.canClose?.()).toBe(false);
  expect(ref.current?.flush()).toBeNull();
  state.uploading = false; state.composing = true;
  expect(ref.current?.canClose?.()).toBe(false);
  expect(ref.current?.flush()).toBeNull();
  state.composing = false;
  expect(ref.current?.canClose?.()).toBe(true);
  expect(ref.current?.flush()).toBe("正文");
});

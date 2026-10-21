import { createRef } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterAll, afterEach, expect, test, vi } from "vitest";
import { MarkdownContent, renderPostBody } from "../markdown-content";
import { TextFontEnvironment } from "@/components/editor/use-visible-text-fonts";
import { ThreadFontRuntime, type ThreadFontCatalog } from "@/lib/thread-font-runtime";
import { MilkdownEditor } from "@/components/editor/milkdown-editor-core";
import type { EditorSubmissionHandle } from "@/components/editor/use-editor-submission";
import type { PostDetail } from "@/api/hooks/use-post";
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("@/api/hooks/use-save-draft", () => ({ useSaveDraft: () => ({ mutateAsync: vi.fn() }) }));
vi.mock("@/api/hooks/use-api-meta", () => ({ useApiMeta: () => ({ data: { markdownContractVersion: 5, capabilities: { textFontV1Supported: true, textFontV1WriteEnabled: true, textColorV1Supported: true, textColorV1WriteEnabled: true } } }) }));
const source = '<span data-wenyou-font-v1="great-vibes" data-wenyou-color-v1="#D14343">**ABC**</span>';
function environment() {
 vi.stubGlobal("IntersectionObserver", undefined);
 const runtime = new ThreadFontRuntime();
 const load = vi.spyOn(runtime, "load").mockResolvedValue({ family: '"WYF1-test", system-ui', status: "ready" });
 return { load, value: { runtime, catalog: {} as ThreadFontCatalog } };
}
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
afterAll(async () => { await new Promise(resolve => setTimeout(resolve, 3100)); });
test.each(["reading", "compact"] as const)("共享%s阅读器默认无字体标记/字库请求，文字颜色粗体保留", async size => {
 const env = environment();
 const { container } = render(<TextFontEnvironment.Provider value={env.value}><MarkdownContent content={source} size={size}/></TextFontEnvironment.Provider>);
 await act(async () => {});
 expect(container).toHaveTextContent("ABC"); expect(container.querySelector("strong")).toHaveTextContent("ABC");
 expect(container.querySelector('[data-wenyou-color-v1="#D14343"]')).not.toBeNull();
 expect(container.querySelector("[data-wenyou-font-v1], [style*='font-family']")).toBeNull(); expect(env.load).not.toHaveBeenCalled();
 expect(source).toContain('data-wenyou-font-v1="great-vibes"');
});
test("主题完整正文显式开启后自动加载；失败也不添加阅读提示或操作", async () => {
 const env = environment(); env.load.mockResolvedValue({ family: "system-ui", status: "fallback" });
 const { container } = render(<TextFontEnvironment.Provider value={env.value}><MarkdownContent allowTextFont content={source}/></TextFontEnvironment.Provider>);
 await waitFor(() => expect(container.querySelector("[data-wenyou-font-v1]")).toHaveAttribute("data-font-load", "fallback"));
 expect(env.load).toHaveBeenCalledTimes(1); expect(container).toHaveTextContent("ABC");
 expect(screen.queryByRole("status")).toBeNull(); expect(screen.queryByRole("alert")).toBeNull(); expect(screen.queryByRole("button")).toBeNull();
});
test("身份资料弹层复用renderPostBody默认回退，不借来源帖子启用字体", async () => {
 const env = environment();
 const { container } = render(<TextFontEnvironment.Provider value={env.value}>{renderPostBody({ id: "post", content: source } as PostDetail)}</TextFontEnvironment.Provider>);
 await act(async () => {}); expect(container).toHaveTextContent("ABC");
 expect(container.querySelector("[data-wenyou-font-v1]")).toBeNull(); expect(env.load).not.toHaveBeenCalled();
});
test("通用编辑器预置字体也不激活；作用域关闭时站内粘贴仅去字体，原文仍可保源", async () => {
 const env = environment(), ref = createRef<EditorSubmissionHandle>();
 const { container } = render(<QueryClientProvider client={new QueryClient()}><TextFontEnvironment.Provider value={env.value}><MilkdownEditor defaultValue={source} editorRef={ref} ariaLabel="通用正文"/></TextFontEnvironment.Provider></QueryClientProvider>);
 const editor = await screen.findByRole("textbox", { name: "通用正文" });
 await waitFor(() => expect(ref.current?.flush()).toContain('data-wenyou-font-v1="great-vibes"'));
 expect(editor).toHaveTextContent("ABC"); expect(container.querySelector("[data-wenyou-font-v1], [style*='--wenyou-content-font']")).toBeNull(); expect(env.load).not.toHaveBeenCalled();
 fireEvent.paste(editor, { clipboardData: { files: [], types: ["text/html"], getData: (type: string) => type === "text/html" ? '<div data-wenyou-clipboard="2" data-wenyou-clipboard-source="reader"><p><span data-wenyou-font-v1="wenkai" data-wenyou-color-v1="#2563EB"><strong>新字</strong></span></p></div>' : "新字" } });
 const saved = ref.current?.flush(); expect(saved).toContain("新字"); expect(saved).toContain('data-wenyou-color-v1="#2563EB"'); expect(saved).not.toContain('data-wenyou-font-v1="wenkai"'); expect(env.load).not.toHaveBeenCalled();
});

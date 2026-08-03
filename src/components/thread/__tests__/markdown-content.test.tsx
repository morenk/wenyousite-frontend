/** MarkdownContent 组件测试：图片约束尺寸、中图替换、lightbox 交互 */

import { describe, test, expect, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MarkdownContent } from "@/components/thread/markdown-content";

afterEach(() => cleanup());

const UPLOADED_URL =
  "https://cos.example.com/wenyou/uploads/2026/01/01/u1/123-abc.jpg";
const UPLOADED_MD_URL = UPLOADED_URL.replace(/\.jpg$/, "_md.webp");
const EXTERNAL_URL = "https://example.com/pic.png";

describe("MarkdownContent", () => {
  test("渲染普通 markdown 文本", () => {
    render(<MarkdownContent content={"# 标题\n\n正文内容"} />);
    expect(screen.getByRole("heading", { name: "标题" })).toBeInTheDocument();
    expect(screen.getByText("正文内容")).toBeInTheDocument();
  });

  test("空 URL 图片不渲染破图", () => {
    render(<MarkdownContent content={"![1.00]()"} />);
    expect(screen.queryByRole("img")).toBeNull();
  });

  test("本站上传图渲染为中图并带尺寸约束与懒加载", () => {
    render(<MarkdownContent content={`![测试图](${UPLOADED_URL})`} />);
    const img = screen.getByRole("img", { name: "测试图" });
    expect(img).toHaveAttribute("src", UPLOADED_MD_URL);
    expect(img).toHaveAttribute("loading", "lazy");
    expect(img).toHaveAttribute("class", expect.stringContaining("max-w-full"));
    expect(img).toHaveAttribute(
      "style",
      expect.stringContaining("max-width: 100%"),
    );
    expect(img).toHaveAttribute(
      "style",
      expect.stringContaining("max-height: 50vh"),
    );
  });

  test("站外图片保持原 URL，不做中图替换", () => {
    render(<MarkdownContent content={`![外部图](${EXTERNAL_URL})`} />);
    const img = screen.getByRole("img", { name: "外部图" });
    expect(img).toHaveAttribute("src", EXTERNAL_URL);
    expect(img).toHaveAttribute("class", expect.stringContaining("max-w-full"));
  });

  test("SVG 上传图不替换为中图", () => {
    const svgUrl =
      "https://cos.example.com/wenyou/uploads/2026/01/01/u1/icon.svg";
    render(<MarkdownContent content={`![图标](${svgUrl})`} />);
    expect(screen.getByRole("img", { name: "图标" })).toHaveAttribute(
      "src",
      svgUrl,
    );
  });

  test("中图加载失败时回退到原图", async () => {
    render(<MarkdownContent content={`![测试图](${UPLOADED_URL})`} />);
    const img = screen.getByRole("img", { name: "测试图" });
    expect(img).toHaveAttribute("src", UPLOADED_MD_URL);
    fireEvent.error(img);
    expect(await screen.findByRole("img", { name: "测试图" })).toHaveAttribute(
      "src",
      UPLOADED_URL,
    );
  });

  test("点击图片打开原图 lightbox，再点击遮罩关闭", async () => {
    const user = userEvent.setup();
    render(<MarkdownContent content={`![测试图](${UPLOADED_URL})`} />);
    await user.click(screen.getByRole("img", { name: "测试图" }));

    const dialog = screen.getByRole("dialog", { name: "查看原图" });
    expect(dialog).toBeInTheDocument();
    const lightboxImg = within(dialog).getByRole("img", { name: "测试图" });
    expect(lightboxImg).toHaveAttribute("src", UPLOADED_URL);

    await user.click(dialog);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("按 Esc 键关闭 lightbox", async () => {
    const user = userEvent.setup();
    render(<MarkdownContent content={`![测试图](${UPLOADED_URL})`} />);
    await user.click(screen.getByRole("img", { name: "测试图" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

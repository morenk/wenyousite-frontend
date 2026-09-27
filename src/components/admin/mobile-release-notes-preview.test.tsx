import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { afterEach, describe, expect, it } from "vitest";
import { MobileReleaseNotesFields } from "./mobile-release-notes-fields";
import { releaseNotesLines, type MobileReleaseFormValues } from "@/lib/mobile-release-form";
import { MobileReleaseNotesPreview } from "./mobile-release-notes-preview";

const identity = { platform: "Android", version: "1.2.0", build: 42 };

describe("移动端版本说明纯文本预览", () => {
  afterEach(cleanup);
  it("HTML、Markdown 和链接保持文字，重复条目仍逐条展示", () => {
    const view = render(<MobileReleaseNotesPreview identity={identity} summary="**更新摘要**" items={['<img src=x onerror="alert(1)">', "[下载](https://example.com)", "改进阅读", "改进阅读"]} />);
    expect(screen.getByRole("heading", { name: "草稿预览" })).toBeInTheDocument();
    expect(screen.getByText("1.2.0")).toBeInTheDocument();
    expect(screen.getByText("Android · 构建 42")).toBeInTheDocument();
    expect(screen.getByText("**更新摘要**")).toBeInTheDocument();
    expect(screen.getByText('<img src=x onerror="alert(1)">')).toBeInTheDocument();
    expect(screen.getByText("[下载](https://example.com)")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
    expect(view.container.querySelector("img, a, strong, script")).toBeNull();
  });

  it("未填写时提供明确空态", () => {
    render(<MobileReleaseNotesPreview identity={identity} summary=" " items={[]} />);
    expect(screen.getByText("尚未填写摘要")).toBeInTheDocument();
    expect(screen.getByText("尚未填写更新内容")).toBeInTheDocument();
  });

  it("多行输入清理空行与首尾空白，保留文字和顺序", () => {
    expect(releaseNotesLines("  第一条\r\n\r\n第二条\r第三条\n - 原样符号 ")).toEqual(["第一条", "第二条", "第三条", "- 原样符号"]);
  });

  function Form({ disabled = false }: { disabled?: boolean }) {
    const form = useForm<MobileReleaseFormValues>({ defaultValues: { versionName: "1.2.0", buildNumber: 42, summary: "原摘要", itemsText: "原条目" } });
    return <MobileReleaseNotesFields form={form} identity={identity} disabled={disabled} />;
  }

  it("输入即时预览，禁用期间保留原输入", () => {
    const view = render(<Form />);
    fireEvent.change(screen.getByLabelText("更新摘要"), { target: { value: "新摘要" } });
    fireEvent.change(screen.getByLabelText("逐条更新内容"), { target: { value: "第一项\n\n第二项" } });
    const preview = within(screen.getByRole("region", { name: "草稿预览" }));
    expect(preview.getByText("新摘要")).toBeInTheDocument();
    expect(preview.getAllByRole("listitem")).toHaveLength(2);
    view.rerender(<Form disabled />);
    expect(screen.getByLabelText("更新摘要")).toBeDisabled();
    expect(screen.getByLabelText("更新摘要")).toHaveValue("新摘要");
    expect(screen.getByLabelText("逐条更新内容")).toBeDisabled();
    expect(screen.getByLabelText("逐条更新内容")).toHaveValue("第一项\n\n第二项");
  });
});

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { InternalReferenceEditor } from "@/components/shared/internal-reference-editor";

const INVITE_URL = "https://wenyou.site/join/AbCdEfGh_123-XYZ";

function clipboardData(text: string) {
  return { getData: (type: string) => type === "text/plain" ? text : "" };
}

function selectEditorContents(editor: HTMLElement) {
  editor.focus();
  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(editor);
  selection?.removeAllRanges();
  selection?.addRange(range);
  document.dispatchEvent(new Event("selectionchange"));
}

afterEach(cleanup);

describe("InternalReferenceEditor", () => {
  test("ZWJ与组合字符按码点而非视觉字符计数且粘贴位置正确", () => {
    const onChange = vi.fn();
    const onLimitExceeded = vi.fn();
    render(<InternalReferenceEditor value="" onChange={onChange} onLimitExceeded={onLimitExceeded} maxLength={5} ariaLabel="评论内容" />);
    const editor = screen.getByRole("textbox", { name: "评论内容" });
    // 女程序员3个码点，组合重音2个码点；光标位置仍交给ProseMirror按UTF16管理。
    fireEvent.paste(editor, { clipboardData: clipboardData("👩‍💻é") });
    expect(onChange).toHaveBeenLastCalledWith("👩‍💻é");
    fireEvent.paste(editor, { clipboardData: clipboardData("x") });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onLimitExceeded).toHaveBeenCalled();
    expect(editor).toHaveTextContent("👩‍💻é");
  });

  test("Unicode码点边界接受完整emoji并拒绝超限粘贴", () => {
    const onChange = vi.fn();
    const onLimitExceeded = vi.fn();
    render(<InternalReferenceEditor value="" onChange={onChange} onLimitExceeded={onLimitExceeded} maxLength={2} ariaLabel="评论内容" />);
    const editor = screen.getByRole("textbox", { name: "评论内容" });
    fireEvent.paste(editor, { clipboardData: clipboardData("😀😀") });
    expect(onChange).toHaveBeenLastCalledWith("😀😀");
    fireEvent.paste(editor, { clipboardData: clipboardData("😀") });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onLimitExceeded).toHaveBeenCalled();
  });

  test("既有显式和裸链接在编辑态显示传送门且不改写原值", () => {
    const onChange = vi.fn();
    render(
      <InternalReferenceEditor
        value={`命名 [邀请入口](/join/AbCdEfGh_123-XYZ) 裸链 ${INVITE_URL}`}
        onChange={onChange}
        maxLength={1000}
        ariaLabel="动态正文"
      />,
    );

    const portals = document.querySelectorAll('[data-slot="internal-reference-link"]');
    expect(portals).toHaveLength(2);
    expect(portals[0]).toHaveTextContent("邀请入口");
    expect(portals[1]).toHaveTextContent("传送门");
    expect(onChange).not.toHaveBeenCalled();
  });

  test("单独粘贴邀请链接立即写入并显示规范传送门", async () => {
    const onChange = vi.fn();
    render(
      <InternalReferenceEditor
        value=""
        onChange={onChange}
        maxLength={1000}
        ariaLabel="动态正文"
      />,
    );
    const editor = screen.getByRole("textbox", { name: "动态正文" });

    fireEvent.paste(editor, { clipboardData: clipboardData(INVITE_URL) });

    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith(
      "[传送门](/join/AbCdEfGh_123-XYZ)",
    ));
    const portal = document.querySelector<HTMLAnchorElement>('[data-slot="internal-reference-link"]');
    expect(portal).toHaveAttribute("href", "/join/AbCdEfGh_123-XYZ");
    expect(portal).toHaveAccessibleName(/站内传送门：\s*传送门/u);
    expect(fireEvent.click(portal!)).toBe(false);
  });

  test("单独粘贴站内链接时沿用当前选择文字作为名称", async () => {
    const onChange = vi.fn();
    render(
      <InternalReferenceEditor
        value="私密团入口"
        onChange={onChange}
        maxLength={1000}
        ariaLabel="动态正文"
      />,
    );
    const editor = screen.getByRole("textbox", { name: "动态正文" });
    selectEditorContents(editor);

    fireEvent.paste(editor, { clipboardData: clipboardData(INVITE_URL) });

    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith(
      "[私密团入口](/join/AbCdEfGh_123-XYZ)",
    ));
    expect(document.querySelector('[data-slot="internal-reference-link"]'))
      .toHaveTextContent("私密团入口");
  });

  test("混合文本和站外链接按纯文本粘贴", () => {
    const onChange = vi.fn();
    render(
      <InternalReferenceEditor
        value=""
        onChange={onChange}
        maxLength={1000}
        ariaLabel="动态正文"
      />,
    );
    const editor = screen.getByRole("textbox", { name: "动态正文" });
    const pasted = `说明 ${INVITE_URL} 与 https://example.com`;

    fireEvent.paste(editor, { clipboardData: clipboardData(pasted) });

    expect(onChange).toHaveBeenLastCalledWith(pasted);
    expect(document.querySelector('[data-slot="internal-reference-link"]')).toBeNull();
  });

  test("普通输入保持字面文本并服从长度限制", async () => {
    const onChange = vi.fn();
    const onLimitExceeded = vi.fn();
    render(
      <InternalReferenceEditor
        value=""
        onChange={onChange}
        onLimitExceeded={onLimitExceeded}
        maxLength={4}
        ariaLabel="评论内容"
      />,
    );
    const editor = screen.getByRole("textbox", { name: "评论内容" });

    await userEvent.setup().type(editor, "**文本**");

    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls.at(-1)?.[0].length).toBeLessThanOrEqual(4);
    expect(onLimitExceeded).toHaveBeenCalled();
    expect(editor.querySelector("strong")).toBeNull();
  });
});

test("主题站内载体粘入动态只保留文字、换行及合法传送门，移除字体和不支持格式", () => {
 const onChange = vi.fn();
 render(<InternalReferenceEditor value="" onChange={onChange} maxLength={1000} ariaLabel="动态正文"/>);
 const editor = screen.getByRole("textbox", { name: "动态正文" });
 const html = '<div data-wenyou-clipboard="2" data-wenyou-clipboard-source="reader"><p><span data-wenyou-font-v1="wenkai" data-wenyou-color-v1="#D14343"><strong>正文</strong> <a href="/join/AbCdEfGh_123-XYZ">入团</a> <a href="https://example.com">外链</a></span></p><p>第二段<br>换行</p></div>';
 fireEvent.paste(editor, { clipboardData: { getData: (type: string) => type === "text/html" ? html : "正文 入团 外链\n\n第二段\n换行" } });
 expect(onChange).toHaveBeenLastCalledWith("正文 [入团](/join/AbCdEfGh_123-XYZ) 外链\n\n第二段\n换行");
 expect(editor.querySelectorAll("a")).toHaveLength(1);
 expect(editor.querySelector("a")).toHaveAttribute("href", "/join/AbCdEfGh_123-XYZ");
 expect(editor.querySelector("[data-wenyou-font-v1], [data-wenyou-color-v1], strong, em")).toBeNull();
});

test("动态拒绝超长站内投影，保留原文；外部字体HTML不激活字库或外链", () => {
 const onChange = vi.fn(), onLimitExceeded = vi.fn();
 render(<InternalReferenceEditor value="原文" onChange={onChange} onLimitExceeded={onLimitExceeded} maxLength={4} ariaLabel="动态正文"/>);
 const editor = screen.getByRole("textbox", { name: "动态正文" });
 fireEvent.paste(editor, { clipboardData: { getData: (type: string) => type === "text/html" ? '<div data-wenyou-clipboard="2" data-wenyou-clipboard-source="reader"><p><a href="/join/AbCdEfGh_123-XYZ">过长</a></p></div>' : "过长" } });
 expect(onChange).not.toHaveBeenCalled(); expect(onLimitExceeded).toHaveBeenCalled(); expect(editor).toHaveTextContent("原文");
 fireEvent.paste(editor, { clipboardData: { getData: (type: string) => type === "text/html" ? '<span style="font-family:evil">字</span>' : "字" } });
 expect(editor).toHaveTextContent("字原文"); expect(editor.querySelector("[style], [data-wenyou-font-v1], a")).toBeNull();
});

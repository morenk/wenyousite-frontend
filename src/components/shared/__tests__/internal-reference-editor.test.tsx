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

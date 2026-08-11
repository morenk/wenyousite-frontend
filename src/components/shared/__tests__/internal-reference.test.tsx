import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { InternalReferenceInsert } from "@/components/shared/internal-reference-insert";
import { InternalReferenceText } from "@/components/shared/internal-reference-text";

afterEach(cleanup);

describe("站内传送门共享组件", () => {
  test("纯文本只激活站内坐标，其他 Markdown 与外链保持字面内容", () => {
    const threadId = "cmsewdo0h000x7qv6aa77ll1v";
    render(
      <p>
        <InternalReferenceText
          content={`[设定 A](/threads/${threadId}) **原样** [外链](https://example.com)`}
        />
      </p>,
    );

    expect(screen.getByRole("link", { name: "站内传送门：设定 A" })).toHaveAttribute(
      "href",
      `/threads/${threadId}`,
    );
    expect(screen.getByText(/\*\*原样\*\*/u)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "外链" })).toBeNull();
  });

  test("构造器校验并写回命名的相对规范地址", async () => {
    const user = userEvent.setup();
    const onInsert = vi.fn();
    render(
      <InternalReferenceInsert
        getSuggestedLabel={() => "设定 A"}
        onInsert={onInsert}
      />,
    );

    await user.click(screen.getByRole("button", { name: "传送门" }));
    expect(screen.getByRole("textbox", { name: "显示名称" })).toHaveValue("设定 A");
    await user.type(
      screen.getByRole("textbox", { name: "站内链接" }),
      "https://wenyou.site/threads/cmsewdo0h000x7qv6aa77ll1v?subthread=cmsewdp4i00147qv6gjc85l9p",
    );
    await user.click(screen.getByRole("button", { name: "插入" }));

    expect(onInsert).toHaveBeenCalledWith(
      "[设定 A](/threads/cmsewdo0h000x7qv6aa77ll1v?subthread=cmsewdp4i00147qv6gjc85l9p)",
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("构造器拒绝站外链接", async () => {
    const user = userEvent.setup();
    render(<InternalReferenceInsert onInsert={() => {}} />);

    await user.click(screen.getByRole("button", { name: "传送门" }));
    await user.type(screen.getByRole("textbox", { name: "显示名称" }), "站外");
    await user.type(screen.getByRole("textbox", { name: "站内链接" }), "https://example.com/a");
    await user.click(screen.getByRole("button", { name: "插入" }));

    expect(await screen.findByText("仅支持主题帖、子贴、楼层或回复链接")).toBeInTheDocument();
  });
});

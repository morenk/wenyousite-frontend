import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { TextFontOrderEditor, type FontOrderItem } from "../text-font-order-editor";
afterEach(cleanup);
const items: FontOrderItem[] = [{ id: "b", name: "乙字体", language: "zh" }, { id: "x", name: "英文体", language: "en" }, { id: "a", name: "甲字体", language: "zh" }];
test("同语言置顶与键盘移动不改变其他语言位置，保存前不写入", async () => {
  const onSave = vi.fn().mockResolvedValue(undefined);
  render(<TextFontOrderEditor items={items} onSave={onSave} onCancel={vi.fn()} onReload={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "甲字体置顶" }));
  expect(within(screen.getByRole("region", { name: "中文展示顺序" })).getAllByRole("listitem")[0]).toHaveTextContent("甲字体");
  expect(onSave).not.toHaveBeenCalled();
  fireEvent.keyDown(screen.getByRole("button", { name: "甲字体下移" }), { key: "ArrowDown", altKey: true });
  expect(screen.getByRole("button", { name: "保存顺序" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "甲字体上移" }));
  fireEvent.click(screen.getByRole("button", { name: "保存顺序" }));
  await waitFor(() => expect(onSave).toHaveBeenCalledWith([items[2], items[1], items[0]]));
});
test("冲突保留本地顺序并禁止覆盖，允许读取最新目录", () => {
  const onReload = vi.fn();
  render(<TextFontOrderEditor items={items} conflict onSave={vi.fn()} onCancel={vi.fn()} onReload={onReload} />);
  expect(screen.getByRole("alert")).toHaveTextContent("目录已更新");
  expect(screen.getByRole("button", { name: "甲字体置顶" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "读取最新顺序" }));
  expect(onReload).toHaveBeenCalledOnce();
});
test("只显示有可选字体的语言组，全空只保留一个空态", () => {
  const props = { onSave: vi.fn(), onCancel: vi.fn(), onReload: vi.fn() };
  const view = render(<TextFontOrderEditor {...props} items={items} />);
  expect(screen.queryByRole("region", { name: "日文展示顺序" })).not.toBeInTheDocument();
  expect(screen.queryByRole("region", { name: "未分类展示顺序" })).not.toBeInTheDocument();
  view.unmount(); render(<TextFontOrderEditor {...props} items={[]} />);
  expect(screen.getAllByText("暂无可选字体")).toHaveLength(1);
});

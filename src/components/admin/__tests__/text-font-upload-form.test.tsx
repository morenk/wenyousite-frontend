import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { TextFontUploadForm } from "../text-font-upload-form";
afterEach(cleanup);
const select = (name = "新字体.otf", size = 4) => {
  const file = new File([new Uint8Array(size)], name);
  fireEvent.change(screen.getByLabelText("字体文件"), { target: { files: [file] } });
  return file;
};
test("新上传只显示三字段，文件名预填且手改后不被重新选择覆盖", async () => {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  render(<TextFontUploadForm onSubmit={onSubmit} />);
  expect(screen.getByRole("combobox", { name: "语言" })).toHaveTextContent("未分类");
  expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("作者")).not.toBeInTheDocument();
  select("冬日风.TTF");
  await waitFor(() => expect(screen.getByLabelText("字体名称")).toHaveValue("冬日风"));
  fireEvent.change(screen.getByLabelText("字体名称"), { target: { value: "自定名称" } });
  const file = select("新文件.otf");
  expect(screen.getByLabelText("字体名称")).toHaveValue("自定名称");
  fireEvent.click(screen.getByRole("button", { name: "上传并处理" }));
  await waitFor(() => expect(onSubmit).toHaveBeenCalledExactlyOnceWith({ file, name: "自定名称", language: "other" }));
});
test("非法文件就近反馈，阻止调用；重新挂载要求重新选择文件", async () => {
  const onSubmit = vi.fn();
  const view = render(<TextFontUploadForm existing={{ name: "原名称", language: "ja" }} onSubmit={onSubmit} />);
  select("wrong.zip");
  expect(await screen.findByRole("alert")).toHaveTextContent("TTF 或 OTF");
  fireEvent.click(screen.getByRole("button", { name: "上传并处理" }));
  await waitFor(() => expect(onSubmit).not.toHaveBeenCalled());
  view.unmount();
  render(<TextFontUploadForm existing={{ name: "原名称", language: "ja" }} onSubmit={onSubmit} />);
  fireEvent.click(screen.getByRole("button", { name: "上传并处理" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("请选择字体文件");
  expect(screen.queryByLabelText("字体名称")).not.toBeInTheDocument();
});
test("重复点击只编排一次，失败保留文件；新版本沿用名称与语言", async () => {
  let reject!: (reason: Error) => void;
  const onSubmit = vi.fn(() => new Promise<void>((_, fail) => { reject = fail; }));
  render(<TextFontUploadForm existing={{ name: "已有字体", language: "en" }} onSubmit={onSubmit} />);
  const file = select();
  const button = screen.getByRole("button", { name: "上传并处理" });
  fireEvent.click(button); fireEvent.click(button);
  await waitFor(() => expect(onSubmit).toHaveBeenCalledExactlyOnceWith({ file, name: "已有字体", language: "en" }));
  expect(screen.getByRole("button", { name: "上传并处理" })).toBeDisabled();
  await act(async () => reject(new Error("连接中断")));
  expect(await screen.findByRole("alert")).toBeVisible();
  expect((screen.getByLabelText("字体文件") as HTMLInputElement).files?.[0]).toBe(file);
});
test("只展示传入的实际字节进度，处理中不伪造百分比", () => {
  const props = { existing: { name: "字体", language: "zh" as const }, onSubmit: vi.fn() };
  const view = render(<TextFontUploadForm {...props} progress={{ phase: "uploading", loaded: 1048576, total: 4194304 }} />);
  expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "25");
  expect(screen.getByRole("status")).toHaveTextContent("25% · 1.0 / 4.0 MiB");
  view.rerender(<TextFontUploadForm {...props} progress={{ phase: "processing" }} />);
  expect(screen.getByRole("progressbar")).not.toHaveAttribute("aria-valuenow");
});

test("已有字体资料保存后提交最新名称语言，保留已选文件", async () => {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  const view = render(<TextFontUploadForm existing={{ name: "旧名", language: "zh" }} onSubmit={onSubmit} />);
  const file = select();
  view.rerender(<TextFontUploadForm existing={{ name: "已保存的新名", language: "en" }} onSubmit={onSubmit} />);
  fireEvent.click(screen.getByRole("button", { name: "上传并处理" }));
  await waitFor(() => expect(onSubmit).toHaveBeenCalledExactlyOnceWith({ file, name: "已保存的新名", language: "en" }));
});

test("服务端名称错误定位原控件并保留文件", async () => {
  render(<TextFontUploadForm onSubmit={vi.fn().mockRejectedValue({ code: 40001, message: "name 已超长" })} />);
  const file = select(); fireEvent.click(screen.getByRole("button", { name: "上传并处理" }));
  await waitFor(() => expect(screen.getByLabelText("字体名称")).toHaveAttribute("aria-invalid", "true"));
  expect((screen.getByLabelText("字体文件") as HTMLInputElement).files?.[0]).toBe(file);
});

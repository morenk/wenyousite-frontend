import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ImageUploadProgress } from "@/components/shared/image-upload-progress";

afterEach(cleanup);

describe("ImageUploadProgress", () => {
  test("展示真实字节、百分比与无障碍进度值", () => {
    render(
      <ImageUploadProgress
        progress={{
          stage: "uploading",
          loadedBytes: 2.5 * 1024 * 1024,
          totalBytes: 5 * 1024 * 1024,
          percent: 50,
        }}
      />,
    );

    expect(screen.getByText("2.5 MB / 5.0 MB")).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "正在上传图片" })).toHaveAttribute(
      "aria-valuenow",
      "50",
    );
  });

  test("准备阶段使用不定进度并允许取消", () => {
    const onCancel = vi.fn();
    render(
      <ImageUploadProgress
        progress={{
          stage: "preparing",
          loadedBytes: null,
          totalBytes: null,
          percent: null,
        }}
        onCancel={onCancel}
      />,
    );

    expect(screen.getByRole("progressbar", { name: "正在准备图片" })).not.toHaveAttribute(
      "aria-valuenow",
    );
    fireEvent.click(screen.getByRole("button", { name: "取消" }));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});

test("已传完字节仍须服务端确认，处理阶段不报告任务已完成", () => {
  render(<ImageUploadProgress progress={{ stage: "processing", loadedBytes: 1024, totalBytes: 1024, percent: 100 }} />);
  expect(screen.getByRole("progressbar", { name: "上传完成，正在处理图片" })).not.toHaveAttribute("aria-valuenow");
  expect(screen.queryByText("100%")).not.toBeInTheDocument();
});

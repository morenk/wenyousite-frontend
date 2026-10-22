import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { DynamicFontSpecimen } from "../dynamic-font-specimen";
import { FontResourceError } from "@/lib/thread-font-assets";
import type { DynamicFontDescriptor } from "@/lib/dynamic-text-font-state";
const specimen = vi.hoisted(() => vi.fn());
vi.mock("@/lib/dynamic-text-font-runtime", () => ({
  dynamicTextFontRuntime: () => ({ specimen }),
}));
const descriptor: DynamicFontDescriptor = {
  fontVersion: 2,
  versionId: "tfv_" + "a".repeat(32),
  familyId: "tff_" + "a".repeat(32),
  versionNumber: 1,
  name: "测试",
  designLanguage: "zh",
  revision: 1,
  status: "preview",
  selectable: false,
  pasteAllowed: false,
  renderAllowed: true,
  assetBasePath:
    "/api/v1/admin/text-fonts/versions/tfv_" + "a".repeat(32) + "/assets/",
  manifest: { sha256: "b".repeat(64), bytes: 100, format: "json" },
  specimen: { sha256: "c".repeat(64), bytes: 3, format: "png" },
};
beforeEach(() => {
  vi.useFakeTimers();
  specimen.mockReset();
  vi.stubGlobal("IntersectionObserver", undefined);
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test-specimen");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
test("同SHA暂时失败后按退避自动重试；实际img加载前不报告预览完成", async () => {
  const ready = vi.fn();
  specimen
    .mockRejectedValueOnce(
      new FontResourceError("network", performance.now() + 1000),
    )
    .mockResolvedValue(new Uint8Array([1, 2, 3]).buffer);
  render(
    <DynamicFontSpecimen
      versionId={descriptor.versionId}
      descriptor={descriptor}
      onReady={ready}
    />,
  );
  await act(() => vi.advanceTimersByTimeAsync(0));
  expect(screen.getByRole("alert")).toHaveTextContent("样张读取失败");
  expect(ready).not.toHaveBeenCalledWith(true);
  await act(() => vi.advanceTimersByTimeAsync(1000));
  expect(specimen).toHaveBeenCalledTimes(2);
  const img = screen.getByRole("img");
  expect(ready).not.toHaveBeenCalledWith(true);
  fireEvent.load(img);
  expect(ready).toHaveBeenLastCalledWith(true);
});
test("联网恢复同SHA重试；卸载终止下载和重试，不保留blob", async () => {
  specimen.mockRejectedValueOnce(new TypeError("offline")).mockImplementation(
    (_descriptor, signal: AbortSignal) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () =>
          reject(new DOMException("abort", "AbortError")),
        );
      }),
  );
  const { unmount } = render(
    <DynamicFontSpecimen
      versionId={descriptor.versionId}
      descriptor={descriptor}
    />,
  );
  await act(() => vi.advanceTimersByTimeAsync(0));
  await act(async () => window.dispatchEvent(new Event("online")));
  expect(specimen).toHaveBeenCalledTimes(2);
  const signal = specimen.mock.calls[1]![1] as AbortSignal;
  unmount();
  expect(signal.aborted).toBe(true);
  await act(() => vi.advanceTimersByTimeAsync(60000));
  expect(specimen).toHaveBeenCalledTimes(2);
});
test("预览失败可手动重试，PNG释放时撤销对象URL", async () => {
  specimen
    .mockRejectedValueOnce(new Error("failed"))
    .mockResolvedValue(new Uint8Array([1, 2, 3]).buffer);
  const { unmount } = render(
    <DynamicFontSpecimen
      versionId={descriptor.versionId}
      descriptor={descriptor}
    />,
  );
  await act(() => vi.advanceTimersByTimeAsync(0));
  await act(async () =>
    fireEvent.click(screen.getByRole("button", { name: "重试" })),
  );
  expect(screen.getByRole("img")).toBeInTheDocument();
  unmount();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:test-specimen");
});

test("选择项中的装饰样张不改变字体名称，独立预览保留可访问名称", async () => {
  specimen.mockResolvedValue(new Uint8Array([1, 2, 3]).buffer);
  const view = render(
    <div role="option" aria-selected={false}>
      <DynamicFontSpecimen
        versionId={descriptor.versionId}
        descriptor={descriptor}
        compact
      />
      测试字体
    </div>,
  );
  expect(screen.getByRole("option")).toHaveAccessibleName("测试字体");
  await act(() => vi.advanceTimersByTimeAsync(0));
  expect(screen.getByRole("option")).toHaveAccessibleName("测试字体");
  view.rerender(
    <DynamicFontSpecimen
      versionId={descriptor.versionId}
      descriptor={descriptor}
    />,
  );
  await act(() => vi.advanceTimersByTimeAsync(0));
  expect(screen.getByRole("img", { name: "字体样张" })).toBeVisible();
});

test("撤回通知立即移除已展示样张和blob，过时预览描述符不能恢复", async () => {
  const { rememberDynamicFont } = await import("@/lib/dynamic-text-font-state");
  const version = { ...descriptor, versionId: "tfv_" + "e".repeat(32) };
  specimen.mockResolvedValue(new Uint8Array([1, 2, 3]).buffer);
  const view = render(
    <DynamicFontSpecimen versionId={version.versionId} descriptor={version} />,
  );
  await act(() => vi.advanceTimersByTimeAsync(0));
  expect(screen.getByRole("img")).toBeVisible();
  act(() =>
    rememberDynamicFont({
      ...version,
      status: "withdrawn",
      renderAllowed: false,
    }),
  );
  expect(screen.queryByRole("img")).toBeNull();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:test-specimen");
  view.rerender(
    <DynamicFontSpecimen
      versionId={version.versionId}
      descriptor={{ ...version }}
    />,
  );
  await act(() => vi.advanceTimersByTimeAsync(0));
  expect(screen.queryByRole("img")).toBeNull();
  expect(specimen).toHaveBeenCalledTimes(1);
});

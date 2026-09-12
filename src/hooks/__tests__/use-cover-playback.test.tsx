import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { useCoverPlayback } from "../use-cover-playback";

const controller = vi.hoisted(() => ({ register: vi.fn(), dispose: vi.fn(), activate: (() => {}) as (active: boolean) => void }));
vi.mock("../cover-playback", () => ({
  coverPlayback: { register: controller.register },
}));
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); controller.register.mockReset(); controller.dispose.mockReset(); });
function Cover({ identity = "same" }: { identity?: string }) {
  const { ref, active, size } = useCoverPlayback(true, identity);
  return <div ref={ref} data-testid="cover" data-active={String(active)} data-size={JSON.stringify(size)} />;
}
describe("播放源像素需求快照", () => {
  test("真正选中才采集尺寸和DPR，无关重渲染不改变，下一次选中再采集", () => {
    controller.register.mockImplementation((_node, callback) => { controller.activate = callback; return controller.dispose; });
    let width = 300;
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(() => ({ width, height: 169 } as DOMRect));
    vi.stubGlobal("devicePixelRatio", 2);
    const view = render(<Cover />);
    act(() => controller.activate(true));
    expect(view.getByTestId("cover")).toHaveAttribute("data-size", JSON.stringify({ width: 300, height: 169, dpr: 2 }));
    width = 400;
    view.rerender(<Cover />);
    expect(controller.register).toHaveBeenCalledTimes(1);
    expect(view.getByTestId("cover")).toHaveAttribute("data-size", JSON.stringify({ width: 300, height: 169, dpr: 2 }));
    act(() => controller.activate(false));
    expect(view.getByTestId("cover")).toHaveAttribute("data-active", "false");
    act(() => controller.activate(true));
    expect(view.getByTestId("cover")).toHaveAttribute("data-size", JSON.stringify({ width: 400, height: 169, dpr: 2 }));
    view.rerender(<Cover identity="next" />);
    expect(view.getByTestId("cover")).toHaveAttribute("data-active", "false");
    expect(controller.dispose).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
});

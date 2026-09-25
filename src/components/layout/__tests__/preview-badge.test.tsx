import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { PreviewBadge } from "../preview-badge";

afterEach(() => { cleanup(); document.querySelectorAll('[data-slot="floating-composer-dock"]').forEach((node) => node.remove()); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it("普通环境不显示预览标识", () => {
  render(<PreviewBadge />); expect(screen.queryByLabelText("开发预览环境")).toBeNull();
});
it("随底部输入坞高度避让，并保持点击穿透", async () => {
  vi.stubGlobal("innerHeight", 900);
  let resize: () => void = () => {};
  vi.stubGlobal("ResizeObserver", class { constructor(callback: () => void) { resize = callback; } observe() {} disconnect() {} });
  let top = 820;
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    return this.dataset.slot ? new DOMRect(100, top, 780, 900 - top - 16) : new DOMRect(640, 860, 240, 28);
  });
  const dock = document.createElement("div"); dock.dataset.slot = "floating-composer-dock"; document.body.append(dock);
  render(<PreviewBadge snapshot="2026-09-26T01:00:00Z" />);
  const badge = screen.getByLabelText("开发预览环境");
  expect(badge).toHaveClass("pointer-events-none");
  await waitFor(() => expect(badge).toHaveStyle({ bottom: "92px" }));
  top = 400; resize(); await waitFor(() => expect(badge).toHaveStyle({ bottom: "512px" }));
  dock.remove(); await waitFor(() => expect(badge).toHaveStyle({ bottom: "12px" }));
});

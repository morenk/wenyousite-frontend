import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { ViewportToaster } from "./viewport-toaster";

vi.mock("sonner", () => ({
  Toaster: ({ offset, mobileOffset }: { offset: { top: string }; mobileOffset: { top: string } }) =>
    <div data-testid="toaster" data-top={offset.top} data-mobile-top={mobileOffset.top} />,
}));

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

test("桌面默认间距不变，无visualViewport仍保留安全区表达式", () => {
  vi.stubGlobal("visualViewport", undefined);
  render(<ViewportToaster />);
  expect(screen.getByTestId("toaster")).toHaveAttribute("data-top", "calc(0px + max(24px, env(safe-area-inset-top, 0px)))");
  expect(screen.getByTestId("toaster")).toHaveAttribute("data-mobile-top", "calc(0px + max(16px, env(safe-area-inset-top, 0px)))");
});

test("可视区平移及恢复更新提示位置，卸载清理scroll和resize监听", () => {
  const viewport = Object.assign(new EventTarget(), { offsetTop: 120 });
  const remove = vi.spyOn(viewport, "removeEventListener");
  vi.stubGlobal("visualViewport", viewport);
  const view = render(<ViewportToaster />);
  expect(screen.getByTestId("toaster").getAttribute("data-top")).toContain("120px");
  act(() => { viewport.offsetTop = 200; viewport.dispatchEvent(new Event("scroll")); });
  expect(screen.getByTestId("toaster").getAttribute("data-top")).toContain("200px");
  act(() => { viewport.offsetTop = 0; viewport.dispatchEvent(new Event("resize")); });
  expect(screen.getByTestId("toaster").getAttribute("data-top")).toContain("0px");
  view.unmount();
  expect(remove).toHaveBeenCalledWith("scroll", expect.any(Function));
  expect(remove).toHaveBeenCalledWith("resize", expect.any(Function));
});

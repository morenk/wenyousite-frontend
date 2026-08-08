import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FloatingComposerDock } from "@/components/thread/floating-composer-dock";

const { mockUseThreadComposer } = vi.hoisted(() => ({
  mockUseThreadComposer: vi.fn(),
}));

vi.mock("@/components/thread/thread-composer-context", () => ({
  useThreadComposer: () => mockUseThreadComposer(),
}));

const rect = (overrides: Partial<DOMRect> = {}) => ({
  x: 0,
  y: 0,
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
  width: 0,
  height: 0,
  toJSON: () => ({}),
  ...overrides,
}) as DOMRect;

beforeEach(() => {
  mockUseThreadComposer.mockReturnValue({ session: null });
  vi.stubGlobal("ResizeObserver", class {
    observe() {}
    disconnect() {}
  });
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
    this: HTMLElement,
  ) {
    if (this.dataset.slot === "floating-composer-anchor") {
      return rect({ x: 240, left: 240, right: 880, width: 640 });
    }
    if (this.dataset.slot === "floating-composer-dock") {
      return rect({ height: 120, bottom: 120 });
    }
    return rect();
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("FloatingComposerDock", () => {
  test("与内容列对齐并按浮层高度为列表底部留白", async () => {
    render(
      <FloatingComposerDock sessionAnchorId="create-floor:s1">
        <button type="button">发表回复…</button>
      </FloatingComposerDock>,
    );

    const dock = await screen.findByText("发表回复…");
    const floating = dock.closest<HTMLElement>('[data-slot="floating-composer-dock"]');
    const anchor = document.querySelector<HTMLElement>(
      '[data-slot="floating-composer-anchor"]',
    );

    expect(floating).toHaveClass("fixed", "bottom-4", "z-30");
    expect(floating).toHaveStyle({ left: "240px", width: "640px" });
    expect(floating?.parentElement).toBe(document.body);
    await waitFor(() => expect(anchor).toHaveStyle({ height: "136px" }));
  });

  test("某条卡片内已打开其他编辑会话时隐藏通用浮层", () => {
    mockUseThreadComposer.mockReturnValue({
      session: { anchorId: "reply:post-2" },
    });

    render(
      <FloatingComposerDock sessionAnchorId="create-floor:s1">
        <button type="button">发表回复…</button>
      </FloatingComposerDock>,
    );

    expect(screen.queryByRole("button", { name: "发表回复…" })).toBeNull();
    expect(document.querySelector('[data-slot="floating-composer-dock"]')).toBeNull();
  });
});

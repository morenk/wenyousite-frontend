import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { MomentMediaImage } from "@/components/moment/moment-media-image";
import { MomentPlaybackProvider, useMomentAnimationFailure, useMomentOverlay } from "@/components/moment/moment-playback";
// 固定验收语料来自 Foundation d2577ed1f441be0997021857e24c9076adaef006；不代表运行时依赖已发布。
import fixture from "./moment-playback.fixture.json";

const media = { url: "/animation", thumbnailUrl: "/still", mediumUrl: "/unsafe-medium", contentType: "image/gif", animated: true };
const observers = new Map<Element, IntersectionObserverCallback>();
function visibility(visible: boolean) {
  act(() => {
    for (const [target, callback] of observers) callback([{ target, isIntersecting: visible, intersectionRatio: visible ? 1 : 0 } as IntersectionObserverEntry], {} as IntersectionObserver);
  });
}
function hidden(value: boolean) {
  act(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value });
    document.dispatchEvent(new Event("visibilitychange"));
  });
}
function Overlay({ open }: { open: boolean }) { useMomentOverlay(open); return null; }
function SeedFailure({ failed }: { failed: boolean }) {
  const [, setFailure] = useMomentAnimationFailure(media.url);
  useEffect(() => { if (failed) setFailure(true); }, [failed]); // eslint-disable-line react-hooks/exhaustive-deps -- 仅初始化 fixture 的失败前置条件
  return null;
}
beforeEach(() => {
  observers.clear();
  hidden(false);
  vi.stubGlobal("IntersectionObserver", class {
    constructor(private callback: IntersectionObserverCallback) {}
    observe(target: Element) { observers.set(target, this.callback); }
    disconnect() { for (const [target, callback] of observers) if (callback === this.callback) observers.delete(target); }
  });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); hidden(false); });

describe("动态播放跨端验收", () => {
  test.each(fixture.cases)("$id", ({ input, expected }) => {
    hidden(!input.foreground);
    const currentRequired = input.surface === "carousel" || input.surface === "fullscreen";
    render(<MomentPlaybackProvider>
      <Overlay open={input.fullscreenOpen} /><SeedFailure failed={input.animationFailed} />
      <MomentMediaImage media={{ ...media, animated: input.animated, contentType: input.animated ? "image/gif" : "image/webp", thumbnailUrl: input.staticAvailable ? "/still" : null, mediumUrl: null }} alt="测试媒体"
        allowPlayback={input.surface !== "list" && input.playbackAllowed && input.pageActive && (!currentRequired || input.current)} foreground={input.surface === "fullscreen"} mode="thumbnail" />
    </MomentPlaybackProvider>);
    visibility(input.visible);
    const image = screen.getByRole("img", { name: "测试媒体" });
    if (expected.source === "placeholder") expect(image).not.toHaveAttribute("src");
    else expect(image).toHaveAttribute("src", expected.source === "animation" ? "/animation" : "/still");
    expect(!!screen.queryByRole("button", { name: "重试动图" })).toBe(expected.retry);
  });

  test("动画失败跨卸载重建、离屏及后台仍锁存，显式重试才挂原图", () => {
    const content = (mounted: boolean) => <MomentPlaybackProvider>{mounted && <MomentMediaImage media={media} alt="动图" allowPlayback />}</MomentPlaybackProvider>;
    const view = render(content(true));
    visibility(true);
    fireEvent.error(screen.getByAltText("动图"));
    expect(screen.getByAltText("动图")).toHaveAttribute("src", "/still");
    visibility(false); visibility(true); hidden(true); hidden(false);
    view.rerender(content(false)); view.rerender(content(true)); visibility(true);
    expect(screen.getByAltText("动图")).toHaveAttribute("src", "/still");
    fireEvent.click(screen.getByRole("button", { name: "重试动图" }));
    expect(screen.getByAltText("动图")).toHaveAttribute("src", "/animation");
    fireEvent.error(screen.getByAltText("动图")); fireEvent.error(screen.getByAltText("动图"));
    expect(screen.getByRole("img", { name: "动图" })).not.toHaveAttribute("src");
    expect(screen.getByRole("button", { name: "重试动图" })).toBeInTheDocument();
  });

  test("多个可见评论同时播放，任何灯箱暂停全部背景而保留前景", () => {
    const content = (open: boolean) => <MomentPlaybackProvider><Overlay open={open} />{["评论", "楼中楼", "轮播"].map((alt) => <MomentMediaImage key={alt} media={media} alt={alt} allowPlayback />)}<MomentMediaImage media={media} alt="灯箱" allowPlayback foreground /></MomentPlaybackProvider>;
    const view = render(content(false)); visibility(true);
    expect(screen.getAllByRole("img").every((img) => img.getAttribute("src") === "/animation")).toBe(true);
    view.rerender(content(true));
    for (const name of ["评论", "楼中楼", "轮播"]) expect(screen.getByAltText(name)).toHaveAttribute("src", "/still");
    expect(screen.getByAltText("灯箱")).toHaveAttribute("src", "/animation");
    hidden(true); expect(screen.getByAltText("灯箱")).toHaveAttribute("src", "/still");
    hidden(false); view.rerender(content(false));
    expect(screen.getAllByRole("img").every((img) => img.getAttribute("src") === "/animation")).toBe(true);
    view.unmount(); expect(observers.size).toBe(0);
  });

  test("静态预览错误不会尝试原图；按钮与重试保持独立", () => {
    const click = vi.fn();
    render(<MomentMediaImage media={media} alt="列表" allowPlayback={false} onClick={click} buttonLabel="查看" />);
    visibility(true); fireEvent.error(screen.getByAltText("列表"));
    fireEvent.click(screen.getByRole("button", { name: "查看" }));
    expect(click).toHaveBeenCalledOnce();
    expect(screen.getByRole("img", { name: "列表" })).not.toHaveAttribute("src");
    expect(screen.queryByText("重试动图")).not.toBeInTheDocument();
  });
});

const fullDisplay = { url: "https://cdn.example.com/complete.webp", contentType: "image/webp" as const, width: 1200, height: 900, bytes: 5000, animated: true, frameCount: 3, durationMs: 4500, loopCount: 2 };

test("动态详情使用display、列表保持静态，失败不下载原GIF", () => {
  render(<MomentPlaybackProvider><MomentMediaImage media={{ ...media, display: fullDisplay }} alt="完整动画" allowPlayback /><MomentMediaImage media={{ ...media, display: fullDisplay }} alt="静态列表" allowPlayback={false} /></MomentPlaybackProvider>);
  visibility(true);
  expect(screen.getByAltText("完整动画")).toHaveAttribute("src", fullDisplay.url);
  expect(screen.getByAltText("静态列表")).toHaveAttribute("src", "/still");
  fireEvent.error(screen.getByAltText("完整动画"));
  expect(screen.getByAltText("完整动画")).toHaveAttribute("src", "/still");
  fireEvent.click(screen.getByRole("button", { name: "重试动图" }));
  expect(screen.getByAltText("完整动画")).toHaveAttribute("src", fullDisplay.url);
});

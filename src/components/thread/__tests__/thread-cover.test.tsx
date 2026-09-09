import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import fixture from "../../../../contracts/thread-cover-media-v1-fixtures.json";
import { ThreadCover } from "../thread-cover";

const playback = vi.hoisted(() => ({ active: false, use: vi.fn() }));
vi.mock("@/hooks/use-cover-playback", () => ({
  useCoverPlayback: (enabled: boolean, identity: string) => {
    playback.use(enabled, identity);
    return { ref: { current: null }, active: enabled && playback.active };
  },
}));
beforeEach(() => { playback.active = false; playback.use.mockClear(); });
afterEach(cleanup);

const media = { url: "/animation.gif", animated: true, posterUrl: "/poster.webp" };
const animation = (container: HTMLElement) => container.querySelector("img[data-cover-animation]");
const poster = (container: HTMLElement) => container.querySelector("img[data-cover-poster]");

describe("ThreadCover共享契约", () => {
  for (const sample of fixture.cases) {
    test(sample.name, () => {
      const descriptor = "coverMedia" in sample ? sample.coverMedia : undefined;
      const { container } = render(<ThreadCover image={sample.coverImages[0]} media={descriptor} />);
      expect(container.querySelectorAll("img")).toHaveLength(descriptor?.posterUrl ? 1 : 0);
      if (descriptor?.posterUrl) expect(poster(container)).toHaveAttribute("src", descriptor.posterUrl);
      expect(animation(container)).toBeNull();
    });
  }
  test("只展示第一张封面的半宽16:9区域，原图无法冒充动画poster", () => {
    const { container, rerender } = render(<ThreadCover image={media.url} media={media} />);
    expect(container.firstChild).toHaveClass("aspect-video", "w-1/2");
    expect(poster(container)).toHaveAttribute("referrerpolicy", "no-referrer");
    expect(playback.use).toHaveBeenLastCalledWith(false, expect.any(String));
    rerender(<ThreadCover image={media.url} media={{ ...media, posterUrl: media.url }} />);
    expect(container.querySelectorAll("img")).toHaveLength(0);
    rerender(<ThreadCover image="/different.gif" media={media} />);
    expect(container.querySelectorAll("img")).toHaveLength(0);
  });
  test("poster失败保留占位，不回退原图；空封面不占空间", () => {
    const { container, rerender } = render(<ThreadCover image={media.url} media={media} />);
    fireEvent.error(poster(container)!);
    expect(container.querySelectorAll("img")).toHaveLength(0);
    expect(container.firstChild).toBeInTheDocument();
    expect(playback.use).toHaveBeenLastCalledWith(false, expect.any(String));
    rerender(<ThreadCover image={null} />);
    expect(container.firstChild).toBeNull();
  });
});

describe("ThreadCover动画生命周期", () => {
  test("静态首帧成功后才参与选中，未选中不挂载原图；加载成功隐藏poster避免透明残影", () => {
    const view = render(<ThreadCover image={media.url} media={media} />);
    fireEvent.load(poster(view.container)!);
    expect(playback.use).toHaveBeenLastCalledWith(true, expect.any(String));
    expect(animation(view.container)).toBeNull();
    playback.active = true;
    view.rerender(<ThreadCover image={media.url} media={media} />);
    expect(animation(view.container)).toHaveAttribute("src", media.url);
    expect(poster(view.container)).not.toHaveClass("invisible");
    fireEvent.load(animation(view.container)!);
    expect(poster(view.container)).toHaveClass("invisible");
    expect(animation(view.container)).not.toHaveClass("invisible");
    playback.active = false;
    view.rerender(<ThreadCover image={media.url} media={media} />);
    expect(animation(view.container)).toBeNull();
    expect(poster(view.container)).not.toHaveClass("invisible");
  });
  test("离选中后迟到动画load不复活；新一轮选中必须重新等待当前动画load", () => {
    const view = render(<ThreadCover image={media.url} media={media} />);
    fireEvent.load(poster(view.container)!);
    playback.active = true; view.rerender(<ThreadCover image={media.url} media={media} />);
    const stale = animation(view.container)!;
    playback.active = false; view.rerender(<ThreadCover image={media.url} media={media} />);
    fireEvent.load(stale);
    expect(animation(view.container)).toBeNull();
    playback.active = true; view.rerender(<ThreadCover image={media.url} media={media} />);
    expect(poster(view.container)).not.toHaveClass("invisible");
    expect(animation(view.container)).toHaveClass("invisible");
  });
  test("切换媒体后旧poster load不使新媒体提前参与播放", () => {
    const view = render(<ThreadCover image={media.url} media={media} />);
    const stale = poster(view.container)!;
    const next = { ...media, url: "/next.gif", posterUrl: "/next-poster.webp" };
    view.rerender(<ThreadCover image={next.url} media={next} />);
    fireEvent.load(stale);
    expect(playback.use).toHaveBeenLastCalledWith(false, expect.any(String));
    fireEvent.load(poster(view.container)!);
    expect(playback.use).toHaveBeenLastCalledWith(true, expect.any(String));
  });
  test("动画加载失败恢复首帧并停止同媒体反复重试", () => {
    const view = render(<ThreadCover image={media.url} media={media} />);
    fireEvent.load(poster(view.container)!);
    playback.active = true; view.rerender(<ThreadCover image={media.url} media={media} />);
    fireEvent.error(animation(view.container)!);
    expect(animation(view.container)).toBeNull();
    expect(poster(view.container)).toHaveAttribute("src", media.posterUrl);
    expect(playback.use).toHaveBeenLastCalledWith(false, expect.any(String));
    view.rerender(<ThreadCover image={media.url} media={media} />);
    expect(animation(view.container)).toBeNull();
  });
});

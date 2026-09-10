import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { LightboxExternalProps, Slide } from "yet-another-react-lightbox";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { MomentGalleryLightbox } from "@/components/moment/moment-gallery-lightbox";
import { GalleryLightbox } from "@/components/shared/gallery-lightbox";

const state = vi.hoisted(() => ({ props: undefined as LightboxExternalProps | undefined, offset: 0 }));
vi.mock("yet-another-react-lightbox", () => ({
  default: (props: LightboxExternalProps) => {
    state.props = props;
    return props.render?.slide?.({ slide: props.slides![0] as Slide, offset: state.offset, rect: { width: 800, height: 600 } }) ?? <div>默认图片渲染器</div>;
  },
}));
vi.mock("yet-another-react-lightbox/plugins/zoom", () => ({ default: vi.fn() }));
let callback: IntersectionObserverCallback;
beforeEach(() => {
  state.offset = 0;
  vi.stubGlobal("IntersectionObserver", class {
    constructor(cb: IntersectionObserverCallback) { callback = cb; }
    observe() {} disconnect() {}
  });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
function visible() {
  act(() => callback([{ isIntersecting: true, intersectionRatio: 1 } as IntersectionObserverEntry], {} as IntersectionObserver));
}
function load(width: number, height: number) {
  const image = screen.getByAltText("表情");
  Object.defineProperties(image, { naturalWidth: { configurable: true, value: width }, naturalHeight: { configurable: true, value: height } });
  fireEvent.load(image);
}
const media = { url: "/animated", thumbnailUrl: "/still", animated: true };
const images = [{ src: media.url, alt: "表情", momentMedia: media }];

test("未 opt-in 的主题帖沿用原始图片渲染和 preload2", () => {
  render(<GalleryLightbox images={images} index={0} onClose={vi.fn()} />);
  expect(screen.getByText("默认图片渲染器")).toBeInTheDocument();
  expect(state.props?.carousel?.preload).toBe(2);
  expect(state.props?.render).toBeUndefined();
  expect(state.props?.slides?.[0].src).toBe(media.url);
});

test("缩略图先加载不污染灯箱原件尺寸，小表情按100px原件显示", () => {
  render(<MomentGalleryLightbox images={images} index={0} onClose={vi.fn()} />);
  expect(state.props?.carousel?.preload).toBe(0);
  expect(screen.getByAltText("表情")).toHaveAttribute("src", "/still");
  load(20, 20);
  expect(state.props?.slides?.[0].width).toBeUndefined();
  visible(); expect(screen.getByAltText("表情")).toHaveAttribute("src", "/animated");
  load(100, 100);
  expect(state.props?.slides?.[0]).toMatchObject({ width: 100, height: 100 });
  expect(screen.getByAltText("表情").parentElement).toHaveStyle({ width: "100px", height: "100px" });
});

test("邻图只渲染预览，大图保持比例适配视窗", () => {
  state.offset = 1;
  const view = render(<MomentGalleryLightbox images={[{ ...images[0], width: 1600, height: 1200 }]} index={0} onClose={vi.fn()} />);
  visible(); expect(screen.getByAltText("表情")).toHaveAttribute("src", "/still");
  expect(screen.getByAltText("表情").parentElement).toHaveStyle({ width: "800px", height: "600px" });
  state.offset = 0;
  view.rerender(<MomentGalleryLightbox images={[{ ...images[0], width: 1600, height: 1200 }]} index={0} onClose={vi.fn()} />);
  expect(screen.getByAltText("表情")).toHaveAttribute("src", "/animated");
});

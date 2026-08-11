import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const {
  emblaApi,
  emblaListeners,
  mockScrollNext,
  mockScrollPrev,
  mockScrollTo,
} = vi.hoisted(() => {
  const emblaListeners = new Map<string, () => void>();
  return {
    emblaListeners,
    mockScrollNext: vi.fn(),
    mockScrollPrev: vi.fn(),
    mockScrollTo: vi.fn(),
    emblaApi: {
      on: vi.fn((event: string, listener: () => void) => {
        emblaListeners.set(event, listener);
      }),
      off: vi.fn((event: string) => {
        emblaListeners.delete(event);
      }),
      selectedScrollSnap: vi.fn(() => 1),
      scrollNext: vi.fn(),
      scrollPrev: vi.fn(),
      scrollTo: vi.fn(),
    },
  };
});

vi.mock("embla-carousel-react", () => ({
  default: () => [vi.fn(), {
    ...emblaApi,
    scrollNext: mockScrollNext,
    scrollPrev: mockScrollPrev,
    scrollTo: mockScrollTo,
  }],
}));

vi.mock("next/dynamic", () => ({
  default: () => function MockGalleryLightbox({
    images,
    index,
    onClose,
  }: {
    images: Array<{ alt: string }>;
    index: number;
    onClose: () => void;
  }) {
    return <button type="button" onClick={onClose}>关闭 {images[index]?.alt}</button>;
  },
}));

import { MomentImageGallery } from "@/components/moment/moment-image-gallery";

const images = [
  {
    id: "image-1",
    url: "/image-1.webp",
    thumbnailUrl: "/image-1-thumb.webp",
    feedUrl: null,
    mediumUrl: "/image-1-medium.webp",
    width: 1200,
    height: 1600,
  },
  {
    id: "image-2",
    url: "/image-2.webp",
    thumbnailUrl: null,
    feedUrl: "/image-2-feed.webp",
    mediumUrl: "/image-2-medium.webp",
    width: 1600,
    height: 1000,
  },
];

describe("MomentImageGallery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    emblaListeners.clear();
  });
  afterEach(cleanup);

  test("无图片时不渲染舞台", () => {
    const { container } = render(<MomentImageGallery title="空动态" images={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  test("固定封面比例，并支持轮播、缩略图与灯箱关闭", () => {
    const { unmount } = render(
      <MomentImageGallery
        title="画廊测试"
        images={images}
        coverMedia={images[1]}
      />,
    );

    expect(screen.getByRole("region", { name: "画廊测试的图片，共 2 张" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "查看大图：画廊测试，第 1 张图片" }))
      .toHaveStyle({ aspectRatio: "1.6" });

    fireEvent.click(screen.getByRole("button", { name: "上一张图片" }));
    fireEvent.click(screen.getByRole("button", { name: "下一张图片" }));
    fireEvent.click(screen.getByRole("button", { name: "显示第 2 张图片" }));
    expect(mockScrollPrev).toHaveBeenCalledOnce();
    expect(mockScrollNext).toHaveBeenCalledOnce();
    expect(mockScrollTo).toHaveBeenCalledWith(1);

    act(() => emblaListeners.get("select")?.());
    expect(screen.getByText("2 / 2")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "查看大图：画廊测试，第 1 张图片" }));
    const close = screen.getByRole("button", { name: "关闭 画廊测试，第 1 张图片" });
    fireEvent.click(close);
    expect(close).not.toBeInTheDocument();

    unmount();
    expect(emblaApi.off).toHaveBeenCalledWith("select", expect.any(Function));
    expect(emblaApi.off).toHaveBeenCalledWith("reInit", expect.any(Function));
  });
});

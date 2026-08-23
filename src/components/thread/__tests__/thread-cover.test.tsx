/** ThreadCover：单图封面、衍生图回退与破图隐藏。 */

import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { ThreadCover } from "@/components/thread/thread-cover";

afterEach(() => cleanup());

describe("ThreadCover", () => {
  test("只渲染一张 16:9 半宽封面", () => {
    const { container } = render(<ThreadCover image="/one.jpg" />);

    expect(container.querySelector("[data-thread-cover='true']")).toHaveClass(
      "aspect-video",
      "w-1/2",
    );
    expect(container.querySelectorAll("img")).toHaveLength(1);
  });

  test("本站静态图片优先使用 feed 衍生图，GIF 和外链保留原图", () => {
    const { container, rerender } = render(
      <ThreadCover image="https://cdn.wenyou.site/uploads/cover.png" />,
    );

    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      "https://cdn.wenyou.site/uploads/cover_feed.webp",
    );

    rerender(<ThreadCover image="https://cdn.wenyou.site/media/cover.webp" />);
    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      "https://cdn.wenyou.site/media/cover_feed.webp",
    );

    rerender(<ThreadCover image="https://cdn.wenyou.site/uploads/animated.gif" />);
    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      "https://cdn.wenyou.site/uploads/animated.gif",
    );

    rerender(<ThreadCover image="https://legacy.example.com/external.jpg" />);
    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      "https://legacy.example.com/external.jpg",
    );
    expect(container.querySelector("img")).toHaveAttribute(
      "referrerpolicy",
      "no-referrer",
    );
  });

  test("衍生图失败回退原图，原图仍失败时隐藏封面", () => {
    const { container } = render(
      <ThreadCover image="https://cdn.wenyou.site/uploads/broken.png" />,
    );
    const image = container.querySelector("img");

    fireEvent.error(image!);
    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      "https://cdn.wenyou.site/uploads/broken.png",
    );

    fireEvent.error(container.querySelector("img")!);
    expect(container.firstChild).toBeNull();
  });

  test("空地址不渲染封面区域", () => {
    const { container } = render(<ThreadCover image={null} />);
    expect(container.firstChild).toBeNull();
  });
});

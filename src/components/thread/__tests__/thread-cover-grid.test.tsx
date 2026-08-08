/** ThreadCoverGrid：按数量铺满、衍生图回退与破图收缩。 */

import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { ThreadCoverGrid } from "@/components/thread/thread-cover-grid";

afterEach(() => cleanup());

describe("ThreadCoverGrid", () => {
  test("最多取三张并按数量切换等分网格", () => {
    const { container, rerender } = render(
      <ThreadCoverGrid images={["/one.jpg"]} />,
    );
    expect(container.querySelector("[data-image-count='1']")).toHaveClass(
      "grid-cols-1",
      "w-1/2",
    );

    rerender(<ThreadCoverGrid images={["/one.jpg", "/two.jpg"]} />);
    expect(container.querySelector("[data-image-count='2']")).toHaveClass(
      "grid-cols-2",
    );

    rerender(
      <ThreadCoverGrid
        images={["/one.jpg", "/two.jpg", "/three.jpg", "/four.jpg"]}
      />,
    );
    expect(container.querySelector("[data-image-count='3']")).toHaveClass(
      "grid-cols-3",
    );
    expect(container.querySelectorAll("img")).toHaveLength(3);
  });

  test("本站静态图片优先使用 feed 衍生图，GIF 和外链保留原图", () => {
    const { container } = render(
      <ThreadCoverGrid
        images={[
          "https://cdn.wenyou.site/uploads/cover.png",
          "https://cdn.wenyou.site/uploads/animated.gif",
          "https://legacy.example.com/external.jpg",
        ]}
      />,
    );
    const images = container.querySelectorAll("img");

    expect(images[0]).toHaveAttribute(
      "src",
      "https://cdn.wenyou.site/uploads/cover_feed.webp",
    );
    expect(images[1]).toHaveAttribute(
      "src",
      "https://cdn.wenyou.site/uploads/animated.gif",
    );
    expect(images[2]).toHaveAttribute(
      "src",
      "https://legacy.example.com/external.jpg",
    );
    expect(images[2]).toHaveAttribute("referrerpolicy", "no-referrer");
  });

  test("衍生图失败回退原图，原图仍失败时隐藏并让剩余图片铺满", () => {
    const { container } = render(
      <ThreadCoverGrid
        images={[
          "https://cdn.wenyou.site/uploads/broken.png",
          "https://cdn.wenyou.site/uploads/working.png",
        ]}
      />,
    );
    const firstImage = container.querySelectorAll("img")[0];

    fireEvent.error(firstImage);
    expect(container.querySelectorAll("img")[0]).toHaveAttribute(
      "src",
      "https://cdn.wenyou.site/uploads/broken.png",
    );

    fireEvent.error(container.querySelectorAll("img")[0]);
    expect(container.querySelectorAll("img")).toHaveLength(1);
    expect(container.querySelector("[data-image-count='1']")).toHaveClass(
      "grid-cols-1",
    );
  });

  test("空数组不渲染封面区域", () => {
    const { container } = render(<ThreadCoverGrid images={[]} />);
    expect(container.firstChild).toBeNull();
  });
});

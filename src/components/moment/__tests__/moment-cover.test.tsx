import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { MomentCover } from "@/components/moment/moment-cover";

describe("MomentCover", () => {
  afterEach(cleanup);

  test("无图动态展示稳定主题的语义色文字封面", () => {
    const { container } = render(
      <MomentCover
        moment={{
          title: "今天也想写一点",
          coverType: "TEXT",
          coverMedia: null,
          textCoverTheme: "MINT",
          imageCount: 0,
        }}
      />,
    );

    expect(screen.getByText("今天也想写一点")).toBeInTheDocument();
    expect(screen.queryByRole("img")).toBeNull();
    expect(container.firstElementChild).toHaveClass("moment-text-cover", "aspect-[3/4]", "rounded-xl");
    expect(container.firstElementChild).toHaveAttribute("data-cover-theme", "MINT");
  });

  test("图片动态优先使用 feed 派生图并显示图片数量", () => {
    const { container } = render(
      <MomentCover
        priority
        moment={{
          title: "图集",
          coverType: "IMAGE",
          textCoverTheme: "ROSE",
          imageCount: 3,
          coverMedia: {
            id: "media-1",
            url: "https://cdn.test/original.jpg",
            thumbnailUrl: "https://cdn.test/thumb.webp",
            mediumUrl: "https://cdn.test/medium.webp",
            feedUrl: "https://cdn.test/feed.webp",
            width: 4000,
            height: 1000,
          },
        }}
      />,
    );

    expect(screen.getByRole("img", { name: "图集" })).toHaveAttribute(
      "src",
      "https://cdn.test/feed.webp",
    );
    expect(screen.getByRole("img", { name: "图集" })).toHaveAttribute("loading", "eager");
    expect(screen.getByText("3 图")).toBeInTheDocument();
    expect(container.firstElementChild).toHaveClass("rounded-xl");
    expect(container.firstElementChild).toHaveStyle({ aspectRatio: "4" });
    expect(container.firstElementChild).not.toHaveClass("aspect-[3/4]");
    expect(screen.getByRole("img", { name: "图集" })).toHaveAttribute("width", "4000");
    expect(screen.getByRole("img", { name: "图集" })).toHaveAttribute("height", "1000");
  });
});

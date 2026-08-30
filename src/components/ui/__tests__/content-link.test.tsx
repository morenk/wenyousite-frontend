import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

import { ContentLink, isSafeContentHref } from "@/components/ui/content-link";

afterEach(cleanup);

describe("正文链接安全边界", () => {
  test.each([
    ["javascript:alert(1)", false],
    ["data:text/html,<script>alert(1)</script>", false],
    ["//attacker.example/path", false],
    ["/threads/thread-1", true],
    ["https://wenyou.site/threads/thread-1", true],
    ["mailto:test@example.com", true],
  ])("协议 %s 的判断为 %s", (href, expected) => {
    expect(isSafeContentHref(href)).toBe(expected);
  });

  test("危险链接降级为文本，不生成可点击元素", () => {
    render(<ContentLink href="javascript:alert(1)">危险链接</ContentLink>);

    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("危险链接")).toHaveAttribute("data-slot", "content-link");
  });

  test("外部 HTTP 链接使用安全 rel 属性", () => {
    render(
      <ContentLink href="https://example.com/path" external>
        外部链接
      </ContentLink>,
    );

    expect(screen.getByRole("link", { name: "外部链接" })).toHaveAttribute(
      "rel",
      "noopener noreferrer",
    );
  });
});

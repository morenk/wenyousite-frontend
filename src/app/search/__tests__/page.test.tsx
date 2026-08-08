import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { NuqsTestingAdapter, type UrlUpdateEvent } from "nuqs/adapters/testing";

vi.mock("@/components/layout/page-shell", () => ({
  PageShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));
vi.mock("@/components/search/search-results", () => ({
  SearchResults: ({ keyword }: { keyword: string }) => <div>结果:{keyword}</div>,
}));

import SearchPage from "@/app/search/page";

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => cleanup());

describe("搜索页", () => {
  function renderPage({
    searchParams = "",
    onUrlUpdate,
  }: {
    searchParams?: string;
    onUrlUpdate?: (event: UrlUpdateEvent) => void;
  } = {}) {
    return render(
      <NuqsTestingAdapter searchParams={searchParams} onUrlUpdate={onUrlUpdate} hasMemory>
        <SearchPage />
      </NuqsTestingAdapter>,
    );
  }

  test("无关键词时显示引导而不渲染结果", () => {
    renderPage();
    expect(screen.getByText("输入关键词开始搜索")).toBeInTheDocument();
    expect(screen.queryByText(/^结果:/)).not.toBeInTheDocument();
  });

  test("URL 关键词回填输入框并传给结果组件", () => {
    renderPage({ searchParams: "?q=测试+主题" });

    expect(screen.getByDisplayValue("测试 主题")).toBeInTheDocument();
    expect(screen.getByText("结果:测试 主题")).toBeInTheDocument();
  });

  test("提交时裁剪并编码关键词", async () => {
    const user = userEvent.setup();
    const onUrlUpdate = vi.fn<(event: UrlUpdateEvent) => void>();
    renderPage({ onUrlUpdate });
    const input = screen.getByPlaceholderText("搜索动态、用户、主题帖或楼层内容…");

    await user.type(input, "  剧情 推理  ");
    await user.click(screen.getByRole("button", { name: "搜索" }));

    expect(onUrlUpdate).toHaveBeenCalledWith(expect.objectContaining({
      searchParams: new URLSearchParams("q=剧情+推理"),
    }));
    expect(await screen.findByText("结果:剧情 推理")).toBeInTheDocument();
  });

  test("空白搜索回到无参数路径", async () => {
    const user = userEvent.setup();
    const onUrlUpdate = vi.fn<(event: UrlUpdateEvent) => void>();
    renderPage({ searchParams: "?q=旧关键词", onUrlUpdate });
    const input = screen.getByDisplayValue("旧关键词");

    await user.clear(input);
    await user.type(input, "   ");
    await user.click(screen.getByRole("button", { name: "搜索" }));

    expect(onUrlUpdate).toHaveBeenCalledWith(expect.objectContaining({
      searchParams: new URLSearchParams(),
    }));
    expect(await screen.findByText("输入关键词开始搜索")).toBeInTheDocument();
  });
});

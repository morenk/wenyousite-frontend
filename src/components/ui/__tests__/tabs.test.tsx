import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

afterEach(cleanup);

describe("Tabs 布局", () => {
  test("横向分类栏与面板纵向排列并占满可用宽度", () => {
    render(
      <Tabs defaultValue="result" aria-label="搜索结果">
        <TabsList>
          <TabsTrigger value="result">结果</TabsTrigger>
        </TabsList>
        <TabsContent value="result">结果列表</TabsContent>
      </Tabs>,
    );

    expect(screen.getByLabelText("搜索结果")).toHaveClass(
      "w-full",
      "flex-col",
      "min-w-0",
    );
    expect(screen.getByText("结果列表")).toHaveClass(
      "min-w-0",
      "group-data-[orientation=horizontal]/tabs:w-full",
    );
  });

  test("垂直分类栏保留左右排列", () => {
    render(
      <Tabs defaultValue="result" orientation="vertical" aria-label="垂直分类">
        <TabsList>
          <TabsTrigger value="result">结果</TabsTrigger>
        </TabsList>
        <TabsContent value="result">垂直结果列表</TabsContent>
      </Tabs>,
    );

    expect(screen.getByLabelText("垂直分类")).toHaveClass("flex-row");
    expect(screen.getByLabelText("垂直分类")).not.toHaveClass("flex-col");
  });
});

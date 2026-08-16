import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hooks = vi.hoisted(() => ({
  useAdminTaxonomy: vi.fn(),
  useAdminTaxonomyActions: vi.fn(),
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
}));

vi.mock("@/api/hooks/use-admin", () => ({
  useAdminTaxonomy: hooks.useAdminTaxonomy,
  useAdminTaxonomyActions: hooks.useAdminTaxonomyActions,
}));

import { TaxonomyPanel } from "@/components/admin/taxonomy-panel";

function mutation(mutateAsync = vi.fn()) {
  return { mutateAsync, isPending: false };
}

function renderPanel(searchParams = "") {
  return render(
    <NuqsTestingAdapter searchParams={searchParams} hasMemory>
      <TaxonomyPanel />
    </NuqsTestingAdapter>,
  );
}

describe("TaxonomyPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hooks.createCategory.mockResolvedValue({});
    hooks.updateCategory.mockResolvedValue({});
    hooks.useAdminTaxonomy.mockReturnValue({
      isLoading: false,
      data: {
        categories: [{
          id: "legacy_rpg",
          slug: "RPG",
          name: "角色扮演",
          description: "角色扮演主题",
          icon: null,
          sortOrder: 30,
          isActive: true,
          createdAt: "2026-08-08T00:00:00.000Z",
          updatedAt: "2026-08-08T00:00:00.000Z",
        }],
        tags: [],
      },
    });
    hooks.useAdminTaxonomyActions.mockReturnValue({
      createCategory: mutation(hooks.createCategory),
      updateCategory: mutation(hooks.updateCategory),
      createTag: mutation(),
      updateTag: mutation(),
    });
  });

  afterEach(() => cleanup());

  it("编辑展示名称但保留不可变 slug", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole("button", { name: "编辑 角色扮演" }));
    expect(screen.getAllByText("RPG")).toHaveLength(2);
    expect(screen.getByText("历史主题帖和链接依赖此标识；重命名不会改变它。")).toBeInTheDocument();
    expect(screen.queryByLabelText("识别色")).not.toBeInTheDocument();
    expect(screen.queryByText("颜色状态")).not.toBeInTheDocument();

    const name = screen.getByLabelText("展示名称");
    await user.clear(name);
    await user.type(name, "叙事角色扮演");
    const description = screen.getByLabelText("分类说明");
    await user.clear(description);
    await user.type(description, "共同讲述角色故事");
    const sortOrder = screen.getByLabelText("排序");
    await user.clear(sortOrder);
    await user.type(sortOrder, "40");
    await user.click(screen.getByRole("button", { name: "保存分类设置" }));

    expect(hooks.updateCategory).toHaveBeenCalledWith({
      id: "legacy_rpg",
      name: "叙事角色扮演",
      description: "共同讲述角色故事",
      sortOrder: 40,
      reason: "站务台更新分类设置",
    });
  });

  it("新增分类的排序接在当前最大值之后", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.type(screen.getByPlaceholderText("分类名称"), "悬疑");
    await user.type(screen.getByPlaceholderText("大写英文标识，如 MYSTERY"), "MYSTERY");
    await user.click(screen.getByRole("button", { name: "新增分类" }));

    expect(hooks.createCategory).toHaveBeenCalledWith({
      slug: "MYSTERY",
      name: "悬疑",
      sortOrder: 31,
      isActive: true,
      reason: "站务台新增分类",
    });
  });
});

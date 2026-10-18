import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hooks = vi.hoisted(() => ({
  useAdminTaxonomy: vi.fn(),
  useAdminTaxonomyActions: vi.fn(),
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  createTag: vi.fn(),
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
      createTag: mutation(hooks.createTag),
      updateTag: mutation(),
    });
  });

  afterEach(() => cleanup());

  it("编辑展示名称但保留不可变 slug", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole("button", { name: "编辑 角色扮演" }));
    expect(screen.getAllByText("RPG")).toHaveLength(2);
    expect(screen.getByText("分类标识（不可修改）")).toBeInTheDocument();
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
    await user.type(screen.getByPlaceholderText("大写英文标识，如 MYSTERY"), "mystery");
    await user.click(screen.getByRole("button", { name: "新增分类" }));

    expect(hooks.createCategory).toHaveBeenCalledWith({
      slug: "MYSTERY",
      name: "悬疑",
      sortOrder: 31,
      isActive: true,
      reason: "站务台新增分类",
    });
  });
  it("分类编辑错误关联名称、排序和说明，业务说明同时保留", async () => {
    const user = userEvent.setup(); renderPanel();
    await user.click(screen.getByRole("button", { name: "编辑 角色扮演" }));
    fireEvent.change(screen.getByLabelText("展示名称"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("排序"), { target: { value: "-1" } });
    fireEvent.change(screen.getByLabelText("分类说明"), { target: { value: "文".repeat(201) } });
    fireEvent.submit(screen.getByLabelText("展示名称").closest("form")!);
    await waitFor(() => expect(screen.getByLabelText("展示名称")).toHaveAttribute("aria-invalid", "true"));
    for (const label of ["展示名称", "排序", "分类说明"]) {
      const field = screen.getByLabelText(label);
      expect(field).toHaveAttribute("aria-invalid", "true");
      const ids = field.getAttribute("aria-describedby")!.split(" ");
      expect(ids.every((id) => document.getElementById(id))).toBe(true);
      expect(ids).toContain(`${field.id}-error`);
    }
    expect(screen.getByLabelText("展示名称")).toHaveAccessibleDescription(/修改名称会同步显示在已有主题帖中.*请输入分类名称/);
    expect(hooks.updateCategory).not.toHaveBeenCalled();
  });

  it("新建分类与标签显示各自的字段错误", async () => {
    renderPanel();
    fireEvent.submit(screen.getByLabelText("分类名称").closest("form")!);
    fireEvent.submit(screen.getByLabelText("标签名称").closest("form")!);
    await waitFor(() => expect(screen.getByLabelText("分类名称")).toHaveAttribute("aria-invalid", "true"));
    expect(screen.getByLabelText("分类名称")).toHaveAccessibleDescription("请输入分类名称");
    expect(screen.getByLabelText("稳定标识（大写英文）")).toHaveAccessibleDescription(/大写字母/);
    expect(screen.getByLabelText("标签名称")).toHaveAccessibleDescription("请输入标签名称");
    expect(hooks.createCategory).not.toHaveBeenCalled(); expect(hooks.createTag).not.toHaveBeenCalled();
  });

  it("未决分类写入阻止重复 submit，失败保留输入并允许重试", async () => {
    let reject!: (error: Error) => void;
    hooks.createCategory.mockImplementationOnce(() => new Promise((_, fail) => { reject = fail; }));
    renderPanel();
    fireEvent.change(screen.getByLabelText("分类名称"), { target: { value: "悬疑" } });
    fireEvent.change(screen.getByLabelText("稳定标识（大写英文）"), { target: { value: "MYSTERY" } });
    const form = screen.getByLabelText("分类名称").closest("form")!;
    fireEvent.submit(form); fireEvent.submit(form);
    await waitFor(() => expect(hooks.createCategory).toHaveBeenCalledOnce());
    expect(screen.getByRole("button", { name: "新增分类" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "新增分类" })).toHaveAttribute("aria-busy", "true");
    await act(async () => reject(new Error("暂时失败")));
    await waitFor(() => expect(screen.getByRole("button", { name: "新增分类" })).toBeEnabled());
    expect(screen.getByLabelText("分类名称")).toHaveValue("悬疑");
    fireEvent.submit(form);
    await waitFor(() => expect(hooks.createCategory).toHaveBeenCalledTimes(2));
  });

});

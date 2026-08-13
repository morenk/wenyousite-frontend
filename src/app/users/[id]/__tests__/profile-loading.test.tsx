import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import UserProfileTabLoading from "@/app/users/[id]/(profile)/loading";

describe("用户资料 Tab 加载态", () => {
  test("只渲染 Tab 内容骨架，不重复资料页外壳", () => {
    const { container } = render(<UserProfileTabLoading />);

    expect(screen.getByRole("status", { name: "资料内容加载中" })).toBeInTheDocument();
    expect(container.querySelector('[data-slot="profile-tab-fallback"]')).toBeInTheDocument();
    expect(container.querySelector('[data-slot="page-shell"]')).not.toBeInTheDocument();
    expect(container.querySelector('[data-slot="navigation-progress"]')).toBeInTheDocument();
  });
});

import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

const { mockProfileShell } = vi.hoisted(() => ({ mockProfileShell: vi.fn() }));

vi.mock("@/components/user/user-profile-shell", () => ({
  UserProfileShell: ({ userId, children }: { userId: string; children: React.ReactNode }) => {
    mockProfileShell({ userId });
    return <main>{children}</main>;
  },
}));

import UserProfileLayout from "@/app/users/[id]/(profile)/layout";

describe("用户资料共享 Layout", () => {
  test("用同一个资料外壳包裹各 Tab 内容", async () => {
    const layout = await UserProfileLayout({
      children: <div>当前 Tab 内容</div>,
      params: Promise.resolve({ id: "author-1" }),
    });

    render(layout);
    expect(mockProfileShell).toHaveBeenCalledWith({ userId: "author-1" });
    expect(screen.getByText("当前 Tab 内容")).toBeInTheDocument();
  });
});

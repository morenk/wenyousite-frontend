import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const { mockUserMomentsSection } = vi.hoisted(() => ({
  mockUserMomentsSection: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useParams: () => ({ id: "author-1" }) }));

vi.mock("@/components/moment/user-moments-section", () => ({
  UserMomentsSection: (props: unknown) => {
    mockUserMomentsSection(props);
    return <div>完整动态瀑布流</div>;
  },
}));

import UserMomentsRoute from "@/app/users/[id]/(profile)/moments/page";

describe("用户动态 Tab", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(cleanup);

  test("只挂载当前 Tab 的完整动态瀑布流", () => {
    render(<UserMomentsRoute />);

    expect(screen.getByText("完整动态瀑布流")).toBeInTheDocument();
    expect(mockUserMomentsSection).toHaveBeenCalledWith({ userId: "author-1" });
  });
});

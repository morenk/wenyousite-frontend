import userEvent from "@testing-library/user-event";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

vi.mock("@/api/hooks/use-moments", () => ({
  useMomentBookmark: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("@/api/hooks/use-bookmark-folders", () => ({
  useMoveMomentBookmark: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("@/components/moment/moment-card", () => ({
  MomentCard: ({ moment }: { moment: { title: string } }) => <div>{moment.title}</div>,
}));

import { BookmarkMomentCard } from "@/components/user/bookmark-moment-card";

const moment = {
  id: "moment-1",
  title: "历史动态",
  bookmarkFolderId: "folder-1",
  canInteract: false,
};
const folders = [
  {
    id: "folder-1",
    name: "默认收藏夹",
    isDefault: true,
    itemCount: 1,
    createdAt: "2026-08-23T00:00:00.000Z",
    updatedAt: "2026-08-23T00:00:00.000Z",
  },
];

describe("BookmarkMomentCard", () => {
  afterEach(cleanup);

  test("历史动态不能移动收藏夹，但仍可取消收藏", async () => {
    render(<BookmarkMomentCard moment={moment as never} folders={folders as never} />);

    await userEvent.click(screen.getByRole("button", { name: `更多收藏操作：${moment.title}` }));
    expect(screen.getByRole("menuitem", { name: "移动到收藏夹" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("menuitem", { name: "取消收藏" })).not.toHaveAttribute("aria-disabled", "true");
  });
});

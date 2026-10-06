import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { ThreadPublicationIdentityChoice } from "../thread-publication-identity-choice";

afterEach(cleanup);
const account = { name: "账号", avatar: null };
const identities = [
  { id: "rp-one", appearance: { name: "白鸦", avatar: "/one.webp" } },
  { id: "rp-two", appearance: { name: "白鸦", avatar: "/two.webp" } },
];

test("同名角色按稳定键选择，账号始终独立成行", async () => {
  const choose = vi.fn();
  render(<ThreadPublicationIdentityChoice account={account} identities={identities} value={{ mode: "ACCOUNT" }} onChange={choose} />);
  await userEvent.click(screen.getByRole("button", { name: "发表身份" }));
  const options = screen.getAllByRole("menuitemradio");
  expect(options[0]).toHaveAccessibleName("站内身份：账号");
  await userEvent.click(screen.getAllByRole("menuitemradio", { name: "帖内身份：白鸦" })[1]);
  expect(choose).toHaveBeenCalledWith({ mode: "RP", id: "rp-two" });
});

test("每行笔只编辑对应稳定ID，不选择角色", async () => {
  const choose = vi.fn();
  const edit = vi.fn();
  render(<ThreadPublicationIdentityChoice account={account} identities={identities} value={{ mode: "ACCOUNT" }} onChange={choose} onEdit={edit} />);
  await userEvent.click(screen.getByRole("button", { name: "发表身份" }));
  const buttons = screen.getAllByRole("menuitem", { name: "编辑白鸦的帖内资料" });
  expect(buttons[1].parentElement).toBe(screen.getAllByRole("menuitemradio", { name: "帖内身份：白鸦" })[1].parentElement);
  await userEvent.click(buttons[1]);
  expect(edit).toHaveBeenCalledWith("rp-two");
  expect(choose).not.toHaveBeenCalled();
});

test.each([0, 9, 10])("%s个角色时的新增入口遵守十个上限", async (count) => {
  const create = vi.fn();
  const items = Array.from({ length: count }, (_, index) => ({ id: "rp-" + index, appearance: { name: "角色" + index, avatar: null } }));
  render(<ThreadPublicationIdentityChoice account={account} identities={items} value={{ mode: "ACCOUNT" }} onChange={vi.fn()} onCreate={create} />);
  await userEvent.click(screen.getByRole("button", { name: "发表身份" }));
  expect(screen.getAllByRole("menuitemradio")).toHaveLength(count + 1);
  const add = screen.queryByRole("menuitem", { name: count ? "新增帖内身份" : "设置帖内身份" });
  if (count < 10) {
    expect(add).toBeInTheDocument();
    await userEvent.click(add!);
    expect(create).toHaveBeenCalledOnce();
  } else {
    expect(add).not.toBeInTheDocument();
    expect(screen.queryByText(/上限|最多|10个/)).not.toBeInTheDocument();
  }
});

test("选中角色不在列表时只回退展示，冻结选择不会被自动改写", () => {
  const choose = vi.fn();
  render(<ThreadPublicationIdentityChoice account={account} identities={identities} value={{ mode: "RP", id: "removed" }} disabled onChange={choose} />);
  expect(screen.getByRole("button", { name: "发表身份" })).toBeDisabled();
  expect(screen.getByText("账号")).toBeInTheDocument();
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  expect(choose).not.toHaveBeenCalled();
});

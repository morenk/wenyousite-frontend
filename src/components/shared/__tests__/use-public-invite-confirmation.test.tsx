import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { usePublicInviteConfirmation } from "@/components/shared/use-public-invite-confirmation";

const { mockConfirm } = vi.hoisted(() => ({ mockConfirm: vi.fn() }));

vi.mock("@/components/ui/confirm-provider", () => ({
  useConfirm: () => mockConfirm,
}));

describe("usePublicInviteConfirmation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfirm.mockResolvedValue(true);
  });

  test("同一公开邀请正文失败重试不重复确认，邀请变化后重新确认", async () => {
    const { result } = renderHook(() => usePublicInviteConfirmation());
    const first = "请用 [入口](/join/AbCdEfGh_123-XYZ)";
    const second = "请用 [新入口](/join/ZyXwVuTs_987-ABC)";

    await act(async () => expect(await result.current.confirmPublicInvite(first)).toBe(true));
    await act(async () => expect(await result.current.confirmPublicInvite(first)).toBe(true));
    expect(mockConfirm).toHaveBeenCalledTimes(1);

    await act(async () => expect(await result.current.confirmPublicInvite(second)).toBe(true));
    expect(mockConfirm).toHaveBeenCalledTimes(2);
  });

  test("普通正文与私密主题不弹公开分享确认", async () => {
    const { result } = renderHook(() => usePublicInviteConfirmation());

    await act(async () => expect(
      await result.current.confirmPublicInvite("普通正文"),
    ).toBe(true));
    await act(async () => expect(
      await result.current.confirmPublicInvite("[入口](/join/AbCdEfGh_123-XYZ)", false),
    ).toBe(true));
    expect(mockConfirm).not.toHaveBeenCalled();
  });

  test("取消确认时不会把正文标记为已确认", async () => {
    mockConfirm.mockResolvedValue(false);
    const { result } = renderHook(() => usePublicInviteConfirmation());
    const content = "[入口](/join/AbCdEfGh_123-XYZ)";

    await act(async () => expect(await result.current.confirmPublicInvite(content)).toBe(false));
    await act(async () => expect(await result.current.confirmPublicInvite(content)).toBe(false));
    expect(mockConfirm).toHaveBeenCalledTimes(2);
  });

  test("成功发布后重置确认状态，下一次分享同一邀请仍需确认", async () => {
    const { result } = renderHook(() => usePublicInviteConfirmation());
    const content = "[入口](/join/AbCdEfGh_123-XYZ)";

    await act(async () => expect(await result.current.confirmPublicInvite(content)).toBe(true));
    act(() => result.current.resetPublicInviteConfirmation());
    await act(async () => expect(await result.current.confirmPublicInvite(content)).toBe(true));

    expect(mockConfirm).toHaveBeenCalledTimes(2);
  });
});

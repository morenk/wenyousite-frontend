/** useEmailCode hook 测试：发送状态与倒计时 */

import { beforeEach, describe, test, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useEmailCode } from "@/hooks/use-email-code";

describe("useEmailCode", () => {
  beforeEach(() => window.sessionStorage.clear());

  test("发送成功后启动倒计时并返回 true", async () => {
    const { result } = renderHook(() => useEmailCode());
    const run = vi.fn().mockResolvedValue(undefined);

    let ok = false;
    await act(async () => {
      ok = await result.current.send(run);
    });

    expect(ok).toBe(true);
    expect(run).toHaveBeenCalled();
    expect(result.current.countdown).toBe(60);
    expect(result.current.sending).toBe(false);
  });

  test("结果不明错误向上抛出并启动倒计时", async () => {
    const { result } = renderHook(() => useEmailCode());
    const run = vi.fn().mockRejectedValue(new Error("发送失败"));

    await act(async () => {
      await expect(result.current.send(run)).rejects.toThrow("发送失败");
    });

    expect(result.current.countdown).toBe(60);
    expect(result.current.sending).toBe(false);
  });

  test("明确业务错误不启动倒计时", async () => {
    const { result } = renderHook(() => useEmailCode());
    const run = vi.fn().mockRejectedValue({ code: 40900, message: "邮箱已注册" });

    await act(async () => {
      await expect(result.current.send(run)).rejects.toEqual({
        code: 40900,
        message: "邮箱已注册",
      });
    });

    expect(result.current.countdown).toBe(0);
  });

  test("跨认证页面恢复当前标签页中的剩余冷却", () => {
    window.sessionStorage.setItem(
      "wenyousite:email-code-cooldown-until",
      String(Date.now() + 30_000),
    );

    const { result } = renderHook(() => useEmailCode());

    expect(result.current.countdown).toBeGreaterThanOrEqual(29);
    expect(result.current.countdown).toBeLessThanOrEqual(30);
  });

  test("发送期间 sending 为 true", async () => {
    const { result } = renderHook(() => useEmailCode());
    let resolveRun: () => void = () => {};
    const run = vi.fn(() => new Promise<void>((r) => (resolveRun = r)));

    let sendPromise: Promise<boolean> | undefined;
    act(() => {
      sendPromise = result.current.send(run);
    });
    expect(result.current.sending).toBe(true);

    await act(async () => {
      resolveRun();
      await sendPromise;
    });
    expect(result.current.sending).toBe(false);
  });
});

describe("SendCodeButton", () => {
  test("文案随状态切换", async () => {
    const { render, screen, cleanup } = await import("@testing-library/react");
    const { SendCodeButton } = await import("@/components/auth/send-code-button");

    const onSend = vi.fn();
    const { rerender } = render(<SendCodeButton countdown={0} sending={false} sent={false} onSend={onSend} />);
    expect(screen.getByRole("button", { name: "发送验证码" })).toBeInTheDocument();

    rerender(<SendCodeButton countdown={30} sending={false} sent={false} onSend={onSend} />);
    expect(screen.getByRole("button", { name: "30 秒后重发" })).toBeDisabled();

    rerender(<SendCodeButton countdown={0} sending={false} sent={true} onSend={onSend} />);
    expect(screen.getByRole("button", { name: "重新发送" })).toBeEnabled();

    rerender(<SendCodeButton countdown={0} sending={true} sent={true} onSend={onSend} />);
    expect(screen.getByRole("button", { name: "发送中..." })).toBeDisabled();

    cleanup();
  });
});

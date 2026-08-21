/** 发送验证码按钮：自动切换「发送验证码 / 重新发送 / N 秒后重发 / 发送中」 */

"use client";

import { Button, type ButtonProps } from "@/components/ui/button";

export interface SendCodeButtonProps extends Omit<
  ButtonProps,
  "children" | "disabled" | "onClick" | "pending" | "pendingLabel" | "type"
> {
  countdown: number;
  sending: boolean;
  onSend: () => void;
  /** 已成功发送过一次，倒计时结束后显示「重新发送」 */
  sent?: boolean;
  disabled?: boolean;
  /** 首次文案，默认「发送验证码」 */
  initialLabel?: string;
}

export function SendCodeButton({
  countdown,
  sending,
  onSend,
  sent,
  disabled,
  initialLabel = "发送验证码",
  variant = "outline",
  ...buttonProps
}: SendCodeButtonProps) {
  const label = countdown > 0
      ? `${countdown} 秒后重发`
      : sent
        ? "重新发送"
        : initialLabel;

  return (
    <Button
      type="button"
      variant={variant}
      onClick={onSend}
      disabled={disabled || countdown > 0}
      pending={sending}
      pendingLabel="发送中..."
      {...buttonProps}
    >
      {label}
    </Button>
  );
}

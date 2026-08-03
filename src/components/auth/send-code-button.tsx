/** 发送验证码按钮：自动切换「发送验证码 / 重新发送 / N 秒后重发 / 发送中」 */

"use client";

import { Button } from "@/components/ui/button";

interface SendCodeButtonProps {
  countdown: number;
  sending: boolean;
  onSend: () => void;
  /** 已成功发送过一次，倒计时结束后显示「重新发送」 */
  sent?: boolean;
  disabled?: boolean;
  /** 首次文案，默认「发送验证码」 */
  initialLabel?: string;
  className?: string;
}

export function SendCodeButton({
  countdown,
  sending,
  onSend,
  sent,
  disabled,
  initialLabel = "发送验证码",
  className,
}: SendCodeButtonProps) {
  const label = sending
    ? "发送中..."
    : countdown > 0
      ? `${countdown} 秒后重发`
      : sent
        ? "重新发送"
        : initialLabel;

  return (
    <Button
      type="button"
      variant="outline"
      className={className}
      onClick={onSend}
      disabled={disabled || sending || countdown > 0}
    >
      {label}
    </Button>
  );
}

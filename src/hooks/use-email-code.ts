/** 邮箱验证码发送 hook：统一 60s 倒计时 + 发送状态，供注册/验证邮箱/换邮箱/重置密码复用 */

import { useCallback, useState } from "react";
import { useCountdown } from "@/hooks/use-countdown";

export function useEmailCode() {
  const { countdown, start } = useCountdown(60);
  const [sending, setSending] = useState(false);

  /**
   * 执行发送回调；成功后启动倒计时并返回 true。
   * 回调抛错则向上抛出（由调用方 toast），倒计时不启动。
   */
  const send = useCallback(
    async (run: () => Promise<void>): Promise<boolean> => {
      setSending(true);
      try {
        await run();
        start();
        return true;
      } finally {
        setSending(false);
      }
    },
    [start],
  );

  return { countdown, sending, send };
}

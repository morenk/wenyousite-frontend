/** 邮箱验证码发送 hook：统一 60s 倒计时、跨认证页冷却和结果不明保护。 */

import { useCallback, useEffect, useState } from "react";
import { API_ERROR_CODE, getApiError } from "@/api/errors";
import { useCountdown } from "@/hooks/use-countdown";

const EMAIL_CODE_COOLDOWN_SECONDS = 60;
const EMAIL_CODE_COOLDOWN_KEY = "wenyousite:email-code-cooldown-until";

export const EMAIL_SEND_UNCERTAIN_MESSAGE =
  "请求结果暂不确定，邮件可能已经发出；请先检查邮箱，60 秒后再试。";

export function isEmailSendOutcomeUnknown(error: unknown): boolean {
  const { code, status } = getApiError(error);
  return (status !== undefined && status >= 500) ||
    (code !== undefined && code >= 50000) ||
    (code === undefined && status === undefined);
}

export function shouldCooldownEmailSend(error: unknown): boolean {
  const { code, status } = getApiError(error);
  return code === API_ERROR_CODE.RATE_LIMITED ||
    status === 429 ||
    isEmailSendOutcomeUnknown(error);
}

export function useEmailCode() {
  const { countdown, start } = useCountdown(EMAIL_CODE_COOLDOWN_SECONDS);
  const [sending, setSending] = useState(false);

  const startCooldown = useCallback(() => {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(
        EMAIL_CODE_COOLDOWN_KEY,
        String(Date.now() + EMAIL_CODE_COOLDOWN_SECONDS * 1000),
      );
    }
    start();
  }, [start]);

  useEffect(() => {
    const raw = window.sessionStorage.getItem(EMAIL_CODE_COOLDOWN_KEY);
    const until = Number(raw);
    const remaining = Number.isFinite(until)
      ? Math.ceil((until - Date.now()) / 1000)
      : 0;
    if (remaining > 0) {
      start(Math.min(remaining, EMAIL_CODE_COOLDOWN_SECONDS));
    } else if (raw !== null) {
      window.sessionStorage.removeItem(EMAIL_CODE_COOLDOWN_KEY);
    }
  }, [start]);

  /**
   * 成功后启动倒计时；网络/5xx/429 的结果不明请求也进入冷却，
   * 避免用户在服务端仍处理上一请求时立即重发。
   */
  const send = useCallback(
    async (run: () => Promise<unknown>): Promise<boolean> => {
      setSending(true);
      try {
        await run();
        startCooldown();
        return true;
      } catch (error) {
        if (shouldCooldownEmailSend(error)) startCooldown();
        throw error;
      } finally {
        setSending(false);
      }
    },
    [startCooldown],
  );

  return { countdown, sending, send, startCooldown };
}

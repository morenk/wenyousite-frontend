"use client";

import { useState } from "react";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/api/errors";
import { useAdminSession, useAdminStepUp } from "@/api/hooks/use-admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function HighRiskGate({ children }: { children: React.ReactNode }) {
  const session = useAdminSession();
  const stepUp = useAdminStepUp();
  const [challengeId, setChallengeId] = useState<string>();
  const [code, setCode] = useState("");
  const elevated = Boolean(
    session.data?.session.elevatedUntil &&
      new Date(session.data.session.elevatedUntil) > new Date(),
  );

  if (elevated) return children;

  return (
    <div className="mx-auto mt-16 max-w-lg rounded-[var(--radius-panel)] border border-border bg-card p-8 text-center">
      <h2 className="text-xl font-semibold">邮箱验证</h2>
      {challengeId ? <p className="mt-3 text-sm text-muted-foreground">验证码已发送，验证后 10 分钟内有效。</p> : null}
      {challengeId ? (
        <form
          className="mx-auto mt-6 max-w-xs space-y-3"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!/^\d{6}$/.test(code)) {
              toast.error("请输入 6 位数字验证码");
              return;
            }
            try {
              await stepUp.verify.mutateAsync({ challengeId, code });
              toast.success("高风险操作确认完成");
            } catch (error) {
              toast.error(getApiErrorMessage(error, "验证码无效或已过期"));
            }
          }}
        >
          <Input
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            className="font-utility text-center text-lg tracking-[0.4em]"
            aria-label="邮箱验证码"
          />
          <Button type="submit" className="w-full" disabled={stepUp.verify.isPending}>
            {stepUp.verify.isPending ? "正在确认…" : "确认验证码"}
          </Button>
        </form>
      ) : (
        <Button
          type="button"
          className="mt-6"
          disabled={stepUp.challenge.isPending}
          onClick={async () => {
            try {
              const result = await stepUp.challenge.mutateAsync();
              setChallengeId(result.challengeId);
            } catch (error) {
              toast.error(getApiErrorMessage(error, "验证码发送失败"));
            }
          }}
        >
          {stepUp.challenge.isPending ? "正在发送…" : "发送邮箱验证码"}
        </Button>
      )}
    </div>
  );
}

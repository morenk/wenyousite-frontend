"use client";

import { MailCheck, ShieldEllipsis } from "lucide-react";
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
    <div className="mx-auto mt-16 max-w-lg rounded-2xl border border-border bg-card p-8 text-center">
      <span className="mx-auto flex size-12 items-center justify-center rounded-xl bg-warning-soft text-warning">
        {challengeId ? <MailCheck className="size-5" /> : <ShieldEllipsis className="size-5" />}
      </span>
      <h2 className="mt-5 font-display text-2xl font-bold">确认这次高风险操作</h2>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        {challengeId
          ? "验证码已发送到管理员绑定邮箱。验证后 10 分钟内无需重复确认。"
          : "站务账号管理、紧急开关和推翻申诉需要近期邮箱确认。"}
      </p>
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

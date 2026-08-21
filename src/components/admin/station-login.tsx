"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, KeyRound, MailCheck, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { useAdminLogin, useAdminSession } from "@/api/hooks/use-admin";
import { getApiErrorMessage } from "@/api/errors";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";

const credentialsSchema = z.object({
  account: z.string().trim().min(1, "请输入管理员账号"),
  password: z.string().min(8, "密码至少 8 位"),
});

const codeSchema = z.object({
  code: z.string().regex(/^\d{6}$/, "请输入 6 位数字验证码"),
});

type Credentials = z.infer<typeof credentialsSchema>;
type Code = z.infer<typeof codeSchema>;

export function StationLogin() {
  const router = useRouter();
  const session = useAdminSession();
  const { challenge, verify } = useAdminLogin();
  const [challengeId, setChallengeId] = useState<string>();
  const credentials = useForm<Credentials>({
    resolver: zodResolver(credentialsSchema),
    defaultValues: { account: "", password: "" },
  });
  const code = useForm<Code>({
    resolver: zodResolver(codeSchema),
    defaultValues: { code: "" },
  });

  useEffect(() => {
    if (session.data) router.replace("/station/dashboard");
  }, [router, session.data]);

  if (session.data) {
    return null;
  }

  return (
    <main className="grid min-h-screen min-w-[1080px] grid-cols-[1.08fr_0.92fr] bg-background">
      <section className="flex min-h-screen flex-col justify-between border-r border-border bg-muted/60 px-16 py-14">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <ShieldCheck className="size-5" />
          </span>
          <div>
            <p className="font-display text-xl font-medium">温油站务台</p>
            <p className="font-utility text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">
              独立管理工作区
            </p>
          </div>
        </div>

        <div className="max-w-xl">
          <p className="mb-5 font-utility text-xs font-bold tracking-[0.14em] text-brand-strong uppercase">
            把每次判断留下来
          </p>
          <h1 className="font-display text-[3.3rem] leading-[1.15] font-medium tracking-tight">
            处理问题，
            <br />也保留事情的来路。
          </h1>
          <p className="mt-7 max-w-lg text-base leading-8 text-muted-foreground">
            举报按目标聚合，证据、处置、公开说明和申诉形成同一条决定轨迹。这里仅对获邀站务开放。
          </p>
          <div className="mt-10 grid grid-cols-2 gap-4 text-sm">
            <div className="border-l-2 border-primary pl-4">
              <p className="font-bold">独立后台会话</p>
              <p className="mt-1 text-muted-foreground">不复用普通用户登录凭证</p>
            </div>
            <div className="border-l-2 border-secondary pl-4">
              <p className="font-bold">邮箱二次确认</p>
              <p className="mt-1 text-muted-foreground">高风险操作需要近期验证</p>
            </div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">仅支持电脑网页端 · 所有写操作都会留下审计记录</p>
      </section>

      <section className="flex items-center justify-center px-16 py-14">
        <div className="w-full max-w-[27rem]">
          <div className="mb-8 flex size-12 items-center justify-center rounded-xl bg-accent text-accent-foreground">
            {challengeId ? <MailCheck className="size-5" /> : <KeyRound className="size-5" />}
          </div>
          <p className="font-utility text-xs font-bold tracking-[0.12em] text-muted-foreground uppercase">
            {challengeId ? "第二步 · 邮箱确认" : "安全登录"}
          </p>
          <h2 className="mt-2 font-display text-3xl font-medium">
            {challengeId ? "查收邮箱验证码" : "进入站务工作区"}
          </h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {challengeId
              ? "验证码 10 分钟内有效。关闭页面不会建立任何管理员会话。"
              : "使用获邀温油账号的用户名或邮箱。密码验证后还需要邮箱确认。"}
          </p>

          {!challengeId ? (
            <form
              className="mt-8 space-y-5"
              onSubmit={credentials.handleSubmit(async (values) => {
                try {
                  const result = await challenge.mutateAsync(values);
                  setChallengeId(result.challengeId);
                } catch (error) {
                  toast.error(getApiErrorMessage(error, "无法开始管理员登录"));
                }
              })}
            >
              <FormField
                id="station-account"
                label="账号"
                error={credentials.formState.errors.account?.message}
                className="gap-2"
              >
                {(controlProps) => (
                  <Input {...controlProps} autoComplete="username" {...credentials.register("account")} />
                )}
              </FormField>
              <FormField
                id="station-password"
                label="密码"
                error={credentials.formState.errors.password?.message}
                className="gap-2"
              >
                {(controlProps) => (
                  <PasswordInput
                    {...controlProps}
                    autoComplete="current-password"
                    {...credentials.register("password")}
                  />
                )}
              </FormField>
              <Button
                type="submit"
                size="large"
                className="w-full"
                pending={challenge.isPending}
                pendingLabel="正在核验…"
              >
                继续邮箱确认<ArrowRight />
              </Button>
            </form>
          ) : (
            <form
              className="mt-8 space-y-5"
              onSubmit={code.handleSubmit(async (values) => {
                try {
                  await verify.mutateAsync({ challengeId, code: values.code });
                  router.replace("/station/dashboard");
                } catch (error) {
                  toast.error(getApiErrorMessage(error, "验证码无效或已过期"));
                }
              })}
            >
              <FormField
                id="station-code"
                label="6 位验证码"
                error={code.formState.errors.code?.message}
                className="gap-2"
              >
                {(controlProps) => (
                  <Input
                    {...controlProps}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    className="font-utility text-center text-xl tracking-[0.45em]"
                    {...code.register("code")}
                  />
                )}
              </FormField>
              <Button
                type="submit"
                size="large"
                className="w-full"
                pending={verify.isPending}
                pendingLabel="正在建立安全会话…"
              >
                进入站务台<ArrowRight />
              </Button>
              <Button type="button" variant="ghost" className="w-full" onClick={() => setChallengeId(undefined)}>
                返回修改账号
              </Button>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}

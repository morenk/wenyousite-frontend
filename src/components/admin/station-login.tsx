"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, KeyRound, MailCheck } from "lucide-react";
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
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-14">
      <section className="w-full max-w-[27rem]" aria-label="站务登录">
        <div className="mb-8 flex size-12 items-center justify-center rounded-xl bg-accent text-accent-foreground">
          {challengeId ? <MailCheck className="size-5" /> : <KeyRound className="size-5" />}
        </div>
        <h1 className="font-sans text-3xl font-semibold">
          {challengeId ? "查收邮箱验证码" : "站务登录"}
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {challengeId
            ? "验证码 10 分钟内有效。"
            : "仅限获邀账号，登录需验证邮箱。"}
        </p>

        {!challengeId ? (
          <form
            key="credentials"
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
            key="code"
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
      </section>
    </main>
  );
}

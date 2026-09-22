"use client";

import { safeAdminLoginReturn } from "@/lib/admin-session-url";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight } from "lucide-react";
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

export const credentialsSchema = z.object({
  account: z.string().trim().min(1, "请输入管理员账号").refine((value) => Array.from(value).length <= 254, "账号最多 254 个字符"),
  password: z.string().refine((value) => Array.from(value).length >= 8, "密码至少 8 位").refine((value) => Array.from(value).length <= 100, "密码最多 100 位"),
  rememberDevice: z.boolean(),
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
    defaultValues: { account: "", password: "", rememberDevice: false },
  });
  const code = useForm<Code>({
    resolver: zodResolver(codeSchema),
    defaultValues: { code: "" },
  });

  useEffect(() => {
    if (session.sessionStatus === "authenticated")
      router.replace(
        safeAdminLoginReturn(
          new URLSearchParams(window.location.search).get("returnTo"),
        ),
      );
  }, [router, session.sessionStatus]);

  if (session.sessionStatus === "authenticated") {
    return null;
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-14">
      <section className="w-full max-w-[27rem]" aria-label="温油站管理后台">
        <h1 className="font-sans text-3xl font-semibold">
          {challengeId ? "查收邮箱验证码" : "温油站管理后台"}
        </h1>
        {session.reason === "expired" && !challengeId ? (
          <p role="status" className="mt-3 text-sm text-muted-foreground">
            登录已失效，请重新登录
          </p>
        ) : null}
        {session.sessionStatus === "unavailable" ? (
          <div className="mt-3 flex items-center gap-2 text-sm">
            <span>暂时无法验证登录状态</span>
            <Button
              size="compact"
              variant="ghost"
              onClick={() => void session.refetch()}
            >
              重试
            </Button>
          </div>
        ) : null}
        {challengeId ? (
          <p className="mt-3 text-sm text-muted-foreground">
            验证码 10 分钟内有效。
          </p>
        ) : null}

        {!challengeId ? (
          <form
            key="credentials"
            className="mt-8 space-y-5"
            onSubmit={credentials.handleSubmit(async (values) => {
              try {
                const result = await challenge.mutateAsync({
                  account: values.account,
                  password: values.password,
                });
                credentials.resetField("password");
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
                <Input
                  {...controlProps}
                  autoComplete="username"
                  {...credentials.register("account")}
                />
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
            <label className="flex min-h-8 cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                {...credentials.register("rememberDevice")}
              />
              记住此设备（7天）
            </label>
            <Button
              type="submit"
              size="large"
              className="w-full"
              pending={challenge.isPending}
              pendingLabel="正在核验…"
            >
              继续
              <ArrowRight />
            </Button>
          </form>
        ) : (
          <form
            key="code"
            className="mt-8 space-y-5"
            onSubmit={code.handleSubmit(async (values) => {
              try {
                await verify.mutateAsync({
                  challengeId,
                  code: values.code,
                  rememberDevice: credentials.getValues("rememberDevice"),
                });
                code.reset();
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
              pendingLabel="正在登录…"
            >
              登录
              <ArrowRight />
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => {
                code.reset();
                setChallengeId(undefined);
              }}
            >
              返回修改账号
            </Button>
          </form>
        )}
      </section>
    </main>
  );
}

/** 登录页面：用户邮箱或用户名密码登录 */

"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { useAuth } from "@/lib/auth";
import { safeLoginNextPath } from "@/lib/login-redirect";
import { loginSchema, type LoginFormData } from "@/lib/validations/auth";
import { useLogin } from "@/api/hooks/use-login";
import { API_ERROR_CODE, getApiError } from "@/api/errors";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { AuthPageShell } from "@/components/auth/auth-page-shell";

function getNextPath() {
  if (typeof window === "undefined") return "/";
  const next = new URLSearchParams(window.location.search).get("next");
  return safeLoginNextPath(next);
}

export default function LoginPage() {
  const router = useRouter();
  const { setAuth } = useAuth();
  const loginMutation = useLogin();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (formData: LoginFormData) => {
    try {
      const result = await loginMutation.mutateAsync({
        account: formData.account,
        password: formData.password,
      });

      if (result.code === 0) {
        setAuth(result.data.user, result.data.accessToken);
        toast.success("登录成功");
        router.replace(getNextPath());
      }
    } catch (error: unknown) {
      const err = getApiError(error);
      if (err.code === API_ERROR_CODE.UNAUTHORIZED) {
        toast.error("账号或密码错误");
      } else if (err.code === API_ERROR_CODE.RATE_LIMITED) {
        toast.error("操作太频繁，请稍后再试");
      } else {
        toast.error(err.message || "登录失败");
      }
    }
  };

  return (
    <AuthPageShell
      title="登录温油站"
      description="使用用户名或邮箱登录。"
      footer={(
        <p className="text-sm text-muted-foreground">
          还没有账号？{" "}
          <Link
            href="/register"
            className="font-medium text-brand-strong hover:underline underline-offset-2"
          >
            立即注册
          </Link>
        </p>
      )}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <FormField id="account" label="邮箱或用户名" error={errors.account?.message}>
          {(controlProps) => (
              <Input
                  {...controlProps}
                  type="text"
                  placeholder="your@email.com 或用户名"
                  autoComplete="username"
                  {...register("account")}
                />
          )}
        </FormField>

        <FormField
          id="password"
          label="密码"
          labelAction={(
            <Link
              href="/forgot-password"
              className="text-xs text-muted-foreground underline-offset-2 hover:text-brand-strong hover:underline"
            >
              忘记密码？
            </Link>
          )}
          error={errors.password?.message}
        >
          {(controlProps) => (
                <PasswordInput
                  {...controlProps}
                  placeholder="输入密码"
                  autoComplete="current-password"
                  {...register("password")}
                />
          )}
        </FormField>

        <Button
          type="submit"
          size="lg"
          className="w-full"
          pending={loginMutation.isPending}
          pendingLabel="登录中..."
        >
          登录
        </Button>
      </form>
    </AuthPageShell>
  );
}

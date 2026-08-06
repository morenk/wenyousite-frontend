/** 登录页面：用户邮箱或用户名密码登录 */

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { useAuth } from "@/lib/auth";
import { loginSchema, type LoginFormData } from "@/lib/validations/auth";
import { useLogin } from "@/api/hooks/use-login";
import { getApiError } from "@/api/errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";

function getNextPath() {
  if (typeof window === "undefined") return "/";
  const next = new URLSearchParams(window.location.search).get("next");
  return next?.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export default function LoginPage() {
  const router = useRouter();
  const { user, setAuth, isInitialized } = useAuth();
  const loginMutation = useLogin();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  useEffect(() => {
    if (!isInitialized) return;
    if (user) {
      router.replace(getNextPath());
    }
  }, [user, router, isInitialized]);

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
      if (err.code === 40100) {
        toast.error("账号或密码错误");
      } else if (err.code === 42900) {
        toast.error("操作太频繁，请稍后再试");
      } else {
        toast.error(err.message || "登录失败");
      }
    }
  };

  if (!isInitialized) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (user) return null;

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <Card>
          <CardHeader>
            <CardTitle className="text-center text-xl">登录温油站</CardTitle>
            <CardDescription className="text-center">
              登录你的账号，开始共同创作
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="account">邮箱或用户名</Label>
                <Input
                  id="account"
                  type="text"
                  placeholder="your@email.com 或用户名"
                  autoComplete="username"
                  {...register("account")}
                />
                {errors.account && (
                  <p className="text-xs text-destructive">{errors.account.message}</p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">密码</Label>
                  <Link
                    href="/forgot-password"
                    className="text-xs text-muted-foreground hover:text-primary underline-offset-2 hover:underline"
                  >
                    忘记密码？
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="输入密码"
                  autoComplete="current-password"
                  {...register("password")}
                />
                {errors.password && (
                  <p className="text-xs text-destructive">{errors.password.message}</p>
                )}
              </div>

              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? "登录中..." : "登录"}
              </Button>
            </form>
          </CardContent>

          <CardFooter className="justify-center">
            <p className="text-sm text-muted-foreground">
              还没有账号？{" "}
              <Link
                href="/register"
                className="font-medium text-primary hover:underline underline-offset-2"
              >
                立即注册
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

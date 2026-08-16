/** 注册页面：两步流程（发验证码 → 填信息完成注册） */

"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { useAuth } from "@/lib/auth";
import {
  emailSchema,
  registerStep2Schema,
  type RegisterStep2FormData,
} from "@/lib/validations/auth";
import { useSendRegisterCode, useRegisterComplete } from "@/api/hooks/use-register";
import { API_ERROR_CODE, getApiError } from "@/api/errors";
import {
  EMAIL_SEND_UNCERTAIN_MESSAGE,
  isEmailSendOutcomeUnknown,
  useEmailCode,
} from "@/hooks/use-email-code";
import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function RegisterPage() {
  const router = useRouter();
  const { setAuth } = useAuth();
  const [step, setStep] = useState<"email" | "register">("email");
  const [email, setEmail] = useState("");
  const emailRef = useRef<HTMLInputElement>(null);
  const { countdown, sending, send } = useEmailCode();
  const sendCodeMutation = useSendRegisterCode();
  const registerMutation = useRegisterComplete();

  const {
    register: rhfRegister,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterStep2FormData>({
    resolver: zodResolver(registerStep2Schema),
  });

  const handleSendCode = async () => {
    const inputEmail = emailRef.current?.value || email;
    if (!inputEmail) {
      toast.error("请先输入邮箱");
      return;
    }

    const parsed = emailSchema.safeParse({ email: inputEmail });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }

    try {
      await send(async () => {
        const result = await sendCodeMutation.mutateAsync(parsed.data.email);
        if (result && result.data && result.data.emailSent === false) {
          toast.warning("验证码已生成但邮件发送失败，稍后可重试");
        } else {
          toast.success("验证码已发送，请查收邮箱");
        }
      });
      setEmail(parsed.data.email);
      setStep("register");
    } catch (error: unknown) {
      const err = getApiError(error);
      if (err.code === API_ERROR_CODE.CONFLICT) {
        toast.error("该邮箱已注册");
      } else if (err.code === API_ERROR_CODE.RATE_LIMITED || err.status === 429) {
        setEmail(parsed.data.email);
        setStep("register");
        toast.warning("操作太频繁，请先检查邮箱或 60 秒后再试");
      } else if (isEmailSendOutcomeUnknown(error)) {
        setEmail(parsed.data.email);
        setStep("register");
        toast.warning(EMAIL_SEND_UNCERTAIN_MESSAGE);
      } else {
        toast.error(err.message || "发送验证码失败");
      }
    }
  };

  /** 换一个邮箱注册：返回第一步重新输入 */
  const handleChangeEmail = () => {
    setEmail("");
    setStep("email");
  };

  const onSubmit = async (formData: RegisterStep2FormData) => {
    try {
      const result = await registerMutation.mutateAsync({
        email,
        code: formData.code,
        username: formData.username,
        password: formData.password,
      });

      if (result.code === 0) {
        setAuth(result.data.user, result.data.accessToken);
        toast.success("注册成功");
        router.replace("/");
      }
    } catch (error: unknown) {
      const err = getApiError(error);
      if (err.code === API_ERROR_CODE.BAD_REQUEST) {
        toast.error(err.message || "验证码错误或已过期");
      } else if (err.code === API_ERROR_CODE.CONFLICT) {
        toast.error("用户名已被占用");
      } else {
        toast.error(err.message || "注册失败");
      }
    }
  };

  return (
    <AuthPageShell
      title="注册温油站"
      description="设置邮箱、用户名和密码。"
      footer={(
        <p className="text-sm text-muted-foreground">
          已有账号？{" "}
          <Link
            href="/login"
            className="font-medium text-brand-strong hover:underline underline-offset-2"
          >
            去登录
          </Link>
        </p>
      )}
    >
      {step === "email" ? (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="email">邮箱</Label>
                  <Input
                    ref={emailRef}
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    autoComplete="email"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSendCode();
                    }}
                  />
                </div>

                <Button
                  type="button"
                  size="lg"
                  onClick={handleSendCode}
                  disabled={sending}
                  className="w-full"
                >
                  {sending ? "发送中..." : "获取验证码"}
                </Button>
              </div>
          ) : (
              <form
                onSubmit={handleSubmit(onSubmit)}
                className="flex flex-col gap-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <Label>邮箱</Label>
                  <Button
                    type="button"
                    variant="link"
                    size="xs"
                    onClick={handleChangeEmail}
                    className="h-auto p-0"
                  >
                    换个邮箱
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">{email}</p>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="code">验证码</Label>
                  <Input
                    id="code"
                    placeholder="6 位数字"
                    maxLength={6}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    {...rhfRegister("code")}
                  />
                  {errors.code && (
                    <p className="text-xs text-destructive">
                      {errors.code.message}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {countdown > 0
                      ? `${countdown} 秒后可重新发送`
                      : countdown === 0 && !sending && (
                          <Button
                            type="button"
                            variant="link"
                            size="xs"
                            className="h-auto p-0 align-baseline"
                            onClick={handleSendCode}
                          >
                            重新发送验证码
                          </Button>
                        )}
                  </p>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="username">用户名</Label>
                  <Input
                    id="username"
                    placeholder="2-24 位，字母、数字、中文"
                    autoComplete="username"
                    {...rhfRegister("username")}
                  />
                  {errors.username && (
                    <p className="text-xs text-destructive">
                      {errors.username.message}
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="password">密码</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="至少 8 位，含字母和数字"
                    autoComplete="new-password"
                    {...rhfRegister("password")}
                  />
                  {errors.password && (
                    <p className="text-xs text-destructive">
                      {errors.password.message}
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="confirm-password">确认密码</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    placeholder="再次输入密码"
                    autoComplete="new-password"
                    {...rhfRegister("confirmPassword")}
                  />
                  {errors.confirmPassword && (
                    <p className="text-xs text-destructive">
                      {errors.confirmPassword.message}
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  size="lg"
                  disabled={registerMutation.isPending}
                  className="w-full"
                >
                  {registerMutation.isPending ? "注册中..." : "注册"}
                </Button>
              </form>
          )}
    </AuthPageShell>
  );
}

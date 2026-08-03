/** 注册页面：两步流程（发验证码 → 填信息完成注册） */

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { useAuth } from "@/lib/auth";
import {
  emailSchema,
  registerStep2Schema,
  type RegisterStep2FormData,
} from "@/lib/validations/auth";
import { useSendRegisterCode, useRegisterComplete } from "@/api/hooks/use-register";
import { useEmailCode } from "@/hooks/use-email-code";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";

export default function RegisterPage() {
  const router = useRouter();
  const { user, setAuth, isInitialized } = useAuth();
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

  useEffect(() => {
    if (!isInitialized) return;
    if (user) {
      router.replace("/");
    }
  }, [user, router, isInitialized]);

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
      const err = error as { code?: number; message?: string };
      if (err.code === 40900) {
        toast.error("该邮箱已注册");
      } else if (err.code === 42900) {
        toast.warning("操作太频繁，请稍后再试");
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
      const err = error as { code?: number; message?: string };
      if (err.code === 40001) {
        toast.error(err.message || "验证码错误或已过期");
      } else if (err.code === 40900) {
        toast.error("用户名已被占用");
      } else {
        toast.error(err.message || "注册失败");
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

  const inputClass =
    "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30";
  const btnClass =
    "inline-flex shrink-0 h-9 w-full items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-medium whitespace-nowrap transition-all outline-none select-none hover:bg-primary/80 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50";

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <Card>
          <CardHeader>
            <CardTitle className="text-center text-xl">注册温油站</CardTitle>
            <CardDescription className="text-center">
              创建账号，加入共同创作
            </CardDescription>
          </CardHeader>

          {step === "email" ? (
            <CardContent>
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="email"
                    className="flex items-center gap-2 text-sm leading-none font-medium select-none"
                  >
                    邮箱
                  </label>
                  <input
                    ref={emailRef}
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    autoComplete="email"
                    className={inputClass}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSendCode();
                    }}
                  />
                </div>

                <button
                  type="button"
                  onClick={handleSendCode}
                  disabled={sending}
                  className={btnClass}
                >
                  {sending ? "发送中..." : "获取验证码"}
                </button>
              </div>
            </CardContent>
          ) : (
            <CardContent>
              <form
                onSubmit={handleSubmit(onSubmit)}
                className="flex flex-col gap-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-sm leading-none font-medium select-none">
                    邮箱
                  </label>
                  <button
                    type="button"
                    onClick={handleChangeEmail}
                    className="text-xs text-primary hover:underline"
                  >
                    换个邮箱
                  </button>
                </div>
                <p className="text-sm text-muted-foreground">{email}</p>

                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="code"
                    className="flex items-center gap-2 text-sm leading-none font-medium select-none"
                  >
                    验证码
                  </label>
                  <input
                    id="code"
                    placeholder="6 位数字"
                    maxLength={6}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    className={inputClass}
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
                          <button
                            type="button"
                            className="text-primary hover:underline"
                            onClick={handleSendCode}
                          >
                            重新发送验证码
                          </button>
                        )}
                  </p>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="username"
                    className="flex items-center gap-2 text-sm leading-none font-medium select-none"
                  >
                    用户名
                  </label>
                  <input
                    id="username"
                    placeholder="2-24 位，字母、数字、中文"
                    autoComplete="username"
                    className={inputClass}
                    {...rhfRegister("username")}
                  />
                  {errors.username && (
                    <p className="text-xs text-destructive">
                      {errors.username.message}
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="password"
                    className="flex items-center gap-2 text-sm leading-none font-medium select-none"
                  >
                    密码
                  </label>
                  <input
                    id="password"
                    type="password"
                    placeholder="至少 8 位，含字母和数字"
                    autoComplete="new-password"
                    className={inputClass}
                    {...rhfRegister("password")}
                  />
                  {errors.password && (
                    <p className="text-xs text-destructive">
                      {errors.password.message}
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="confirm-password"
                    className="flex items-center gap-2 text-sm leading-none font-medium select-none"
                  >
                    确认密码
                  </label>
                  <input
                    id="confirm-password"
                    type="password"
                    placeholder="再次输入密码"
                    autoComplete="new-password"
                    className={inputClass}
                    {...rhfRegister("confirmPassword")}
                  />
                  {errors.confirmPassword && (
                    <p className="text-xs text-destructive">
                      {errors.confirmPassword.message}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={registerMutation.isPending}
                  className={btnClass}
                >
                  {registerMutation.isPending ? "注册中..." : "注册"}
                </button>
              </form>
            </CardContent>
          )}

          <CardFooter className="justify-center">
            <p className="text-sm text-muted-foreground">
              已有账号？{" "}
              <Link
                href="/login"
                className="font-medium text-primary hover:underline underline-offset-2"
              >
                去登录
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

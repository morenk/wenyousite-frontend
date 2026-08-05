/** 修改密码表单：当前密码/新密码/确认新密码，成功后登出并跳转登录页 */

"use client";

import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useChangePassword } from "@/api/hooks/use-auth-actions";
import {
  changePasswordSchema,
  type ChangePasswordFormData,
} from "@/lib/validations/auth";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";

export function ChangePasswordForm() {
  const router = useRouter();
  const { logout } = useAuth();
  const changePassword = useChangePassword();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { oldPassword: "", newPassword: "", confirmPassword: "" },
  });

  const onSubmit = async (values: ChangePasswordFormData) => {
    try {
      await changePassword.mutateAsync({
        oldPassword: values.oldPassword,
        newPassword: values.newPassword,
      });
      toast.success("密码已修改，请重新登录");
      // 后端已吊销全部 refresh token，所有登录终端强制退出
      logout();
      router.replace("/login");
    } catch (err) {
      const e = err as { message?: string };
      toast.error(e.message || "修改失败，请稍后重试");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="old-password">当前密码</Label>
        <PasswordInput
          id="old-password"
          autoComplete="current-password"
          {...register("oldPassword")}
        />
        {errors.oldPassword && (
          <p className="text-xs text-destructive">{errors.oldPassword.message}</p>
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="new-password">新密码</Label>
        <PasswordInput
          id="new-password"
          autoComplete="new-password"
          placeholder="至少 8 位，需包含字母和数字"
          {...register("newPassword")}
        />
        {errors.newPassword && (
          <p className="text-xs text-destructive">{errors.newPassword.message}</p>
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirm-password">确认新密码</Label>
        <PasswordInput
          id="confirm-password"
          autoComplete="new-password"
          {...register("confirmPassword")}
        />
        {errors.confirmPassword && (
          <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>
        )}
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={changePassword.isPending}>
          {changePassword.isPending ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : null}
          保存新密码
        </Button>
      </div>
    </form>
  );
}

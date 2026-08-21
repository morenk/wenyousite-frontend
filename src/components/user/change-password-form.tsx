/** 修改密码表单：当前密码/新密码/确认新密码，成功后登出并跳转登录页 */

"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useChangePassword } from "@/api/hooks/use-auth-actions";
import { getApiErrorMessage } from "@/api/errors";
import {
  changePasswordSchema,
  type ChangePasswordFormData,
} from "@/lib/validations/auth";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { PasswordInput } from "@/components/ui/password-input";

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
      toast.error(getApiErrorMessage(err, "修改失败，请稍后重试"));
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <FormField id="old-password" label="当前密码" error={errors.oldPassword?.message}>
        {(controlProps) => (
          <PasswordInput
            {...controlProps}
            autoComplete="current-password"
            {...register("oldPassword")}
          />
        )}
      </FormField>
      <FormField id="new-password" label="新密码" error={errors.newPassword?.message}>
        {(controlProps) => (
          <PasswordInput
            {...controlProps}
            autoComplete="new-password"
            placeholder="至少 8 位，需包含字母和数字"
            {...register("newPassword")}
          />
        )}
      </FormField>
      <FormField id="confirm-password" label="确认新密码" error={errors.confirmPassword?.message}>
        {(controlProps) => (
          <PasswordInput
            {...controlProps}
            autoComplete="new-password"
            {...register("confirmPassword")}
          />
        )}
      </FormField>
      <div className="flex justify-end">
        <Button
          type="submit"
          pending={changePassword.isPending}
          pendingLabel="保存中…"
        >
          保存新密码
        </Button>
      </div>
    </form>
  );
}

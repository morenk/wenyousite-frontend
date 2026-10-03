"use client";

import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useUpdateProfile } from "@/api/hooks/use-update-profile";
import { getApiError } from "@/api/errors";
import {
  usernameSchema,
  type UsernameFormData,
} from "@/lib/validations/profile";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import {
  SettingsDialog,
  SettingsSaveFooter,
  type SettingsDialogProps,
} from "./settings-controls";

export function UsernameEdit({
  currentUsername,
  onClose,
  returnFocus,
}: Pick<SettingsDialogProps, "onClose" | "returnFocus"> & {
  currentUsername: string;
}) {
  const { user, accessToken, setAuth } = useAuth();
  const updateProfile = useUpdateProfile();
  const form = useForm<UsernameFormData>({
    resolver: zodResolver(usernameSchema),
    defaultValues: { username: currentUsername },
  });
  const value = useWatch({ control: form.control, name: "username" });
  const dirty = value.trim() !== currentUsername;
  const { isSubmitting, dirtyFields } = form.formState;
  // 订阅脏字段，后台刷新不得覆盖正在编辑的用户名。
  void dirtyFields;
  const busy = updateProfile.isPending || isSubmitting;
  const { reset } = form;
  useEffect(() => {
    reset(
      { username: currentUsername },
      { keepDirtyValues: true, keepErrors: true },
    );
  }, [currentUsername, reset]);
  const save = form.handleSubmit(async ({ username }) => {
    const next = username.trim();
    if (!dirty || updateProfile.isPending) return;
    try {
      await updateProfile.mutateAsync({ username: next });
      if (user && accessToken)
        setAuth({ ...user, username: next }, accessToken);
      toast.success("用户名已更新");
      onClose?.();
    } catch (error) {
      const apiError = getApiError(error);
      form.setError("username", {
        message:
          apiError.code === 40900
            ? "用户名已被占用"
            : apiError.code === 42900
              ? "操作太频繁，请稍后再试"
              : apiError.message || "修改失败，请稍后重试",
      });
    }
  });
  return (
    <SettingsDialog
      title="修改用户名"
      onClose={onClose}
      returnFocus={returnFocus}
      dirty={dirty}
      busy={busy}
    >
      <form onSubmit={save}>
        <FormField
          id="username"
          label="新用户名"
          description="2–24 位，支持字母、数字和中文。修改后 7 天内不可再次修改。"
          error={form.formState.errors.username?.message}
        >
          {(props) => (
            <Input
              {...props}
              autoFocus
              autoComplete="username"
              disabled={busy}
              {...form.register("username", {
                setValueAs: (value: string) => value.trim(),
                onChange: () => form.clearErrors(),
              })}
            />
          )}
        </FormField>
        <SettingsSaveFooter busy={busy} disabled={!dirty} />
      </form>
    </SettingsDialog>
  );
}

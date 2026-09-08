"use client";

import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useUpdateProfile } from "@/api/hooks/use-update-profile";
import { getApiError } from "@/api/errors";
import { usernameSchema, type UsernameFormData } from "@/lib/validations/profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Dialog, DialogBackdrop, DialogCloseButton, DialogDescription, DialogPopup, DialogPortal, DialogTitle, DialogViewport } from "@/components/ui/dialog";

export function UsernameEdit({ currentUsername, disabled = false, onStatusChange }: {
  currentUsername: string;
  disabled?: boolean;
  onStatusChange?: (status: { dirty: boolean; busy: boolean }) => void;
}) {
  const { user, accessToken, setAuth } = useAuth();
  const updateProfile = useUpdateProfile();
  const [editing, setEditing] = useState(false);
  const form = useForm<UsernameFormData>({ resolver: zodResolver(usernameSchema), defaultValues: { username: currentUsername } });
  const value = useWatch({ control: form.control, name: "username" });
  const dirty = editing && value.trim() !== currentUsername;
  useEffect(() => {
    onStatusChange?.({ dirty, busy: updateProfile.isPending });
  }, [dirty, updateProfile.isPending, onStatusChange]);
  useEffect(() => () => onStatusChange?.({ dirty: false, busy: false }), [onStatusChange]);

  const close = () => {
    if (updateProfile.isPending) return;
    setEditing(false);
    form.reset({ username: currentUsername });
  };
  const save = form.handleSubmit(async ({ username }) => {
    const next = username.trim();
    if (next === currentUsername) { close(); return; }
    try {
      await updateProfile.mutateAsync({ username: next });
      if (user && accessToken) setAuth({ ...user, username: next }, accessToken);
      toast.success("用户名已更新");
      setEditing(false);
    } catch (error) {
      const apiError = getApiError(error);
      form.setError("username", { message: apiError.code === 40900 ? "用户名已被占用" : apiError.code === 42900 ? "操作太频繁，请稍后再试" : apiError.message || "修改失败，请稍后重试" });
    }
  });

  return (
    <div className="flex min-w-0 items-center justify-between gap-6 border-t border-border pt-6">
      <div className="min-w-0"><p className="mb-2 text-sm font-semibold">用户名</p><p className="break-words text-sm">{currentUsername}</p></div>
      <Button type="button" variant="outline" size="default" disabled={disabled} onClick={() => { form.reset({ username: currentUsername }); setEditing(true); }}>修改用户名</Button>
      <Dialog open={editing} onOpenChange={(open) => { if (!open) close(); }} disablePointerDismissal={updateProfile.isPending}>
        <DialogPortal><DialogBackdrop /><DialogViewport><DialogPopup className="max-w-md p-6">
          <div className="flex items-center justify-between gap-4"><DialogTitle>修改用户名</DialogTitle><DialogCloseButton label="关闭用户名修改" disabled={updateProfile.isPending} /></div>
          <DialogDescription className="mt-2 text-sm text-muted-foreground">修改后 7 天内不可再次修改。</DialogDescription>
          <form onSubmit={save} className="mt-6 space-y-6">
            <FormField id="username" label="新用户名" description="2–24 位，支持字母、数字和中文。" error={form.formState.errors.username?.message}>
              {(props) => <Input {...props} autoFocus placeholder="输入新用户名" autoComplete="username" disabled={updateProfile.isPending} {...form.register("username", { setValueAs: (value: string) => value.trim() })} />}
            </FormField>
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={updateProfile.isPending} onClick={close}>取消</Button><Button type="submit" pending={updateProfile.isPending} pendingLabel="保存中">保存用户名</Button></div>
          </form>
        </DialogPopup></DialogViewport></DialogPortal>
      </Dialog>
    </div>
  );
}

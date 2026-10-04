"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { getApiErrorMessage } from "@/api/errors";
import { UserAvatar } from "@/components/shared/user-avatar";
import { SettingsDialog } from "@/components/user/settings-controls";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DialogFooter } from "@/components/ui/dialog";
import { useConfirm } from "@/components/ui/confirm-provider";
import type { MediaDisplay } from "@/lib/media-display";

const identityFormSchema = z.object({ nickname: z.string().trim().refine((name) => Array.from(name).length <= 24, "帖内昵称最多24个字符").regex(/^[^\\[\]<>\p{Cc}\p{Cf}]*$/u, "昵称不能包含方括号、反斜线、尖括号或控制字符") });
type IdentityFormValues = z.infer<typeof identityFormSchema>;

interface ThreadIdentityEditorProps {
  accountUsername: string;
  nickname: string | null;
  avatar: string | null;
  avatarDisplay?: MediaDisplay | null;
  hasCustomIdentity: boolean;
  disabled?: boolean;
  onSave: (nickname: string | null) => Promise<unknown>;
  onClear: () => Promise<unknown>;
  onAvatar: () => void;
  onClose: () => void;
}

export function ThreadIdentityEditor({
  accountUsername, nickname, avatar, avatarDisplay, hasCustomIdentity,
  disabled, onSave, onClear, onAvatar, onClose,
}: ThreadIdentityEditorProps) {
  const form = useForm<IdentityFormValues>({
    resolver: zodResolver(identityFormSchema),
    defaultValues: { nickname: nickname ?? "" },
  });
  const previewNickname = useWatch({ control: form.control, name: "nickname" });
  const [clearing, setClearing] = useState(false);
  const confirm = useConfirm();
  const pending = form.formState.isSubmitting || clearing;
  const clear = async () => {
    if (pending || disabled) return;
    if (!await confirm({
      title: "清除帖内资料",
      description: "之后的发言将使用站内资料，旧发言的角色身份会保留。",
      confirmLabel: "清除资料", destructive: true,
    })) return;
    setClearing(true);
    form.clearErrors();
    try { await onClear(); onClose(); }
    catch (error) { form.setError("root", { message: getApiErrorMessage(error, "清除失败，请重试") }); }
    finally { setClearing(false); }
  };
  return (
    <SettingsDialog title="设置帖内身份" onClose={onClose} dirty={form.formState.isDirty} busy={pending}>
      <p className="mb-4 text-sm leading-6 text-muted-foreground">
        仅本主题及其全部子贴可见。修改只影响之后发表的内容，站内账号仍可在身份卡中查看。
      </p>
      <form onSubmit={form.handleSubmit(async (values) => {
        if (disabled) return;
        form.clearErrors();
        try { await onSave(values.nickname || null); onClose(); }
        catch (error) { form.setError("root", { message: getApiErrorMessage(error, "保存失败，请重试") }); }
      })} className="space-y-4">
        <div className="flex items-center gap-3">
          <UserAvatar name={previewNickname?.trim() || accountUsername} src={avatar} display={avatarDisplay} className="size-14" textClassName="text-xl" />
          <Button type="button" variant="outline" size="sm" disabled={pending || disabled} onClick={onAvatar}>设置帖内头像</Button>
        </div>
        <div className="space-y-2">
          <Label htmlFor="rp-nickname">帖内昵称</Label>
          <Input id="rp-nickname" autoComplete="off" placeholder={accountUsername}
            {...form.register("nickname")} disabled={pending || disabled} aria-describedby="rp-nickname-help" />
          {form.formState.errors.nickname ? <p role="alert" className="text-sm text-destructive">{form.formState.errors.nickname.message}</p> : null}
          <p id="rp-nickname-help" className="text-xs text-muted-foreground">留空则使用站内昵称；昵称和头像分别设置。</p>
          <p className="text-xs text-muted-foreground">站内账号：{accountUsername}</p>
        </div>
        {disabled ? <p role="alert" className="text-sm text-muted-foreground">帖内身份当前不可修改，本地输入已保留。</p> : null}
        {form.formState.errors.root ? <p role="alert" className="text-sm text-destructive">{form.formState.errors.root.message}</p> : null}
        <DialogFooter>
          {hasCustomIdentity ? <Button type="button" variant="ghost" className="mr-auto" disabled={pending || disabled} onClick={() => void clear()}>清除帖内资料</Button> : null}
          <Button type="submit" pending={pending} disabled={disabled} pendingLabel="保存中">保存帖内身份</Button>
        </DialogFooter>
      </form>
    </SettingsDialog>
  );
}

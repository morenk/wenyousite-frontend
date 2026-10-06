"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { Pencil } from "lucide-react";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { RpProfilePostLinkError } from "@/api/hooks/use-rp-profile-post";
import { getApiErrorMessage } from "@/api/errors";
import { ThreadIdentitySummary } from "./thread-identity-summary";
import { SettingsDialog } from "@/components/user/settings-controls";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DialogFooter } from "@/components/ui/dialog";
import { useConfirm } from "@/components/ui/confirm-provider";
import type { MediaDisplay } from "@/lib/media-display";

const identityFormSchema = z.object({ profileLink: z.string().trim(), nickname: z.string().trim().refine((name) => Array.from(name).length <= 24, "帖内昵称最多24个字符").regex(/^[^\\[\]<>\p{Cc}\p{Cf}]*$/u, "昵称不能包含方括号、反斜线、尖括号或控制字符") });
type IdentityFormValues = z.infer<typeof identityFormSchema>;

interface ThreadIdentityEditorProps {
  accountUsername: string;
  nickname: string | null;
  avatar: string | null;
  avatarDisplay?: MediaDisplay | null;
  existingIdentity: boolean;
  profileSupported?: boolean;
  profileLink?: string;
  onProfileLinkChange?: (value: string) => void;
  disabled?: boolean;
  canDelete?: boolean;
  onSave: (nickname: string | null, profileLink?: string) => Promise<unknown>;
  onDelete: () => Promise<unknown>;
  onAvatar: () => void;
  onClose: () => void;
  onNicknameChange?: (value: string) => void;
  feedback?: ReactNode;
}

export function ThreadIdentityEditor({
  accountUsername, nickname, avatar, avatarDisplay, existingIdentity, profileSupported = false, profileLink = "", onProfileLinkChange,
  disabled, canDelete = existingIdentity, onSave, onDelete, onAvatar, onClose, onNicknameChange, feedback,
}: ThreadIdentityEditorProps) {
  const form = useForm<IdentityFormValues>({
    resolver: zodResolver(identityFormSchema),
    defaultValues: { nickname: nickname ?? "", profileLink },
  });
  const nicknameId = useId();
  const errorId = useId();
  const profileId = useId();
  const profileErrorId = useId();
  const watchedProfileLink = useWatch({ control: form.control, name: "profileLink" });
  useEffect(() => { if (profileSupported) onProfileLinkChange?.(watchedProfileLink ?? ""); }, [profileSupported, watchedProfileLink, onProfileLinkChange]);
  const previewNickname = useWatch({ control: form.control, name: "nickname" });
  useEffect(() => { onNicknameChange?.(previewNickname ?? ""); }, [previewNickname, onNicknameChange]);
  const appearance = { name: previewNickname?.trim() || accountUsername, avatar, avatarDisplay };
  const [clearing, setClearing] = useState(false);
  const confirm = useConfirm();
  const pending = form.formState.isSubmitting || clearing;
  const clear = async () => {
    if (pending || !canDelete) return;
    setClearing(true);
    let accepted: boolean;
    try { accepted = await confirm({
      title: "删除帖内身份",
      description: "删除后不能再用这个身份发表，旧发言仍保留当时的头像和昵称。",
      confirmLabel: "删除身份", destructive: true,
    }); } catch { setClearing(false); return; }
    if (!accepted) { setClearing(false); return; }
    form.clearErrors();
    try { await onDelete(); onClose(); }
    catch (error) { form.setError("root", { message: getApiErrorMessage(error, "删除失败，请重试") }); }
    finally { setClearing(false); }
  };
  return (
    <SettingsDialog title={existingIdentity ? "编辑帖内资料" : "设置帖内身份"} onClose={onClose} dirty={form.formState.isDirty} busy={pending}>
      <form onSubmit={form.handleSubmit(async (values) => {
        if (disabled) return;
        form.clearErrors();
        try { if (await (profileSupported ? onSave(values.nickname || null, values.profileLink) : onSave(values.nickname || null)) !== false) onClose(); }
        catch (error) { form.setError(error instanceof RpProfilePostLinkError ? "profileLink" : "root", { message: getApiErrorMessage(error, "保存失败，请重试") }); }
      })} className="space-y-4">
        <div className="py-1">
          <ThreadIdentitySummary appearance={appearance}
            avatarSlot={<Button type="button" variant="ghost" aria-label="修改帖内头像" title="修改帖内头像"
              className="relative size-12 shrink-0 rounded-full p-0" disabled={pending || disabled} onClick={onAvatar}>
              <UserAvatar name={appearance.name} src={avatar} display={avatarDisplay} className="size-12" textClassName="text-lg" />
              <span aria-hidden="true" className="absolute bottom-0 right-0 flex size-5 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm">
                <Pencil className="size-3" />
              </span>
            </Button>} />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor={nicknameId}>帖内昵称</Label>
            <span className="text-xs tabular-nums text-muted-foreground" aria-hidden="true">{Array.from(previewNickname?.trim() ?? "").length}/24</span>
          </div>
          <Input id={nicknameId} autoComplete="off" placeholder={accountUsername}
            {...form.register("nickname")} disabled={pending || disabled}
            aria-invalid={Boolean(form.formState.errors.nickname)}
            aria-describedby={form.formState.errors.nickname ? errorId : undefined} />
          {form.formState.errors.nickname ? <p id={errorId} role="alert" className="text-sm text-destructive">{form.formState.errors.nickname.message}</p> : null}
        </div>
        {profileSupported ? <div className="space-y-2">
          <Label htmlFor={profileId}>资料楼层链接</Label>
          <Input id={profileId} autoComplete="off" type="text" placeholder="粘贴当前主题的楼层链接"
            {...form.register("profileLink")} disabled={pending || disabled}
            aria-invalid={Boolean(form.formState.errors.profileLink)}
            aria-describedby={form.formState.errors.profileLink ? profileErrorId : undefined} />
          {form.formState.errors.profileLink ? <p id={profileErrorId} role="alert" className="text-sm text-destructive">{form.formState.errors.profileLink.message}</p> : null}
        </div> : null}
        {disabled ? <p role="alert" className="text-sm text-muted-foreground">帖内身份当前不可修改，本地输入已保留。</p> : null}
        {form.formState.errors.root ? <p role="alert" className="text-sm text-destructive">{form.formState.errors.root.message}</p> : null}
        {feedback}
        <DialogFooter className="flex-wrap">
          {existingIdentity ? <Button type="button" variant="ghost" className="mr-auto" disabled={pending || !canDelete} onClick={() => void clear()}>删除帖内身份</Button> : null}
          <Button type="submit" pending={pending} disabled={disabled} pendingLabel="保存中">{existingIdentity ? profileSupported ? "保存资料" : "保存昵称" : "创建身份"}</Button>
        </DialogFooter>
      </form>
    </SettingsDialog>
  );
}

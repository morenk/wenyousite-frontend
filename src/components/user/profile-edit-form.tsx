"use client";

import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { levelTier } from "@wenyousite/foundation/elements";
import { useMe } from "@/api/hooks/use-me";
import { useUpdateProfile } from "@/api/hooks/use-update-profile";
import { getApiError } from "@/api/errors";
import { profileSchema, type ProfileFormData } from "@/lib/validations/profile";
import { UsernameEdit } from "@/components/user/username-edit";
import { useSettingsLeaveGuard } from "@/components/user/use-settings-leave-guard";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Skeleton } from "@/components/ui/skeleton";
import { LoadError } from "@/components/shared/load-error";
import { LevelBadge } from "@/components/shared/level-badge";
import { formatWenyou } from "@/lib/wenyou";

const privacyFields = [
  { name: "showRecentReplies", label: "公开最近回复", description: "允许他人在你的主页查看最近回复。" },
  { name: "showPlayerBadges", label: "公开玩家标记", description: "允许他人在你的主页查看参与的主题帖。" },
  { name: "showBookmarks", label: "公开收藏", description: "允许他人查看收藏内容；收藏夹名称与归类仅自己可见。" },
] as const;

export function ProfileEditForm({ section = "profile" }: { section?: "profile" | "privacy" }) {
  const { data: me, isLoading, error, refetch } = useMe();
  const updateProfile = useUpdateProfile();
  const [saved, setSaved] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState({ dirty: false, busy: false });
  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: { bio: "", showRecentReplies: true, showPlayerBadges: true, showBookmarks: true },
  });
  const { register, handleSubmit, reset, control, setError, clearErrors } = form;
  const { errors, dirtyFields } = form.formState;
  const bio = useWatch({ control, name: "bio" }) ?? "";
  const dirty = section === "profile" ? !!dirtyFields.bio : privacyFields.some(({ name }) => dirtyFields[name]);
  const busy = updateProfile.isPending;
  useSettingsLeaveGuard(dirty || usernameStatus.dirty, busy || usernameStatus.busy);

  useEffect(() => {
    if (me) reset({ bio: me.bio ?? "", showRecentReplies: me.showRecentReplies, showPlayerBadges: me.showPlayerBadges, showBookmarks: me.showBookmarks }, { keepDirtyValues: true, keepErrors: true });
  }, [me, reset]);

  const save = handleSubmit(async (values) => {
    if (!dirty || busy) return;
    clearErrors("root");
    setSaved(false);
    if (section === "profile" && !values.bio?.trim()) {
      setError("bio", { message: "简介不能为空；暂不支持清空已填写的简介。" }, { shouldFocus: true });
      return;
    }
    const changes = section === "profile" ? { bio: values.bio!.trim() } : {
      showRecentReplies: values.showRecentReplies,
      showPlayerBadges: values.showPlayerBadges,
      showBookmarks: values.showBookmarks,
    };
    try {
      await updateProfile.mutateAsync(changes);
      reset({ ...values, ...changes });
      setSaved(true);
    } catch (error) {
      const apiError = getApiError(error);
      const message = apiError.code === 42900 ? "操作太频繁，请稍后再试" : apiError.message || "保存失败，请稍后重试";
      setError(section === "profile" && (apiError.status === 400 || apiError.code === 40000 || apiError.code === 40001) ? "bio" : "root", { message });
    }
  });

  if (isLoading && !me) return <Skeleton role="status" aria-label="正在加载资料" className="h-64 w-full rounded-xl" />;
  if (!me) return <LoadError title="资料加载失败" onRetry={() => void refetch()} />;
  const tier = levelTier(me.level);
  const experiencePercent = me.nextLevelExperience === null ? 100 : Math.max(0, Math.min(100, (me.experience - me.currentLevelExperience) / (me.nextLevelExperience - me.currentLevelExperience) * 100));

  return (
    <div className="space-y-6">
      {error ? <p role="alert" className="text-sm text-destructive">资料刷新失败，当前输入已保留。<Button variant="link" size="compact" onClick={() => void refetch()}>重试</Button></p> : null}
      {section === "profile" ? <UsernameEdit currentUsername={me.username} onStatusChange={setUsernameStatus} /> : null}
      <form onSubmit={save} onChange={() => { clearErrors("root"); setSaved(false); }} className="space-y-6">
        {section === "profile" ? (
          <FormField id="bio" label="个人简介" error={errors.bio?.message} labelAction={<span className="font-utility text-xs tabular-nums text-muted-foreground">{bio.length}/255</span>}>
            {(props) => <textarea {...props} rows={5} maxLength={255} placeholder="介绍一下自己" disabled={busy}
              className="w-full min-w-0 resize-y rounded-xl border border-input bg-card px-3 py-3 text-sm leading-6 outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20 disabled:opacity-50 aria-invalid:border-destructive" {...register("bio")} />}
          </FormField>
        ) : (
          <fieldset disabled={busy} className="divide-y divide-border">
            <legend className="sr-only">主页公开范围</legend>
            {privacyFields.map(({ name, label, description }) => <label key={name} className="flex min-h-20 cursor-pointer items-center justify-between gap-6 py-5 first:pt-0">
              <span><span className="block text-sm font-semibold">{label}</span><span id={`${name}-description`} className="mt-1 block text-sm text-muted-foreground">{description}</span></span>
              <input type="checkbox" aria-label={label} aria-describedby={`${name}-description`} className="size-5 shrink-0 accent-primary" {...register(name)} />
            </label>)}
          </fieldset>
        )}
        {errors.root ? <p role="alert" className="text-sm text-destructive">{errors.root.message}</p> : null}
        <div className="sticky bottom-0 z-[var(--layer-sticky)] flex flex-wrap items-center justify-between gap-3 border-t border-border bg-background py-4">
          <p role="status" className="text-sm text-muted-foreground">{busy ? "保存中…" : errors.root || errors.bio ? "保存失败" : dirty ? "未保存修改" : saved ? "已保存" : ""}</p>
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" disabled={!dirty || busy} onClick={() => { reset({ bio: me.bio ?? "", showRecentReplies: me.showRecentReplies, showPlayerBadges: me.showPlayerBadges, showBookmarks: me.showBookmarks }); setSaved(false); }}>撤销修改</Button>
            <Button type="submit" pending={busy} disabled={!dirty || usernameStatus.busy} pendingLabel="保存中">{section === "profile" ? "保存简介" : "保存隐私设置"}</Button>
          </div>
        </div>
      </form>
      {section === "profile" ? <details className="border-t border-border pt-5">
        <summary className="cursor-pointer rounded-md text-sm font-semibold text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring">等级与创作激励</summary>
        <div className="space-y-3 pt-4">
          <LevelBadge level={me.level} />
          <div className="flex justify-between text-xs text-muted-foreground"><span>{me.experience} 经验</span><span>{me.nextLevelExperience === null ? "已达最高等级" : `下一级 ${me.nextLevelExperience}`}</span></div>
          <div role="progressbar" aria-label="当前等级经验进度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(experiencePercent)} className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full" style={{ width: `${experiencePercent}%`, backgroundColor: tier ? `var(--element-level-${tier.id}-surface)` : "var(--muted-foreground)" }} />
          </div>
          <p className="text-xs text-muted-foreground">累计收到 {formatWenyou(me.receivedTipTotal)} 升温油，共 {me.receivedTipCount} 次投入</p>
        </div>
      </details> : null}
    </div>
  );
}

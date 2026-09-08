"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { levelTier } from "@wenyousite/foundation/elements";
import { useMe } from "@/api/hooks/use-me";
import { useUpdateProfile } from "@/api/hooks/use-update-profile";
import { getApiError } from "@/api/errors";
import { profileSchema, type ProfileFormData } from "@/lib/validations/profile";
import { AvatarUploader } from "@/components/user/avatar-uploader";
import { ProfileCoverUploader } from "@/components/user/profile-cover-uploader";
import { UsernameEdit } from "@/components/user/username-edit";
import { useSettingsLeaveGuard } from "@/components/user/use-settings-leave-guard";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Skeleton } from "@/components/ui/skeleton";
import { LoadError } from "@/components/shared/load-error";
import { LevelBadge } from "@/components/shared/level-badge";
import { formatWenyou } from "@/lib/wenyou";

const privacyFields = [
  { name: "showRecentReplies", label: "公开最近回复", description: undefined },
  { name: "showPlayerBadges", label: "公开参与的主题帖", description: undefined },
  { name: "showBookmarks", label: "公开收藏", description: "收藏夹名称与归类仅自己可见。" },
] as const;

type Section = "bio" | "privacy";

function ProfileSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-6 rounded-2xl border border-border bg-card p-6">
      <h2 id={`${id}-title`} className="mb-6 font-sans text-base font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export function ProfileEditForm() {
  const { data: me, isLoading, error, refetch } = useMe();
  const updateProfile = useUpdateProfile();
  const [savedSection, setSavedSection] = useState<Section | null>(null);
  const [savingSection, setSavingSection] = useState<Section | null>(null);
  const [sectionError, setSectionError] = useState<{ section: Section; message: string } | null>(null);
  const [usernameStatus, setUsernameStatus] = useState({ dirty: false, busy: false });
  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: { bio: "", showRecentReplies: true, showPlayerBadges: true, showBookmarks: true },
  });
  const { register, handleSubmit, reset, resetField, control, setError, clearErrors } = form;
  const { errors, dirtyFields } = form.formState;
  const bio = useWatch({ control, name: "bio" }) ?? "";
  const bioDirty = !!dirtyFields.bio;
  const privacyDirty = privacyFields.some(({ name }) => dirtyFields[name]);
  const busy = updateProfile.isPending;
  useSettingsLeaveGuard(bioDirty || privacyDirty || usernameStatus.dirty, busy || usernameStatus.busy);

  useEffect(() => {
    if (me) reset({
      bio: me.bio ?? "",
      showRecentReplies: me.showRecentReplies,
      showPlayerBadges: me.showPlayerBadges,
      showBookmarks: me.showBookmarks,
    }, { keepDirtyValues: true, keepErrors: true });
  }, [me, reset]);

  useEffect(() => {
    if (!me) return;
    const scrollToSetting = () => {
      let anchor = window.location.hash.slice(1);
      if (anchor === "profile-appearance") {
        anchor = "appearance";
        window.history.replaceState(window.history.state, "", "/me#appearance");
      }
      if (anchor === "appearance" || anchor === "privacy") {
        requestAnimationFrame(() => document.getElementById(anchor)?.scrollIntoView());
      }
    };
    scrollToSetting();
    window.addEventListener("hashchange", scrollToSetting);
    return () => window.removeEventListener("hashchange", scrollToSetting);
  }, [me]);

  const saveBio = handleSubmit(async (values) => {
    if (!bioDirty || busy) return;
    const nextBio = values.bio?.trim();
    setSavedSection(null);
    setSectionError(null);
    clearErrors("bio");
    if (!nextBio) {
      setError("bio", { message: "简介不能为空；暂不支持清空已填写的简介。" }, { shouldFocus: true });
      return;
    }
    setSavingSection("bio");
    try {
      await updateProfile.mutateAsync({ bio: nextBio });
      resetField("bio", { defaultValue: nextBio });
      setSavedSection("bio");
    } catch (caught) {
      const apiError = getApiError(caught);
      const message = apiError.code === 42900 ? "操作太频繁，请稍后再试" : apiError.message || "保存失败，请稍后重试";
      if (apiError.status === 400 || apiError.code === 40000 || apiError.code === 40001) {
        setError("bio", { message });
      } else {
        setSectionError({ section: "bio", message });
      }
    } finally {
      setSavingSection(null);
    }
  });

  const savePrivacy = handleSubmit(async (values) => {
    if (!privacyDirty || busy) return;
    setSavedSection(null);
    setSectionError(null);
    setSavingSection("privacy");
    try {
      await updateProfile.mutateAsync({
        showRecentReplies: values.showRecentReplies,
        showPlayerBadges: values.showPlayerBadges,
        showBookmarks: values.showBookmarks,
      });
      resetField("showRecentReplies", { defaultValue: values.showRecentReplies });
      resetField("showPlayerBadges", { defaultValue: values.showPlayerBadges });
      resetField("showBookmarks", { defaultValue: values.showBookmarks });
      setSavedSection("privacy");
    } catch (caught) {
      const apiError = getApiError(caught);
      setSectionError({
        section: "privacy",
        message: apiError.code === 42900 ? "操作太频繁，请稍后再试" : apiError.message || "保存失败，请稍后重试",
      });
    } finally {
      setSavingSection(null);
    }
  });

  if (isLoading && !me) return <Skeleton role="status" aria-label="正在加载资料" className="h-64 w-full rounded-xl" />;
  if (!me) return <LoadError title="资料加载失败" onRetry={() => void refetch()} />;

  const tier = levelTier(me.level);
  const experiencePercent = me.nextLevelExperience === null
    ? 100
    : Math.max(0, Math.min(100, (me.experience - me.currentLevelExperience) / (me.nextLevelExperience - me.currentLevelExperience) * 100));
  const bioRegistration = register("bio");

  return (
    <div className="space-y-6">
      {error ? <p role="alert" className="mb-5 text-sm text-destructive">资料刷新失败，当前输入已保留。<Button variant="link" size="compact" onClick={() => void refetch()}>重试</Button></p> : null}

      <ProfileSection id="public-profile" title="公开资料">
        <div className="space-y-6">
          <AvatarUploader username={me.username} avatar={me.avatar} />
          <UsernameEdit currentUsername={me.username} disabled={busy} onStatusChange={setUsernameStatus} />
        </div>
        <form onSubmit={saveBio} className="mt-6 border-t border-border pt-6">
          <FormField id="bio" label="个人简介" error={errors.bio?.message} labelAction={<span className="font-utility text-xs tabular-nums text-muted-foreground">{bio.length}/255</span>}>
            {(props) => <textarea
              {...props}
              {...bioRegistration}
              rows={3}
              maxLength={255}
              placeholder="介绍一下自己"
              disabled={busy}
              onChange={(event) => {
                void bioRegistration.onChange(event);
                clearErrors("bio");
                if (savedSection === "bio") setSavedSection(null);
                if (sectionError?.section === "bio") setSectionError(null);
              }}
              className="w-full min-w-0 resize-y rounded-xl border border-input bg-card px-3 py-3 text-sm leading-6 outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20 disabled:opacity-50 aria-invalid:border-destructive"
            />}
          </FormField>
          {sectionError?.section === "bio" ? <p role="alert" className="mt-2 text-sm text-destructive">{sectionError.message}</p> : null}
          <div className="mt-5 flex min-h-10 items-center justify-end gap-3 border-t border-border pt-5">
            <p role="status" className="mr-auto text-sm text-muted-foreground">{savingSection === "bio" ? "保存中…" : bioDirty ? "未保存修改" : savedSection === "bio" ? "已保存" : ""}</p>
            {bioDirty ? <Button type="button" variant="outline" disabled={busy} onClick={() => {
              resetField("bio", { defaultValue: me.bio ?? "" });
              clearErrors("bio");
              setSectionError(null);
              setSavedSection(null);
            }}>撤销</Button> : null}
            <Button type="submit" pending={savingSection === "bio"} disabled={!bioDirty || busy || usernameStatus.busy} pendingLabel="保存中">保存简介</Button>
          </div>
        </form>
      </ProfileSection>

      <ProfileSection id="appearance" title="主页背景">
        <ProfileCoverUploader username={me.username} avatar={me.avatar} profileCover={me.profileCover} />
      </ProfileSection>

      <ProfileSection id="privacy" title="主页公开范围">
        <form onSubmit={savePrivacy}>
          <fieldset disabled={busy} className="divide-y divide-border">
            <legend className="sr-only">主页公开范围</legend>
            {privacyFields.map(({ name, label, description }) => <label key={name} className="flex min-h-14 cursor-pointer items-center justify-between gap-6 py-3.5">
              <span><span className="block text-sm font-semibold">{label}</span>{description ? <span id={`${name}-description`} className="mt-0.5 block text-sm text-muted-foreground">{description}</span> : null}</span>
              <input type="checkbox" aria-label={label} aria-describedby={description ? `${name}-description` : undefined} className="size-5 shrink-0 accent-primary" {...register(name, { onChange: () => {
                if (savedSection === "privacy") setSavedSection(null);
                if (sectionError?.section === "privacy") setSectionError(null);
              } })} />
            </label>)}
          </fieldset>
          {sectionError?.section === "privacy" ? <p role="alert" className="mt-2 text-sm text-destructive">{sectionError.message}</p> : null}
          <div className="mt-5 flex min-h-10 items-center justify-end gap-3 border-t border-border pt-5">
            <p role="status" className="mr-auto text-sm text-muted-foreground">{savingSection === "privacy" ? "保存中…" : privacyDirty ? "未保存修改" : savedSection === "privacy" ? "已保存" : ""}</p>
            {privacyDirty ? <Button type="button" variant="outline" disabled={busy} onClick={() => {
              resetField("showRecentReplies", { defaultValue: me.showRecentReplies });
              resetField("showPlayerBadges", { defaultValue: me.showPlayerBadges });
              resetField("showBookmarks", { defaultValue: me.showBookmarks });
              setSectionError(null);
              setSavedSection(null);
            }}>撤销</Button> : null}
            <Button type="submit" pending={savingSection === "privacy"} disabled={!privacyDirty || busy || usernameStatus.busy} pendingLabel="保存中">保存隐私设置</Button>
          </div>
        </form>
      </ProfileSection>

      <details className="rounded-2xl border border-border bg-card p-6">
        <summary className="cursor-pointer rounded-md text-sm font-semibold text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring">等级与创作激励</summary>
        <div className="space-y-3 pt-4">
          <LevelBadge level={me.level} />
          <div className="flex justify-between text-xs text-muted-foreground"><span>{me.experience} 经验</span><span>{me.nextLevelExperience === null ? "已达最高等级" : `下一级 ${me.nextLevelExperience}`}</span></div>
          <div role="progressbar" aria-label="当前等级经验进度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(experiencePercent)} className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full" style={{ width: `${experiencePercent}%`, backgroundColor: tier ? `var(--element-level-${tier.id}-surface)` : "var(--muted-foreground)" }} />
          </div>
          <p className="text-xs text-muted-foreground">累计收到 {formatWenyou(me.receivedTipTotal)} 升温油，共 {me.receivedTipCount} 次投入</p>
        </div>
      </details>
    </div>
  );
}

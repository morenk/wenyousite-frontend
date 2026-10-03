"use client";

import { useEffect, type RefObject } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { levelTier } from "@wenyousite/foundation/elements";
import { toast } from "sonner";
import type { UserMe } from "@/api/hooks/use-me";
import { useUpdateProfile } from "@/api/hooks/use-update-profile";
import { getApiError } from "@/api/errors";
import { profileSchema } from "@/lib/validations/profile";
import { FormField } from "@/components/ui/form-field";
import { Textarea } from "@/components/ui/textarea";
import { LevelBadge } from "@/components/shared/level-badge";
import { SettingsDialog, SettingsSaveFooter } from "./settings-controls";
import { formatWenyou } from "@/lib/wenyou";

export interface ProfileEditorProps {
  me: UserMe;
  onClose: () => void;
  returnFocus?: RefObject<HTMLElement | null>;
}

const bioSchema = profileSchema.pick({ bio: true });
const privacySchema = profileSchema.omit({ bio: true });
export const privacyFields = [
  { name: "showRecentReplies", label: "公开最近回复" },
  { name: "showPlayerBadges", label: "公开参与主题帖" },
  { name: "showBookmarks", label: "公开收藏" },
] as const;

export function BioEditor({ me, onClose, returnFocus }: ProfileEditorProps) {
  const update = useUpdateProfile();
  const form = useForm<{ bio?: string }>({
    resolver: zodResolver(bioSchema),
    defaultValues: { bio: me.bio ?? "" },
  });
  const bio = useWatch({ control: form.control, name: "bio" }) ?? "";
  const { errors, isDirty, isSubmitting, dirtyFields } = form.formState;
  // 订阅 dirtyFields，确保后台刷新时 keepDirtyValues 保留输入。
  void dirtyFields;
  const busy = isSubmitting || update.isPending;
  const { reset, setFocus } = form;
  useEffect(() => {
    reset({ bio: me.bio ?? "" }, { keepDirtyValues: true, keepErrors: true });
  }, [me.bio, reset]);
  useEffect(() => {
    // 提交期间控件禁用，字段错误须等恢复可编辑后再接回焦点。
    if (errors.bio?.message && !busy) setFocus("bio");
  }, [errors.bio?.message, busy, setFocus]);
  const save = form.handleSubmit(async (values) => {
    if (!isDirty || update.isPending) return;
    const next = values.bio?.trim();
    if (!next) {
      form.setError(
        "bio",
        { message: "简介不能为空；暂不支持清空已填写的简介。" },
      );
      return;
    }
    try {
      await update.mutateAsync({ bio: next });
      toast.success("简介已更新");
      onClose();
    } catch (caught) {
      const error = getApiError(caught);
      const message =
        error.code === 42900
          ? "操作太频繁，请稍后再试"
          : error.message || "保存失败，请稍后重试";
      form.setError(
        error.status === 400 || error.code === 40000 || error.code === 40001
          ? "bio"
          : "root",
        { message },
      );
    }
  });
  return (
    <SettingsDialog
      title="个人简介"
      onClose={onClose}
      returnFocus={returnFocus}
      dirty={isDirty}
      busy={busy}
    >
      <form onSubmit={save}>
        <FormField
          id="bio"
          label={<span className="sr-only">个人简介</span>}
          error={errors.bio?.message}
          labelAction={
            <span className="font-utility text-xs tabular-nums text-muted-foreground">
              {Array.from(bio).length}/255
            </span>
          }
        >
          {(props) => (
            <Textarea
              {...props}
              rows={5}
              autoFocus
              placeholder="介绍一下自己"
              disabled={busy}
              {...form.register("bio", { onChange: () => form.clearErrors() })}
            />
          )}
        </FormField>
        {errors.root ? (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {errors.root.message}
          </p>
        ) : null}
        <SettingsSaveFooter busy={busy} disabled={!isDirty} />
      </form>
    </SettingsDialog>
  );
}

export function PrivacyEditor({
  me,
  onClose,
  returnFocus,
}: ProfileEditorProps) {
  const update = useUpdateProfile();
  const values = {
    showRecentReplies: me.showRecentReplies,
    showPlayerBadges: me.showPlayerBadges,
    showBookmarks: me.showBookmarks,
  };
  const form = useForm<typeof values>({
    resolver: zodResolver(privacySchema),
    defaultValues: values,
  });
  const { errors, isDirty, isSubmitting, dirtyFields } = form.formState;
  // 订阅 dirtyFields，确保后台刷新时 keepDirtyValues 保留输入。
  void dirtyFields;
  const busy = isSubmitting || update.isPending;
  const { reset } = form;
  useEffect(() => {
    reset(
      {
        showRecentReplies: me.showRecentReplies,
        showPlayerBadges: me.showPlayerBadges,
        showBookmarks: me.showBookmarks,
      },
      { keepDirtyValues: true, keepErrors: true },
    );
  }, [me.showRecentReplies, me.showPlayerBadges, me.showBookmarks, reset]);
  const save = form.handleSubmit(async (next) => {
    if (!isDirty || update.isPending) return;
    try {
      await update.mutateAsync(next);
      toast.success("公开范围已更新");
      onClose();
    } catch (caught) {
      const error = getApiError(caught);
      form.setError("root", {
        message:
          error.code === 42900
            ? "操作太频繁，请稍后再试"
            : error.message || "保存失败，请稍后重试",
      });
    }
  });
  return (
    <SettingsDialog
      title="主页公开范围"
      onClose={onClose}
      returnFocus={returnFocus}
      dirty={isDirty}
      busy={busy}
    >
      <form onSubmit={save}>
        <fieldset disabled={busy} className="space-y-5">
          <legend className="sr-only">主页公开范围</legend>
          {privacyFields.map(({ name, label }) => (
            <label
              key={name}
              className="flex min-h-10 cursor-pointer items-center justify-between gap-6 text-sm"
            >
              <span>
                {label}
                {name === "showBookmarks" ? (
                  <span
                    id="bookmark-privacy-description"
                    className="mt-1 block text-xs text-muted-foreground"
                  >
                    收藏夹名称与归类仅自己可见。
                  </span>
                ) : null}
              </span>
              <input
                type="checkbox"
                aria-label={label}
                aria-describedby={
                  name === "showBookmarks"
                    ? "bookmark-privacy-description"
                    : undefined
                }
                className="size-5 shrink-0 accent-primary"
                {...form.register(name, { onChange: () => form.clearErrors() })}
              />
            </label>
          ))}
        </fieldset>
        {errors.root ? (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {errors.root.message}
          </p>
        ) : null}
        <SettingsSaveFooter
          busy={busy}
          disabled={!isDirty}
        />
      </form>
    </SettingsDialog>
  );
}

export function LevelDetails({ me, onClose, returnFocus }: ProfileEditorProps) {
  const tier = levelTier(me.level);
  const percent =
    me.nextLevelExperience === null
      ? 100
      : Math.max(
          0,
          Math.min(
            100,
            ((me.experience - me.currentLevelExperience) /
              (me.nextLevelExperience - me.currentLevelExperience)) *
              100,
          ),
        );
  return (
    <SettingsDialog
      title="等级与创作激励"
      onClose={onClose}
      returnFocus={returnFocus}
    >
      <div className="space-y-4">
        <LevelBadge level={me.level} />
        <div className="flex justify-between gap-4 text-sm text-muted-foreground">
          <span>{me.experience} 经验</span>
          <span>
            {me.nextLevelExperience === null
              ? "已达最高等级"
              : `下一级 ${me.nextLevelExperience}`}
          </span>
        </div>
        <div
          role="progressbar"
          aria-label="当前等级经验进度"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(percent)}
          className="h-2 overflow-hidden rounded-full bg-muted"
        >
          <div
            className="h-full rounded-full"
            style={{
              width: `${percent}%`,
              backgroundColor: tier
                ? `var(--element-level-${tier.id}-surface)`
                : "var(--muted-foreground)",
            }}
          />
        </div>
        <p className="text-sm text-muted-foreground">
          累计收到 {formatWenyou(me.receivedTipTotal)} 升温油，共{" "}
          {me.receivedTipCount} 次投入
        </p>
      </div>
    </SettingsDialog>
  );
}

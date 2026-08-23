/** 我的资料编辑表单：邮箱/头像/Bio/隐私开关 + 账号安全入口（用户名单独由 UsernameEdit 修改） */

"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, ChevronRight } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import type { UseFormRegisterReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { levelTier } from "@wenyousite/foundation/elements";
import { toast } from "sonner";
import { useMe } from "@/api/hooks/use-me";
import { useUpdateProfile } from "@/api/hooks/use-update-profile";
import { getApiError } from "@/api/errors";
import { profileSchema, type ProfileFormData } from "@/lib/validations/profile";
import { UsernameEdit } from "@/components/user/username-edit";
import { AvatarUploader } from "@/components/user/avatar-uploader";
import { ProfileCoverUploader } from "@/components/user/profile-cover-uploader";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LevelBadge } from "@/components/shared/level-badge";
import { formatWenyou } from "@/lib/wenyou";

/** 邮箱脱敏：保留首字符与域名，如 a***@example.com */
function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  return `${local.charAt(0)}***@${domain}`;
}

export function ProfileEditForm() {
  const router = useRouter();
  const { data: me, isLoading, error } = useMe();
  const updateProfile = useUpdateProfile();

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      bio: "",
      showRecentReplies: true,
      showPlayerBadges: true,
      showBookmarks: true,
    },
  });

  const bioLength = (useWatch({ control, name: "bio" }) ?? "").length;

  useEffect(() => {
    if (me) {
      reset({
        bio: me.bio ?? "",
        showRecentReplies: me.showRecentReplies,
        showPlayerBadges: me.showPlayerBadges,
        showBookmarks: me.showBookmarks,
      });
    }
  }, [me, reset]);

  const onSubmit = async (values: ProfileFormData) => {
    try {
      await updateProfile.mutateAsync({
        bio: values.bio?.trim() || undefined,
        showRecentReplies: values.showRecentReplies,
        showPlayerBadges: values.showPlayerBadges,
        showBookmarks: values.showBookmarks,
      });
      toast.success("资料已保存");
      router.refresh();
    } catch (err: unknown) {
      const e = getApiError(err);
      if (e.code === 42900) {
        toast.error("操作太频繁，请稍后再试");
      } else {
        toast.error(e.message || "保存失败，请稍后重试");
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          资料加载失败，请稍后重试
        </CardContent>
      </Card>
    );
  }

  const experienceTier = me ? levelTier(me.level) : undefined;
  const experiencePercent = me
    ? me.nextLevelExperience === null
      ? 100
      : Math.max(
          0,
          Math.min(
            100,
            ((me.experience - me.currentLevelExperience)
              / (me.nextLevelExperience - me.currentLevelExperience)) * 100,
          ),
        )
    : 0;

  return (
    <div className="space-y-5">
      {me && (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>等级与创作激励</CardTitle>
            <LevelBadge level={me.level} className="h-6 px-2 text-xs" />
          </CardHeader>
          <CardContent className="space-y-3 pt-2">
            <div>
              <div className="mb-1.5 flex justify-between text-xs text-muted-foreground">
                <span>{me.experience} 经验</span>
                <span>
                  {me.nextLevelExperience === null
                    ? "已达最高等级"
                    : `下一级 ${me.nextLevelExperience}`}
                </span>
              </div>
              <div
                className="h-2 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-label="当前等级经验进度"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(experiencePercent)}
              >
                <div
                  className="h-full rounded-full transition-[width] duration-[var(--motion-standard)]"
                  style={{
                    width: `${experiencePercent}%`,
                    backgroundColor: experienceTier
                      ? `var(--element-level-${experienceTier.id}-surface)`
                      : "var(--muted-foreground)",
                  }}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              累计收到 {formatWenyou(me.receivedTipTotal)} 升温油，共 {me.receivedTipCount} 次投入
            </p>
          </CardContent>
        </Card>
      )}

      {me ? (
        <Card id="profile-appearance" className="scroll-mt-5">
          <CardHeader>
            <CardTitle>主页外观</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 pt-2">
            <div>
              <p className="mb-3 text-sm font-medium text-foreground">主页背景</p>
              <ProfileCoverUploader
                username={me.username}
                avatar={me.avatar}
                profileCover={me.profileCover}
              />
            </div>
            <div className="border-t border-border pt-5">
              <AvatarUploader username={me.username} avatar={me.avatar} />
            </div>
          </CardContent>
        </Card>
      ) : null}

      {me && <UsernameEdit currentUsername={me.username} />}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <Card>
          <CardHeader>
            <CardTitle>基本信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">邮箱</p>
                <p className="truncate text-xs text-muted-foreground">
                  {me ? maskEmail(me.email) : ""}
                </p>
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="bio">个人简介</Label>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {bioLength}/255
                </span>
              </div>
              <textarea
                id="bio"
                placeholder="介绍一下自己（可选）"
                rows={3}
                maxLength={255}
                className="w-full min-w-0 resize-y rounded-xl border border-input bg-card px-3 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive md:text-sm"
                {...register("bio")}
              />
              {errors.bio && (
                <p className="text-xs text-destructive">{errors.bio.message}</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>隐私设置</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-6">
            <ToggleRow
              label="公开最近动态"
              description="允许他人在你的主页查看最近回复"
              register={register("showRecentReplies")}
            />
            <ToggleRow
              label="公开玩家标记"
              description="允许他人在你的主页查看参与的帖子"
              register={register("showPlayerBadges")}
            />
            <ToggleRow
              label="公开收藏"
              description="允许他人在你的主页查看收藏"
              register={register("showBookmarks")}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>账号安全</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 pt-2">
            <Link
              href="/me/password"
              className="flex items-center justify-between rounded-lg px-3 py-3 transition-colors hover:bg-muted/50"
            >
              <p className="text-sm font-medium text-foreground">修改密码</p>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>
            <Link
              href="/me/email"
              className="flex items-center justify-between rounded-lg px-3 py-3 transition-colors hover:bg-muted/50"
            >
              <div>
                <p className="text-sm font-medium text-foreground">更换邮箱</p>
                <p className="text-xs text-muted-foreground">
                  当前邮箱：{me ? maskEmail(me.email) : ""}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>
            <Link
              href="/me/security"
              className="flex items-center justify-between rounded-lg px-3 py-3 transition-colors hover:bg-muted/50"
            >
              <p className="text-sm font-medium text-foreground">登录终端与账号安全</p>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.push(`/users/${me?.id}`)}
            disabled={updateProfile.isPending}
          >
            返回主页
          </Button>
          <Button type="submit" disabled={updateProfile.isPending}>
            {updateProfile.isPending ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : null}
            保存
          </Button>
        </div>
      </form>
    </div>
  );
}

/** 开关行：checkbox 渲染为开关样式 */
function ToggleRow({
  label,
  description,
  register,
}: {
  label: string;
  description: string;
  register: UseFormRegisterReturn;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <input
        type="checkbox"
        className="h-4 w-4 rounded border-border accent-primary"
        {...register}
      />
    </label>
  );
}

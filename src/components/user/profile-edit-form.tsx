/** 我的资料编辑表单：账户信息/头像/Bio/隐私开关（用户名单独由 UsernameEdit 修改） */

"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import type { UseFormRegisterReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useMe } from "@/api/hooks/use-me";
import { useUpdateProfile } from "@/api/hooks/use-update-profile";
import { profileSchema, type ProfileFormData } from "@/lib/validations/profile";
import { UsernameEdit } from "@/components/user/username-edit";
import { AvatarUploader } from "@/components/user/avatar-uploader";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
    watch,
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

  const bioLength = (watch("bio") ?? "").length;

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
      const e = err as { code?: number; message?: string };
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

  return (
    <div className="space-y-5">
      {me && <UsernameEdit currentUsername={me.username} />}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <Card>
          <CardHeader>
            <CardTitle>基本信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            {me && <AvatarUploader username={me.username} avatar={me.avatar} />}
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
                className="w-full min-w-0 resize-y rounded-lg border border-input bg-transparent px-2.5 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive dark:bg-input/30 md:text-sm"
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
            <CardTitle>账户</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">邮箱</p>
                <p className="truncate text-xs text-muted-foreground">
                  {me ? maskEmail(me.email) : ""}
                </p>
              </div>
              {me?.emailVerified ? (
                <span className="shrink-0 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                  已认证
                </span>
              ) : (
                <div className="flex shrink-0 items-center gap-2">
                  <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                    未认证
                  </span>
                  <Link
                    href="/verify-email"
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    去验证
                  </Link>
                </div>
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

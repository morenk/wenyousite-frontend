/** 我的资料编辑表单：用户名/Bio/隐私开关 */

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import type { UseFormRegisterReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useMe } from "@/api/hooks/use-me";
import { useUpdateProfile } from "@/api/hooks/use-update-profile";
import { profileSchema, type ProfileFormData } from "@/lib/validations/profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ProfileEditForm() {
  const router = useRouter();
  const { data: me, isLoading, error } = useMe();
  const updateProfile = useUpdateProfile();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      username: "",
      bio: "",
      showRecentReplies: true,
      showPlayerBadges: true,
      showBookmarks: true,
    },
  });

  useEffect(() => {
    if (me) {
      reset({
        username: me.username,
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
        username: values.username.trim(),
        bio: values.bio?.trim() || undefined,
        showRecentReplies: values.showRecentReplies,
        showPlayerBadges: values.showPlayerBadges,
        showBookmarks: values.showBookmarks,
      });
      toast.success("资料已保存");
      router.refresh();
    } catch (err: unknown) {
      const e = err as { code?: number; message?: string };
      if (e.code === 409) {
        toast.error("用户名已被占用");
      } else if (e.code === 42900) {
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
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>基本信息</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          <div className="space-y-1.5">
            <Label htmlFor="username">用户名</Label>
            <Input
              id="username"
              placeholder="用户名"
              {...register("username")}
            />
            {errors.username && (
              <p className="text-xs text-destructive">{errors.username.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              2-24 位，字母/数字/中文。修改后 7 天内不可再次修改。
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bio">个人简介</Label>
            <Input
              id="bio"
              placeholder="介绍一下自己（可选）"
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

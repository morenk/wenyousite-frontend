"use client";

import { useMe } from "@/api/hooks/use-me";
import { SettingsTitle } from "@/components/user/settings-shell";
import { AvatarUploader } from "@/components/user/avatar-uploader";
import { ProfileCoverUploader } from "@/components/user/profile-cover-uploader";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { LoadError } from "@/components/shared/load-error";

export default function AppearancePage() {
  const { data: me, isLoading, error, refetch } = useMe();
  return <>
    <SettingsTitle>主页外观</SettingsTitle>
    {isLoading && !me ? <Skeleton className="h-64 w-full rounded-xl" /> : !me ? <LoadError title="资料加载失败" onRetry={() => void refetch()} /> : <div className="space-y-8">
      {error ? <p role="alert" className="text-sm text-destructive">资料刷新失败，当前编辑已保留。<Button variant="link" size="compact" onClick={() => void refetch()}>重试</Button></p> : null}
      <section aria-labelledby="avatar-title">
        <h3 id="avatar-title" className="mb-4 text-sm font-semibold">头像</h3>
        <AvatarUploader username={me.username} avatar={me.avatar} />
      </section>
      <section aria-labelledby="cover-title" className="border-t border-border pt-6">
        <h3 id="cover-title" className="mb-4 text-sm font-semibold">主页背景</h3>
        <ProfileCoverUploader username={me.username} avatar={me.avatar} profileCover={me.profileCover} />
      </section>
    </div>}
  </>;
}

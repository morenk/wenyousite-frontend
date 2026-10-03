"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { useMe } from "@/api/hooks/use-me";
import { AvatarUploader } from "@/components/user/avatar-uploader";
import { ProfileCoverUploader } from "@/components/user/profile-cover-uploader";
import { UsernameEdit } from "@/components/user/username-edit";
import { AccountSecurityPanel } from "@/components/user/account-security-panel";
import {
  BioEditor,
  LevelDetails,
  PrivacyEditor,
  privacyFields,
} from "@/components/user/profile-settings-editors";
import {
  SettingsGroup,
  SettingsRow,
} from "@/components/user/settings-controls";
import { UserAvatar } from "@/components/shared/user-avatar";
import { ProfileCover } from "@/components/user/profile-cover";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { LoadError } from "@/components/shared/load-error";

type Editor =
  | "avatar"
  | "username"
  | "bio"
  | "cover"
  | "privacy"
  | "level"
  | "sessions"
  | "blocked"
  | "delete";

export function ProfileEditForm() {
  const { data: me, isLoading, error, refetch } = useMe();
  const [editor, setEditor] = useState<Editor | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const open = (value: Editor, event: MouseEvent<HTMLButtonElement>) => {
    returnFocus.current = event.currentTarget;
    setEditor(value);
  };
  const close = () => {
    setEditor(null);
    requestAnimationFrame(() =>
      returnFocus.current?.focus({ preventScroll: true }),
    );
  };

  useEffect(() => {
    if (!me) return;
    const scrollToSetting = () => {
      let anchor = window.location.hash.slice(1);
      if (anchor === "profile-appearance") {
        anchor = "appearance";
        window.history.replaceState(window.history.state, "", "/me#appearance");
      }
      if (["appearance", "privacy", "security"].includes(anchor)) {
        requestAnimationFrame(() =>
          document.getElementById(anchor)?.scrollIntoView(),
        );
      }
    };
    scrollToSetting();
    window.addEventListener("hashchange", scrollToSetting);
    return () => window.removeEventListener("hashchange", scrollToSetting);
  }, [me]);

  if (isLoading && !me)
    return (
      <Skeleton
        role="status"
        aria-label="正在加载设置"
        className="h-96 w-full rounded-[var(--radius-card)]"
      />
    );
  if (!me)
    return <LoadError title="设置加载失败" onRetry={() => void refetch()} />;
  const enabledPrivacy = privacyFields
    .filter(({ name }) => me[name])
    .map(({ label }) => label.replace(/^公开/, ""));
  const privacySummary = enabledPrivacy.length
    ? enabledPrivacy.join("、")
    : "最近回复、参与主题帖、收藏均不公开";
  const email = me.email
    ? `${me.email.charAt(0)}***@${me.email.split("@")[1]}`
    : "未设置";
  const editorProps = { me, onClose: close, returnFocus };

  return (
    <div className="space-y-7">
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          设置刷新失败
          <Button variant="link" size="compact" onClick={() => void refetch()}>
            重试
          </Button>
        </p>
      ) : null}
      <SettingsGroup id="public-profile" title="个人资料">
        <SettingsRow
          label="头像"
          onClick={(event) => open("avatar", event)}
          value={
            <UserAvatar
              name={me.username}
              src={me.avatar}
              display={me.avatarDisplay}
              className="ml-auto size-10"
            />
          }
        />
        <SettingsRow
          label="用户名"
          onClick={(event) => open("username", event)}
          value={<span className="break-words">{me.username}</span>}
        />
        <SettingsRow
          label="个人简介"
          onClick={(event) => open("bio", event)}
          value={
            <span className="line-clamp-2 break-words">
              {me.bio || "未填写"}
            </span>
          }
        />
        <SettingsRow
          id="appearance"
          label="主页背景"
          onClick={(event) => open("cover", event)}
          value={
            me.profileCover ? (
              <span className="ml-auto block w-24 overflow-hidden rounded-[var(--radius-compact)]">
                <ProfileCover cover={me.profileCover} username={me.username} />
              </span>
            ) : (
              "未设置"
            )
          }
        />
      </SettingsGroup>
      <SettingsGroup title="隐私与关系">
        <SettingsRow
          id="privacy"
          label="主页公开范围"
          onClick={(event) => open("privacy", event)}
          value={privacySummary}
        />
        <SettingsRow
          label="黑名单"
          onClick={(event) => open("blocked", event)}
        />
      </SettingsGroup>
      <SettingsGroup id="security" title="账号与安全">
        <SettingsRow
          label="邮箱"
          value={<span className="break-all">{email}</span>}
          href="/me/email"
        />
        <SettingsRow label="密码" href="/me/password" />
        <SettingsRow
          label="登录终端"
          onClick={(event) => open("sessions", event)}
        />
      </SettingsGroup>
      <SettingsGroup>
        <SettingsRow
          label="等级与创作激励"
          value={`Lv.${me.level}`}
          onClick={(event) => open("level", event)}
        />
      </SettingsGroup>
      <SettingsGroup>
        <SettingsRow
          label="注销账号"
          destructive
          onClick={(event) => open("delete", event)}
        />
      </SettingsGroup>
      {editor === "avatar" ? (
        <AvatarUploader
          username={me.username}
          avatar={me.avatar}
          avatarDisplay={me.avatarDisplay}
          onClose={close}
          returnFocus={returnFocus}
        />
      ) : null}
      {editor === "username" ? (
        <UsernameEdit
          currentUsername={me.username}
          onClose={close}
          returnFocus={returnFocus}
        />
      ) : null}
      {editor === "bio" ? <BioEditor {...editorProps} /> : null}
      {editor === "cover" ? (
        <ProfileCoverUploader
          username={me.username}
          avatar={me.avatar}
          avatarDisplay={me.avatarDisplay}
          profileCover={me.profileCover}
          onClose={close}
          returnFocus={returnFocus}
        />
      ) : null}
      {editor === "privacy" ? <PrivacyEditor {...editorProps} /> : null}
      {editor === "level" ? <LevelDetails {...editorProps} /> : null}
      {editor === "sessions" || editor === "blocked" || editor === "delete" ? (
        <AccountSecurityPanel
          view={editor}
          onClose={close}
          returnFocus={returnFocus}
        />
      ) : null}
    </div>
  );
}

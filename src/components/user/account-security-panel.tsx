"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { getLoginTerminalLabel } from "@/lib/session-display";
import {
  useAccountSessions,
  useBlockedUsers,
  useDeleteAccount,
  useRevokeSession,
  useUnblockUser,
} from "@/api/hooks/use-account-security";
import { getApiError, getApiErrorMessage } from "@/api/errors";
import { UserAvatar } from "@/components/shared/user-avatar";
import { WenyouTime } from "@/components/shared/wenyou-time";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { DialogClose, DialogFooter } from "@/components/ui/dialog";
import { useConfirm } from "@/components/ui/confirm-provider";
import { SettingsDialog, type SettingsDialogProps } from "./settings-controls";

type DialogProps = Pick<SettingsDialogProps, "onClose" | "returnFocus">;
export function AccountSecurityPanel({
  view = "sessions",
  ...props
}: DialogProps & { view?: "sessions" | "blocked" | "delete" }) {
  if (view === "blocked") return <BlockedUsers {...props} />;
  if (view === "delete") return <DeleteAccount {...props} />;
  return <LoginSessions {...props} />;
}

function LoginSessions(props: DialogProps) {
  const { user } = useAuth();
  const sessions = useAccountSessions(user?.id);
  const revoke = useRevokeSession(user?.id);
  const [failure, setFailure] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);
  const busy = revoke.isPending || revoking !== null;
  async function handleRevoke(id: string) {
    if (busy) return;
    setFailure(null);
    setRevoking(id);
    try {
      await revoke.mutateAsync(id);
      toast.success("登录终端已退出");
    } catch (error) {
      setFailure(getApiErrorMessage(error, "退出失败，请稍后重试"));
    } finally {
      setRevoking(null);
    }
  }
  return (
    <SettingsDialog title="登录终端" {...props} busy={busy}>
      {sessions.isLoading ? (
        <p role="status" className="text-sm text-muted-foreground">
          正在加载…
        </p>
      ) : sessions.error ? (
        <div>
          <p role="alert" className="text-sm text-destructive">
            {getApiError(sessions.error).code === 42900
              ? "操作太频繁，请稍后再试"
              : "登录终端加载失败"}
          </p>
          <Button
            className="mt-3"
            variant="outline"
            onClick={() => void sessions.refetch()}
          >
            重新加载
          </Button>
        </div>
      ) : sessions.data?.length ? (
        <ul className="space-y-6">
          {sessions.data.map((session) => (
            <li
              key={session.id}
              className="flex items-start justify-between gap-4"
            >
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-medium">
                  {getLoginTerminalLabel(session.platform)}
                  {session.isCurrent ? (
                    <span className="ml-2 text-xs text-muted-foreground">
                      当前终端
                    </span>
                  ) : null}
                </p>
                <p className="text-xs text-muted-foreground">
                  登录于{" "}
                  <WenyouTime
                    mode="exact"
                    value={session.signedInAt ?? session.createdAt}
                  />
                </p>
                <p className="text-xs text-muted-foreground">
                  最近活动{" "}
                  <WenyouTime
                    mode="exact"
                    value={session.lastActiveAt ?? session.createdAt}
                  />
                </p>
                <p className="text-xs text-muted-foreground">
                  有效期至 <WenyouTime mode="exact" value={session.expiresAt} />
                </p>
              </div>
              {!session.isCurrent ? (
                <Button
                  variant="outline"
                  disabled={busy}
                  pending={revoking === session.id}
                  pendingLabel="退出中"
                  onClick={() => void handleRevoke(session.id)}
                >
                  退出登录
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">暂无登录终端</p>
      )}
      {failure ? (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {failure}
        </p>
      ) : null}
    </SettingsDialog>
  );
}

function BlockedUsers(props: DialogProps) {
  const { user } = useAuth();
  const blocked = useBlockedUsers(user?.id);
  const unblock = useUnblockUser();
  const [unblocking, setUnblocking] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const busy = unblock.isPending || unblocking !== null;
  async function handleUnblock(id: string) {
    if (busy) return;
    setFailure(null);
    setUnblocking(id);
    try {
      await unblock.mutateAsync(id);
    } catch (error) {
      setFailure(getApiErrorMessage(error, "操作失败，请稍后重试"));
    } finally {
      setUnblocking(null);
    }
  }
  return (
    <SettingsDialog title="黑名单" {...props} busy={busy}>
      {blocked.isLoading ? (
        <p role="status" className="text-sm text-muted-foreground">
          正在加载…
        </p>
      ) : blocked.error ? (
        <div>
          <p role="alert" className="text-sm text-destructive">
            黑名单加载失败
          </p>
          <Button
            className="mt-3"
            variant="outline"
            onClick={() => void blocked.refetch()}
          >
            重新加载
          </Button>
        </div>
      ) : blocked.data?.length ? (
        <ul className="space-y-5">
          {blocked.data.map(({ id, blocked: person }) => (
            <li key={id} className="flex items-center justify-between gap-4">
              <Link
                href={`/users/${person.id}`}
                className="flex min-w-0 items-center gap-3 text-sm hover:underline"
              >
                <UserAvatar
                  name={person.username}
                  src={person.avatar}
                  display={person.avatarDisplay}
                  className="size-9"
                />
                <span className="break-words">{person.username}</span>
              </Link>
              <Button
                variant="outline"
                disabled={busy}
                pending={unblocking === person.id}
                pendingLabel="处理中"
                onClick={() => void handleUnblock(person.id)}
              >
                取消拉黑
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">黑名单为空</p>
      )}
      {failure ? (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {failure}
        </p>
      ) : null}
    </SettingsDialog>
  );
}

const deleteSchema = z.object({
  confirmation: z
    .string()
    .refine((value): boolean => value === "注销账号", "请输入“注销账号”"),
});
function DeleteAccount(props: DialogProps) {
  const { logout } = useAuth();
  const mutation = useDeleteAccount();
  const confirm = useConfirm();
  const form = useForm<z.infer<typeof deleteSchema>>({
    resolver: zodResolver(deleteSchema),
    defaultValues: { confirmation: "" },
  });
  const confirmation = useWatch({
    control: form.control,
    name: "confirmation",
  });
  const busy = mutation.isPending || form.formState.isSubmitting;
  const save = form.handleSubmit(async () => {
    if (mutation.isPending) return;
    if (
      !(await confirm({
        title: "注销账号",
        description: "账号注销后无法恢复，确定继续吗？",
        confirmLabel: "永久注销",
        destructive: true,
      }))
    )
      return;
    try {
      await mutation.mutateAsync();
      logout({ redirectTo: "/" });
      toast.success("账号已注销");
    } catch (error) {
      form.setError("root", {
        message: getApiErrorMessage(error, "注销失败，请稍后重试"),
      });
    }
  });
  return (
    <SettingsDialog
      title="注销账号"
      {...props}
      busy={busy}
      dirty={form.formState.isDirty}
    >
      <p className="mb-5 text-sm text-muted-foreground">
        注销后账号、登录终端和身份信息将无法恢复。
      </p>
      <form onSubmit={save}>
        <FormField
          id="delete-confirmation"
          label="输入“注销账号”确认"
          error={form.formState.errors.confirmation?.message}
        >
          {(field) => (
            <Input
              {...field}
              aria-label="注销确认文字"
              autoComplete="off"
              disabled={busy}
              {...form.register("confirmation", {
                onChange: () => form.clearErrors(),
              })}
            />
          )}
        </FormField>
        {form.formState.errors.root ? (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {form.formState.errors.root.message}
          </p>
        ) : null}
        <DialogFooter className="mt-6">
          <DialogClose
            disabled={busy}
            className={buttonVariants({ variant: "outline" })}
          >
            取消
          </DialogClose>
          <Button
            type="submit"
            variant="destructive"
            disabled={confirmation !== "注销账号"}
            pending={busy}
            pendingLabel="处理中"
          >
            永久注销
          </Button>
        </DialogFooter>
      </form>
    </SettingsDialog>
  );
}

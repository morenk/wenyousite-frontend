"use client";

import { ArrowRight, ShieldCheck } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/api/errors";
import { useAcceptAdminInvite } from "@/api/hooks/use-admin";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

export function AdminInviteAcceptance() {
  const token = useSearchParams().get("token") ?? "";
  const router = useRouter();
  const auth = useAuth();
  const accept = useAcceptAdminInvite();

  return (
    <main className="flex min-h-screen min-w-[960px] items-center justify-center bg-muted px-8 py-16">
      <section className="w-full max-w-xl rounded-2xl border border-border bg-card p-10 shadow-sm">
        <span className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <ShieldCheck className="size-5" />
        </span>
        <p className="mt-7 font-utility text-xs font-bold tracking-[0.12em] text-muted-foreground">站务账号邀请</p>
        <h1 className="mt-2 font-display text-3xl font-medium">接受温油站务邀请</h1>
        <p className="mt-4 text-sm leading-7 text-muted-foreground">
          邀请只会把当前已登录的温油账号升级为管理员。接受后普通网页会话会失效，请使用同一账号在独立站务台完成邮箱二次确认。
        </p>
        <div className="mt-7 rounded-xl border border-border bg-muted px-4 py-3 text-sm">
          当前账号：<strong>{auth.user?.username}</strong>
        </div>
        {!token ? <p className="mt-5 text-sm text-destructive">邀请链接缺少凭证，请重新打开邮件中的完整链接。</p> : null}
        <Button
          type="button"
          size="large"
          className="mt-7 w-full"
          disabled={!token || accept.isPending}
          onClick={async () => {
            try {
              await accept.mutateAsync(token);
              auth.logout();
              toast.success("邀请已接受，请登录站务台");
              router.replace("/station");
            } catch (error) {
              toast.error(getApiErrorMessage(error, "邀请无效、已过期或账号不匹配"));
            }
          }}
        >
          {accept.isPending ? "正在接受邀请…" : "接受邀请并进入站务台"}<ArrowRight />
        </Button>
      </section>
    </main>
  );
}

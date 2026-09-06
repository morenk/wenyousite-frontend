import Link from "next/link";
import { ChangePasswordForm } from "@/components/user/change-password-form";
import { SettingsTitle } from "@/components/user/settings-shell";

export default function ChangePasswordFormPage() {
  return <>
    <Link href="/me/security" className="mb-4 inline-flex min-h-8 items-center rounded-md text-sm text-muted-foreground outline-none hover:text-brand-strong focus-visible:ring-2 focus-visible:ring-ring">返回账号安全</Link>
    <SettingsTitle>修改密码</SettingsTitle>
    <div className="w-full max-w-narrow">
      <p className="mb-6 text-sm text-muted-foreground">修改后需重新登录，所有登录终端将自动退出</p>
      <ChangePasswordForm />
    </div>
  </>;
}

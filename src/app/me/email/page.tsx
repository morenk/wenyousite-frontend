import Link from "next/link";
import { ChangeEmailForm } from "@/components/user/change-email-form";
import { SettingsTitle } from "@/components/user/settings-shell";

export default function ChangeEmailFormPage() {
  return <>
    <Link href="/me/security" className="mb-4 inline-flex min-h-8 items-center rounded-md text-sm text-muted-foreground outline-none hover:text-brand-strong focus-visible:ring-2 focus-visible:ring-ring">返回账号安全</Link>
    <SettingsTitle>更换邮箱</SettingsTitle>
    <div className="w-full max-w-narrow">
      <p className="mb-6 text-sm text-muted-foreground">需输入当前密码验证身份，验证码将发送至新邮箱</p>
      <ChangeEmailForm />
    </div>
  </>;
}

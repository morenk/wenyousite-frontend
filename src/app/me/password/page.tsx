import { ChangePasswordForm } from "@/components/user/change-password-form";

export default function ChangePasswordFormPage() {
  return <div className="w-full max-w-narrow">
    <p className="mb-6 text-sm text-muted-foreground">修改后需重新登录，所有登录终端将自动退出</p>
    <ChangePasswordForm />
  </div>;
}

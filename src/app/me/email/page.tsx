import { ChangeEmailForm } from "@/components/user/change-email-form";

export default function ChangeEmailFormPage() {
  return <div className="w-full max-w-narrow">
    <p className="mb-6 text-sm text-muted-foreground">验证码将发送至新邮箱。</p>
    <ChangeEmailForm />
  </div>;
}

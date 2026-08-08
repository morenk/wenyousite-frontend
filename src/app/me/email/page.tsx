/** 更换邮箱页：独立页面，当前密码二次认证 + 验证码分步 */

"use client";

import { ChangeEmailForm } from "@/components/user/change-email-form";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function ChangeEmailPage() {
  return (
    <PageShell width="narrow">
      <PageHeader title="更换邮箱" backHref="/me" backLabel="返回资料设置" />
      <Card>
        <CardHeader>
          <CardTitle>更换邮箱</CardTitle>
          <CardDescription>需输入当前密码验证身份，验证码将发送至新邮箱</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <ChangeEmailForm />
        </CardContent>
      </Card>
    </PageShell>
  );
}

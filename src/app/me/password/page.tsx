/** 修改密码页：独立页面，成功后登出跳登录 */

"use client";

import { ChangePasswordForm } from "@/components/user/change-password-form";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function ChangePasswordPage() {
  return (
    <PageShell width="narrow">
      <PageHeader title="修改密码" backHref="/me" backLabel="返回资料设置" />
      <Card>
        <CardHeader>
          <CardTitle>修改密码</CardTitle>
          <CardDescription>修改后需重新登录，所有登录终端将自动退出</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <ChangePasswordForm />
        </CardContent>
      </Card>
    </PageShell>
  );
}

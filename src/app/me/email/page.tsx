/** 更换邮箱页：独立页面，当前密码二次认证 + 验证码分步 */

"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ChangeEmailForm } from "@/components/user/change-email-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function ChangeEmailPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <Link
        href="/me"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        返回资料设置
      </Link>
      <Card>
        <CardHeader>
          <CardTitle>更换邮箱</CardTitle>
          <CardDescription>需输入当前密码验证身份，验证码将发送至新邮箱</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <ChangeEmailForm />
        </CardContent>
      </Card>
    </div>
  );
}

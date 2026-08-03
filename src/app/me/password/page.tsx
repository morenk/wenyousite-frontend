/** 修改密码页：独立页面，成功后登出跳登录 */

"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, ArrowLeft } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { ChangePasswordForm } from "@/components/user/change-password-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function ChangePasswordPage() {
  const { user, isInitialized } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isInitialized) return;
    if (!user) {
      router.replace("/login");
    }
  }, [user, isInitialized, router]);

  if (!isInitialized) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) return null;

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
          <CardTitle>修改密码</CardTitle>
          <CardDescription>修改后需重新登录，其他设备将自动下线</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <ChangePasswordForm />
        </CardContent>
      </Card>
    </div>
  );
}

import type { ReactNode } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface AuthPageShellProps {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}

/** 登录、注册与邮箱流程共享的桌面卡片页面壳。 */
export function AuthPageShell({ title, description, children, footer }: AuthPageShellProps) {
  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        <Card>
          <CardHeader>
            <CardTitle className="text-center text-xl">{title}</CardTitle>
            {description && (
              <CardDescription className="text-center">{description}</CardDescription>
            )}
          </CardHeader>
          <CardContent>{children}</CardContent>
          {footer && <CardFooter className="justify-center">{footer}</CardFooter>}
        </Card>
      </div>
    </div>
  );
}

import type { ReactNode } from "react";
import Link from "next/link";
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

/** 登录、注册与邮箱流程共享的桌面表单页面壳。 */
export function AuthPageShell({ title, description, children, footer }: AuthPageShellProps) {
  return (
    <div className="mx-auto grid min-h-screen w-full max-w-5xl items-center gap-10 px-6 py-10 lg:grid-cols-[minmax(0,1fr)_minmax(24rem,28rem)]">
      <section className="hidden max-w-lg lg:block" aria-label="站点信息">
        <Link href="/" className="inline-flex items-center gap-3 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30">
          <span className="relative flex size-12 items-center justify-center rounded-2xl bg-primary font-display text-2xl font-medium text-primary-foreground">
            温
            <span className="absolute -right-1 top-1 size-3 rounded-full border-2 border-white bg-secondary" aria-hidden="true" />
          </span>
          <span className="font-display text-2xl font-medium text-foreground">温油站</span>
        </Link>
        <h1 className="mt-9 font-display text-4xl leading-[1.35] font-medium tracking-wide text-foreground">
          文字共同创作社区
        </h1>
        <div className="mt-8 flex max-w-sm items-center font-utility text-sm font-bold text-muted-foreground" aria-label="从构思到共同留存">
          <span className="rounded-full border border-border bg-card px-3 py-1">构思</span>
          <span className="mx-2 h-px flex-1 bg-border" aria-hidden="true" />
          <span className="rounded-full border border-border bg-card px-3 py-1">共创</span>
          <span className="mx-2 h-px flex-1 bg-border" aria-hidden="true" />
          <span className="rounded-full border border-border bg-card px-3 py-1">留存</span>
        </div>
      </section>

      <div className="mx-auto w-full max-w-md">
        <Link href="/" className="mb-5 inline-flex items-center gap-2 font-display text-lg font-medium text-foreground lg:hidden">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">温</span>
          温油站
        </Link>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-2xl">{title}</CardTitle>
            {description && (
              <CardDescription className="mt-1 leading-6">{description}</CardDescription>
            )}
          </CardHeader>
          <CardContent>{children}</CardContent>
          {footer && <CardFooter className="justify-center bg-muted/45">{footer}</CardFooter>}
        </Card>
      </div>
    </div>
  );
}

import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { BRAND_NAME, BRAND_TAGLINE } from "@wenyousite/foundation/brand";
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
        <Link
          href="/"
          aria-label={`${BRAND_NAME}首页`}
          className="inline-flex items-center gap-3 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
        >
          <Image
            src="/brand-title-icon-128.png"
            width={48}
            height={48}
            alt=""
            aria-hidden="true"
            priority
          />
          <span className="font-display text-2xl font-medium text-foreground">{BRAND_NAME}</span>
        </Link>
        <h1 className="mt-9 font-display text-4xl leading-[1.35] font-medium tracking-wide text-foreground">
          {BRAND_TAGLINE}
        </h1>
      </section>

      <div className="mx-auto w-full max-w-md">
        <Link
          href="/"
          aria-label={`${BRAND_NAME}首页`}
          className="mb-5 inline-flex items-center gap-2 font-display text-lg font-medium text-foreground lg:hidden"
        >
          <Image
            src="/brand-title-icon-128.png"
            width={36}
            height={36}
            alt=""
            aria-hidden="true"
            priority
          />
          {BRAND_NAME}
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

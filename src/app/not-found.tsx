import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-sm font-medium text-brand-strong">404</p>
      <h1 className="font-display text-2xl font-bold">没有找到这个页面</h1>
      <p className="text-sm text-muted-foreground">链接可能已失效，或内容已经被移除。</p>
      <Link href="/" className={buttonVariants()}>返回首页</Link>
    </div>
  );
}

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-lg flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-sm font-medium text-primary">404</p>
      <h1 className="text-xl font-semibold">没有找到这个页面</h1>
      <p className="text-sm text-muted-foreground">链接可能已失效，或内容已经被移除。</p>
      <Link href="/" className={buttonVariants()}>返回首页</Link>
    </div>
  );
}

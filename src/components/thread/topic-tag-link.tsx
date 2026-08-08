import Link from "next/link";
import { cn } from "@/lib/utils";

interface TopicTagLinkProps {
  tag: {
    id: string;
    name: string;
  };
  className?: string;
}

/** 主题帖标签的统一浏览入口。 */
export function TopicTagLink({ tag, className }: TopicTagLinkProps) {
  return (
    <Link
      href={`/tags/${tag.id}`}
      aria-label={`查看 #${tag.name} 标签下的主题帖`}
      className={cn(
        "inline-flex min-h-6 items-center rounded-full border border-border px-2.5 py-0.5 text-xs font-medium text-muted-foreground transition-[background-color,border-color,color] duration-[var(--motion-fast)] hover:border-primary hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
        className,
      )}
    >
      #{tag.name}
    </Link>
  );
}

import Link from "next/link";
import { METADATA_ELEMENT_STYLES } from "@wenyousite/foundation/elements";
import { cn } from "@/lib/utils";

const TOPIC_TAG_PREFIX = METADATA_ELEMENT_STYLES.topicTag.prefix;

interface TopicTagLinkProps {
  tag: {
    id: string;
    name: string;
  };
  appearance?: "pill" | "plain";
  className?: string;
}

/** 主题帖标签的统一浏览入口。 */
export function TopicTagLink({
  tag,
  appearance = "pill",
  className,
}: TopicTagLinkProps) {
  return (
    <Link
      href={`/tags/${tag.id}`}
      aria-label={`查看 #${tag.name} 标签下的主题帖`}
      data-slot="topic-tag"
      className={cn(
        appearance === "pill"
          ? "inline-flex min-h-[var(--element-topic-tag-min-height)] items-center rounded-full border border-[var(--element-topic-tag-border)] bg-[var(--element-topic-tag-surface)] px-2.5 text-xs font-[number:var(--element-topic-tag-font-weight)] text-[var(--element-topic-tag-foreground)] transition-[background-color,border-color,color] duration-[var(--motion-fast)] hover:bg-[var(--element-topic-tag-hover-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--element-topic-tag-border)]"
          : "inline-flex items-center font-[number:var(--element-topic-tag-font-weight)] text-[var(--element-topic-tag-foreground)] underline-offset-4 transition-[color,text-decoration-color] duration-[var(--motion-fast)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--element-topic-tag-border)]",
        className,
      )}
    >
      {TOPIC_TAG_PREFIX}{tag.name}
    </Link>
  );
}

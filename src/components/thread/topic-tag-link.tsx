import Link from "next/link";
import { METADATA_ELEMENT_STYLES } from "@wenyousite/foundation/elements";
import { cn } from "@/lib/utils";

const TOPIC_TAG_PREFIX = METADATA_ELEMENT_STYLES.topicTag.prefix;

interface TopicTagLinkProps {
  tag: {
    id: string;
    name: string;
  };
  appearance?: "compact" | "plain";
  className?: string;
}

/** 主题帖标签的统一浏览入口。 */
export function TopicTagLink({
  tag,
  appearance = "compact",
  className,
}: TopicTagLinkProps) {
  return (
    <Link
      href={`/tags/${tag.id}`}
      aria-label={`查看 #${tag.name} 标签下的主题帖`}
      data-slot="topic-tag"
      className={cn(
        "inline-flex min-h-[var(--element-topic-tag-min-height)] min-w-[var(--element-topic-tag-min-height)] items-center justify-center font-[number:var(--element-topic-tag-font-weight)] text-[var(--element-topic-tag-foreground)] underline-offset-4 transition-[color,text-decoration-color] duration-[var(--motion-fast)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--element-topic-tag-focus-ring)] focus-visible:ring-offset-2",
        appearance === "compact" && "text-xs",
        className,
      )}
    >
      {TOPIC_TAG_PREFIX}{tag.name}
    </Link>
  );
}

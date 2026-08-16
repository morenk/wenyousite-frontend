import type { ComponentProps } from "react";
import Link from "next/link";
import { INLINE_ELEMENT_STYLES } from "@wenyousite/foundation/elements";

import { cn } from "@/lib/utils";

type ContentLinkProps = Omit<ComponentProps<"a">, "href"> & {
  href: string;
  external?: boolean;
  mention?: boolean;
};

/** 正文普通链接与提及的统一入口；站内传送门由独立组件承载。 */
export function ContentLink({
  href,
  external = false,
  mention = false,
  className,
  children,
  ...props
}: ContentLinkProps) {
  const sharedProps = {
    ...props,
    className: cn(className),
    "data-slot": mention ? "mention-link" : "content-link",
  } as const;

  if (external) {
    return (
      <a
        href={href}
        {...sharedProps}
        target={INLINE_ELEMENT_STYLES.link.externalBehavior === "new-tab" ? "_blank" : undefined}
        rel="noreferrer"
      >
        {children}
      </a>
    );
  }

  return (
    <Link href={href} {...sharedProps}>
      {children}
    </Link>
  );
}

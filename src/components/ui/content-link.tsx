import type { ComponentProps } from "react";
import Link from "next/link";
import { INLINE_ELEMENT_STYLES } from "@wenyousite/foundation/elements";

import { cn } from "@/lib/utils";

type ContentLinkProps = Omit<ComponentProps<"a">, "href"> & {
  href: string;
  external?: boolean;
  mention?: boolean;
};

const SAFE_EXTERNAL_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

/** 内容链接的最终安全边界，避免未来调用方把危险协议交给 Link 或 a。 */
export function isSafeContentHref(value: string): boolean {
  const href = value.trim();
  if (!href || href.length > 2_048 || /[\u0000-\u001f\u007f]/u.test(href)) return false;
  if (/^(?:\/(?!\/)|[?#])/u.test(href)) return true;
  try {
    return SAFE_EXTERNAL_PROTOCOLS.has(new URL(href).protocol.toLowerCase());
  } catch {
    return false;
  }
}

/** 正文普通链接与提及的统一入口；站内传送门由独立组件承载。 */
export function ContentLink({
  href,
  external = false,
  mention = false,
  className,
  children,
  ...props
}: ContentLinkProps) {
  if (!isSafeContentHref(href)) {
    return <span data-slot={mention ? "mention-link" : "content-link"}>{children}</span>;
  }

  const isHttpUrl = /^https?:\/\//iu.test(href);
  const isNativeAnchor = external || isHttpUrl || /^mailto:/iu.test(href);
  const sharedProps = {
    ...props,
    className: cn(className),
    "data-slot": mention ? "mention-link" : "content-link",
  } as const;

  if (isNativeAnchor) {
    return (
      <a
        href={href}
        {...sharedProps}
        target={INLINE_ELEMENT_STYLES.link.externalBehavior === "new-tab" ? "_blank" : undefined}
        rel="noopener noreferrer"
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

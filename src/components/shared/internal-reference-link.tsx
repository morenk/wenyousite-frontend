"use client";

import Link from "next/link";
import { INLINE_ELEMENT_STYLES } from "@wenyousite/foundation/elements";
import { WenyouIcon } from "@/components/ui/wenyou-icon";
import { cn } from "@/lib/utils";

interface InternalReferenceLinkProps {
  href: string;
  label: string;
  className?: string;
}

/** 统一站内传送门：始终是正文内联元素，不呈现目标类型标签或元数据。 */
export function InternalReferenceLink({ href, label, className }: InternalReferenceLinkProps) {
  return (
    <Link
      href={href}
      data-slot="internal-reference-link"
      aria-label={`站内传送门：${label}`}
      className={cn(
        "internal-reference-element focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
        className,
      )}
    >
      <WenyouIcon
        id={INLINE_ELEMENT_STYLES.internalReference.icon}
        data-slot="internal-reference-icon"
      />
      <span data-slot="internal-reference-label">{label}</span>
    </Link>
  );
}

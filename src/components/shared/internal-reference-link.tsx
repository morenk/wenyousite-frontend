"use client";

import Link from "next/link";
import { DoorOpen } from "lucide-react";
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
        "mx-[0.08em] inline-flex items-baseline gap-[0.28em] rounded-[0.4em] bg-primary/10 px-[0.38em] py-[0.08em] font-semibold text-brand-strong no-underline transition-colors hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
        className,
      )}
    >
      <DoorOpen className="relative top-[0.08em] size-[0.92em]" aria-hidden="true" />
      <span>{label}</span>
    </Link>
  );
}

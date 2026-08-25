import Image from "next/image";

import { cn } from "@/lib/utils";

interface BrandTitleMarkProps {
  size: number;
  className?: string;
  priority?: boolean;
}

/** 保持品牌几何不变，并在黑夜表面使用 Foundation 品牌强调色。 */
export function BrandTitleMark({
  size,
  className,
  priority = false,
}: BrandTitleMarkProps) {
  return (
    <span
      className={cn("brand-title-mark relative inline-flex shrink-0", className)}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <Image
        src="/brand-title-icon-128.png"
        width={size}
        height={size}
        alt=""
        aria-hidden="true"
        className="brand-title-mark-light size-full"
        priority={priority}
      />
      <span className="brand-title-mark-dark absolute inset-0" />
    </span>
  );
}

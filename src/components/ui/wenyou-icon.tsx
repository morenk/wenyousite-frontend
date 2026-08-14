import {
  ICON_GLYPH_NODES,
  ICON_SEMANTICS,
  ICON_STYLE,
  type IconGlyphId,
  type IconSemanticId,
} from "@wenyousite/foundation/icons";
import { Icon, type IconNode, type LucideProps } from "lucide-react";
import { forwardRef } from "react";

export type WenyouIconId = IconSemanticId;

export interface WenyouIconProps extends Omit<LucideProps, "children" | "iconNode"> {
  id: WenyouIconId;
  /** 独立信息图标才提供；按钮中的装饰图标应保持隐藏。 */
  label?: string;
}

/** 跨端核心图标入口：产品语义由 Foundation 映射到固定 Lucide SVG 节点。 */
export const WenyouIcon = forwardRef<SVGSVGElement, WenyouIconProps>(
  function WenyouIcon({ id, label, size = ICON_STYLE.defaultSize, ...props }, ref) {
    const glyphId = ICON_SEMANTICS[id] as IconGlyphId;
    const iconNode = ICON_GLYPH_NODES[glyphId] as IconNode;
    return (
      <Icon
        ref={ref}
        iconNode={iconNode}
        size={size}
        strokeWidth={ICON_STYLE.strokeWidth}
        aria-hidden={label ? undefined : true}
        aria-label={label}
        role={label ? "img" : undefined}
        focusable="false"
        data-icon-semantic={id}
        data-icon-glyph={glyphId}
        {...props}
      />
    );
  },
);

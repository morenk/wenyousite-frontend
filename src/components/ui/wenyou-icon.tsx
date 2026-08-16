import {
  ICON_GLYPH_NODES,
  ICON_SEMANTICS,
  ICON_STYLE,
  type IconGlyphId,
  type IconSemanticId,
  type IconVisualVariant,
} from "@wenyousite/foundation/icons";
import { Icon, type IconNode, type LucideProps } from "lucide-react";
import { forwardRef } from "react";

export type WenyouIconId = IconSemanticId;

const reactIconNodes = Object.fromEntries(
  Object.entries(ICON_GLYPH_NODES).map(([glyphId, nodes]) => [
    glyphId,
    nodes.map(([elementName, attributes], index) => [
      elementName,
      { ...attributes, key: `${glyphId}-${index}` },
    ]),
  ]),
) as unknown as Record<IconGlyphId, IconNode>;

export interface WenyouIconProps extends Omit<LucideProps, "children" | "fill" | "iconNode"> {
  id: WenyouIconId;
  variant?: IconVisualVariant;
  /** 独立信息图标才提供；按钮中的装饰图标应保持隐藏。 */
  label?: string;
}

/** 跨端核心图标入口：产品语义由 Foundation 映射到固定 Lucide SVG 节点。 */
export const WenyouIcon = forwardRef<SVGSVGElement, WenyouIconProps>(
  function WenyouIcon({ id, label, size = ICON_STYLE.defaultSize, variant = "outline", ...props }, ref) {
    const glyphId = ICON_SEMANTICS[id] as IconGlyphId;
    const iconNode = reactIconNodes[glyphId];
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
        fill={variant === "filled" ? "currentColor" : "none"}
        data-icon-semantic={id}
        data-icon-glyph={glyphId}
        data-icon-variant={variant}
        {...props}
      />
    );
  },
);

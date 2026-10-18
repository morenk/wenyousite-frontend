import type { Ctx } from "@milkdown/kit/ctx";
import { configureEditorAlignmentParser, configureEditorAlignmentSchemas } from "@/components/editor/editor-alignment";
import { configureEditorMarkdownSerializer } from "@/components/editor/milkdown-markdown-codec";

export const textColorCapability = { markdownContractVersion: 6, textColorVersion: 1 } as const;

// 与生产 host 保持配置顺序，跨端导入不能只装颜色而漏掉对齐 schema。
export function configureTextColorTestEditor(ctx: Ctx) {
  configureEditorAlignmentParser(ctx, textColorCapability);
  configureEditorAlignmentSchemas(ctx, textColorCapability);
  configureEditorMarkdownSerializer(ctx);
}

export function textColorSemanticJson(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value, (key, item) => {
    if (key === "marker") return undefined;
    // Crepe 生成的 heading id 不写入 Markdown；保留 level、textAlign 及全部 mark 属性。
    if (item && typeof item === "object" && item.type === "heading") {
      return { ...item, attrs: { ...item.attrs, id: undefined } };
    }
    return item;
  }));
}

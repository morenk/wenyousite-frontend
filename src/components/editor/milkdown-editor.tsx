/** Milkdown Crepe WYSIWYG Markdown 编辑器封装 — 所有 UI 字符串中文本地化 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Milkdown, MilkdownProvider, useEditor, useInstance } from "@milkdown/react";
import { Crepe, CrepeFeature } from "@milkdown/crepe";
import { editorViewCtx } from "@milkdown/core";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { sanitizeEmptyImages } from "@/lib/markdown";

const MAX_CHARS = 10000;

const TOOLBAR_TOOLTIPS: Record<number, string> = {
  0: "粗体",
  1: "斜体",
  2: "无序列表",
  3: "链接",
  4: "图片",
  5: "代码块",
  6: "引用",
  7: "分隔线",
};

function injectToolbarTooltips() {
  const topBar = document.querySelector(".milkdown-top-bar");
  if (!topBar) return;

  const headingBtn = topBar.querySelector<HTMLButtonElement>(".top-bar-heading-button");
  if (headingBtn && !headingBtn.hasAttribute("title")) {
    headingBtn.title = "切换标题级别";
  }

  const buttons = topBar.querySelectorAll<HTMLButtonElement>(".top-bar-item");
  buttons.forEach((btn, index) => {
    if (TOOLBAR_TOOLTIPS[index] && !btn.hasAttribute("title")) {
      btn.title = TOOLBAR_TOOLTIPS[index]!;
    }
  });
}

interface MilkdownEditorProps {
  defaultValue?: string;
  onChange?: (value: string) => void;
  onUploadImage?: (file: File) => Promise<string>;
  placeholder?: string;
  disabled?: boolean;
  /** 内容区最大高度（px），超过后内容区出现滚动条；默认 400 */
  maxHeight?: number;
  /** 内容区最小高度（px），保证空白区可点击落位；默认 280 */
  minHeight?: number;
}

const CN_HEADING_OPTIONS = [
  { label: "正文", level: null as number | null },
  { label: "标题 1", level: 1 },
  { label: "标题 2", level: 2 },
  { label: "标题 3", level: 3 },
  { label: "标题 4", level: 4 },
  { label: "标题 5", level: 5 },
  { label: "标题 6", level: 6 },
];

function getImageBlockConfig(onUploadImage: (file: File) => Promise<string>) {
  return {
    [CrepeFeature.ImageBlock]: {
      onUpload: onUploadImage,
      inlineUploadButton: "上传",
      inlineUploadPlaceholderText: "或粘贴链接",
      blockUploadButton: "上传文件",
      blockConfirmButton: "确认",
      blockCaptionPlaceholderText: "输入图片说明",
      blockUploadPlaceholderText: "或粘贴链接",
    },
  };
}

function EditorCore({
  defaultValue,
  onChange,
  onUploadImage,
  placeholder,
  disabled,
  maxHeight = 400,
  minHeight = 280,
}: MilkdownEditorProps) {
  const [loading] = useInstance();
  const [charCount, setCharCount] = useState(defaultValue?.length ?? 0);
  const crepeRef = useRef<Crepe | null>(null);

  /** 上传失败时统一弹 toast（Milkdown 内部会静默吞掉 onUpload 的 reject） */
  const handleUpload = useCallback(
    async (file: File) => {
      try {
        return await onUploadImage!(file);
      } catch (error) {
        toast.error(
          (error as { message?: string })?.message || "上传失败，请稍后重试",
        );
        throw error;
      }
    },
    [onUploadImage],
  );

  useEditor(
    (root) => {
      const crepe = new Crepe({
        root,
        defaultValue: defaultValue ?? "",
        features: {
          [CrepeFeature.Table]: false,
          [CrepeFeature.Latex]: false,
          [CrepeFeature.AI]: false,
          [CrepeFeature.BlockEdit]: false,
          [CrepeFeature.TopBar]: true,
        },
        featureConfigs: {
          [CrepeFeature.Placeholder]: {
            text: placeholder ?? "开始输入…",
          },
          [CrepeFeature.TopBar]: {
            headingOptions: CN_HEADING_OPTIONS,
            // 精简工具栏：移除 删除线/行内代码/有序列表/todo
            buildTopBar: (builder) => {
              const formatting = builder.getGroup("formatting").group;
              formatting.items = formatting.items.filter(
                (item) => item.key !== "strikethrough" && item.key !== "code",
              );
              const list = builder.getGroup("list").group;
              list.items = list.items.filter(
                (item) => item.key !== "ordered-list" && item.key !== "task-list",
              );
              // 图片按钮：直接弹出文件选择框，跳过「上传/粘贴链接」输入区（论坛不支持外链图片）
              const insert = builder.getGroup("insert").group;
              const imageItem = insert.items.find(
                (item) => item.key === "image",
              );
              if (imageItem) {
                imageItem.onRun = (ctx) => {
                  const input = document.createElement("input");
                  input.type = "file";
                  input.accept = "image/*";
                  input.onchange = () => {
                    const file = input.files?.[0];
                    if (!file) return;
                    handleUpload(file)
                      .then((url) => {
                        const view = ctx.get(editorViewCtx);
                        const nodeType = view.state.schema.nodes["image-block"];
                        if (!nodeType) return;
                        const node = nodeType.createAndFill({ src: url });
                        if (!node) return;
                        view.dispatch(
                          view.state.tr.replaceSelectionWith(node),
                        );
                      })
                      .catch(() => {});
                  };
                  input.click();
                };
              }
            },
          },
          [CrepeFeature.LinkTooltip]: {
            inputPlaceholder: "粘贴链接…",
          },
          [CrepeFeature.CodeMirror]: {
            searchPlaceholder: "搜索语言",
            copyText: "复制",
            noResultText: "无结果",
            previewToggleText: (previewOnlyMode: boolean) =>
              previewOnlyMode ? "隐藏" : "编辑",
          },
          ...(onUploadImage ? getImageBlockConfig(handleUpload) : {}),
        },
      });

      crepeRef.current = crepe;

      crepe.on((listener) => {
        listener.markdownUpdated((_ctx, markdown, prevMarkdown) => {
          if (markdown !== prevMarkdown) {
            // 移除空 URL 图片（空图片块序列化为 ![]()，发布后会显示破图）
            const cleaned = sanitizeEmptyImages(markdown);
            setCharCount(cleaned.length);
            onChange?.(cleaned);
          }
        });
      });

      return crepe;
    },
    [],
  );

  useEffect(() => {
    crepeRef.current?.setReadonly(disabled ?? false);
  }, [disabled]);

  useEffect(() => {
    const topBar = document.querySelector(".milkdown-top-bar");
    if (topBar) {
      injectToolbarTooltips();
      return;
    }

    let attempts = 0;
    const maxAttempts = 50;
    const interval = setInterval(() => {
      attempts++;
      const tb = document.querySelector(".milkdown-top-bar");
      if (tb) {
        injectToolbarTooltips();
        clearInterval(interval);
        return;
      }
      if (attempts >= maxAttempts) {
        clearInterval(interval);
      }
    }, 100);

    return () => clearInterval(interval);
  }, []);

  const charWarning =
    charCount > MAX_CHARS * 0.9
      ? "text-destructive"
      : charCount > MAX_CHARS * 0.7
        ? "text-amber-500"
        : "text-muted-foreground";

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-background overflow-hidden",
        disabled && "opacity-60 pointer-events-none",
      )}
      style={
        {
          "--editor-min-height": `${minHeight}px`,
          "--editor-max-height": `${maxHeight}px`,
        } as React.CSSProperties
      }
    >
      <div className="milkdown-editor">
        <Milkdown />
        {loading && (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            编辑器加载中…
          </div>
        )}
      </div>
      <div className="flex items-center justify-between border-t border-border px-3 py-2">
        <span className="text-xs text-muted-foreground">
          支持 Markdown，粘贴或拖拽图片上传
        </span>
        <span className={cn("text-xs tabular-nums", charWarning)}>
          {charCount}/{MAX_CHARS}
        </span>
      </div>
    </div>
  );
}

export function MilkdownEditor(props: MilkdownEditorProps) {
  return (
    <MilkdownProvider>
      <EditorCore {...props} />
    </MilkdownProvider>
  );
}

/** Milkdown Crepe WYSIWYG Markdown 编辑器封装 — 所有 UI 字符串中文本地化 */

"use client";

import { useEffect, useRef, useState } from "react";
import { Milkdown, MilkdownProvider, useEditor, useInstance } from "@milkdown/react";
import { Crepe, CrepeFeature } from "@milkdown/crepe";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import "@milkdown/crepe/theme/nord.css";
import "@milkdown/crepe/theme/common/style.css";

const MAX_CHARS = 10000;

interface MilkdownEditorProps {
  defaultValue?: string;
  onChange?: (value: string) => void;
  onUploadImage?: (file: File) => Promise<string>;
  placeholder?: string;
  disabled?: boolean;
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
}: MilkdownEditorProps) {
  const [loading] = useInstance();
  const [charCount, setCharCount] = useState(defaultValue?.length ?? 0);
  const crepeRef = useRef<Crepe | null>(null);

  useEditor(
    (root) => {
      const crepe = new Crepe({
        root,
        defaultValue: defaultValue ?? "",
        features: {
          [CrepeFeature.Table]: false,
          [CrepeFeature.Latex]: false,
          [CrepeFeature.AI]: false,
          [CrepeFeature.TopBar]: true,
        },
        featureConfigs: {
          [CrepeFeature.Placeholder]: {
            text: placeholder ?? "开始输入…",
          },
          [CrepeFeature.TopBar]: {
            headingOptions: CN_HEADING_OPTIONS,
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
          [CrepeFeature.BlockEdit]: {
            textGroup: {
              label: "文本",
              text: { label: "文本" },
              h1: { label: "标题 1" },
              h2: { label: "标题 2" },
              h3: { label: "标题 3" },
              h4: { label: "标题 4" },
              h5: { label: "标题 5" },
              h6: { label: "标题 6" },
              quote: { label: "引用" },
              divider: { label: "分隔线" },
            },
            listGroup: {
              label: "列表",
              bulletList: { label: "无序列表" },
              orderedList: { label: "有序列表" },
              taskList: { label: "任务列表" },
            },
            advancedGroup: {
              label: "高级",
              image: { label: "图片" },
              codeBlock: { label: "代码块" },
              table: { label: "表格" },
              math: { label: "公式" },
            },
          },
          ...(onUploadImage ? getImageBlockConfig(onUploadImage) : {}),
        },
      });

      crepeRef.current = crepe;

      crepe.on((listener) => {
        listener.markdownUpdated((_ctx, markdown, prevMarkdown) => {
          if (markdown !== prevMarkdown) {
            setCharCount(markdown.length);
            onChange?.(markdown);
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
    >
      <div className="min-h-[280px] milkdown-editor">
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

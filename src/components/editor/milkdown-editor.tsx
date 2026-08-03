/** Milkdown Crepe WYSIWYG Markdown 编辑器封装 — 所有 UI 字符串中文本地化 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Milkdown, MilkdownProvider, useEditor, useInstance } from "@milkdown/react";
import { Crepe, CrepeFeature } from "@milkdown/crepe";
import { editorViewCtx } from "@milkdown/core";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { sanitizeMilkdownMarkdown } from "@/lib/markdown";
import { useAuth } from "@/lib/auth";
import { useSaveDraft } from "@/api/hooks/use-save-draft";
import { ContentDraftsPanel } from "@/components/user/content-drafts-panel";

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
  8: "正文草稿",
};

const DRAFT_ICON = `
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="currentColor" d="M5 3h11l3 3v15H5V3Zm2 2v14h10V7.5L14.5 5H7Zm2 4h6v2H9V9Zm0 4h6v2H9v-2Z" />
  </svg>
`;

function injectToolbarTooltips() {
  document.querySelectorAll(".milkdown-top-bar").forEach((topBar) => {
    const headingBtn = topBar.querySelector<HTMLButtonElement>(".top-bar-heading-button");
    if (headingBtn && !headingBtn.hasAttribute("title")) {
      headingBtn.title = "切换标题级别";
    }

    const buttons = topBar.querySelectorAll<HTMLButtonElement>(".top-bar-item");
    buttons.forEach((btn, index) => {
      if (TOOLBAR_TOOLTIPS[index] && !btn.hasAttribute("title")) {
        btn.title = TOOLBAR_TOOLTIPS[index]!;
        btn.setAttribute("aria-label", TOOLBAR_TOOLTIPS[index]!);
      }
    });
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

interface EditorHostProps {
  initialValue: string;
  onChange?: (value: string) => void;
  onUploadImage?: (file: File) => Promise<string>;
  placeholder?: string;
  disabled?: boolean;
  onOpenDrafts?: () => void;
  maxHeight: number;
  minHeight: number;
}

/** Crepe 编辑器宿主：以 initialValue 初始化；被外层按 key 重挂载以回填恢复的正文草稿 */
function EditorHost({
  initialValue,
  onChange,
  onUploadImage,
  placeholder,
  disabled,
  onOpenDrafts,
}: EditorHostProps) {
  const [loading] = useInstance();
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
        defaultValue: initialValue,
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
              if (onOpenDrafts) {
                builder.addGroup("draft", "草稿").addItem("draft", {
                  icon: DRAFT_ICON,
                  active: () => false,
                  onRun: () => onOpenDrafts(),
                });
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
        listener.markdownUpdated((ctx, markdown, prevMarkdown) => {
          if (markdown !== prevMarkdown) {
            // 清理空图片并规范化空段落协议；独占行 <br /> 必须保留以支持艺术化留白。
            let serialized = markdown;
            // Milkdown 默认省略文档最后一个空段落；该段落是用户按 Enter 产生的有效留白，补回协议标记。
            const lastNode = ctx.get(editorViewCtx).state.doc.lastChild;
            if (lastNode?.type.name === "paragraph" && lastNode.content.size === 0) {
              serialized = `${serialized.replace(/\s+$/u, "")}\n\n<br />`;
            }
            const cleaned = sanitizeMilkdownMarkdown(serialized);
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

  return (
    <div className="milkdown-editor">
      <Milkdown />
      {loading && (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          编辑器加载中…
        </div>
      )}
    </div>
  );
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
  const { user } = useAuth();
  const { mutateAsync: saveDraftAutomatically } = useSaveDraft();
  const [restoredValue, setRestoredValue] = useState<string | undefined>(defaultValue);
  const [version, setVersion] = useState(0);
  const [currentContent, setCurrentContent] = useState(defaultValue ?? "");
  const [draftOpen, setDraftOpen] = useState(false);
  const [draftInitialContent, setDraftInitialContent] = useState("");
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const latestContentRef = useRef(defaultValue ?? "");
  const autoSaveQueueRef = useRef<Promise<unknown>>(Promise.resolve());
  const autoSaveSequenceRef = useRef(0);

  const handleChange = useCallback(
    (value: string) => {
      latestContentRef.current = value;
      setCurrentContent(value);
      if (autoSaveEnabled) setAutoSaveStatus("idle");
      onChange?.(value);
    },
    [autoSaveEnabled, onChange],
  );

  const handleRestore = useCallback(
    (content: string) => {
      latestContentRef.current = content;
      setRestoredValue(content);
      setCurrentContent(content);
      setVersion((v) => v + 1);
      onChange?.(content);
      toast.success("已恢复正文草稿");
    },
    [onChange],
  );

  const handleOpenDrafts = useCallback(() => {
    setDraftInitialContent(latestContentRef.current);
    setDraftOpen(true);
  }, []);

  useEffect(() => {
    if (!autoSaveEnabled) return;

    const content = currentContent.trim();
    if (!content) return;

    const sequence = ++autoSaveSequenceRef.current;
    const timer = window.setTimeout(() => {
      setAutoSaveStatus("saving");
      autoSaveQueueRef.current = autoSaveQueueRef.current
        .catch(() => undefined)
        .then(() => saveDraftAutomatically({ content, slot: 1 }))
        .then(() => {
          if (autoSaveSequenceRef.current === sequence) setAutoSaveStatus("saved");
        })
        .catch((error) => {
          if (autoSaveSequenceRef.current === sequence) {
            setAutoSaveStatus("error");
            toast.error(
              (error as { message?: string })?.message || "正文草稿自动保存失败",
            );
          }
        });
    }, 800);

    return () => window.clearTimeout(timer);
  }, [autoSaveEnabled, currentContent, saveDraftAutomatically]);

  const handleAutoSaveChange = useCallback((enabled: boolean) => {
    setAutoSaveEnabled(enabled);
    setAutoSaveStatus("idle");
  }, []);

  const charCount = currentContent.length;

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
      <EditorHost
        key={`${version}-${user?.id ?? "guest"}`}
        initialValue={restoredValue ?? ""}
        onChange={handleChange}
        onUploadImage={onUploadImage}
        placeholder={placeholder}
        disabled={disabled}
        onOpenDrafts={user ? handleOpenDrafts : undefined}
        maxHeight={maxHeight}
        minHeight={minHeight}
      />
      <div className="flex items-center justify-between border-t border-border px-3 py-2">
        <span className="text-xs text-muted-foreground">
          支持 Markdown，粘贴或拖拽图片上传
        </span>
        <div className="flex items-center gap-3">
          {autoSaveEnabled && (
            <span
              className={cn(
                "text-xs",
                autoSaveStatus === "error"
                  ? "text-destructive"
                  : "text-muted-foreground",
              )}
            >
              自动草稿：
              {autoSaveStatus === "saving"
                ? "保存中"
                : autoSaveStatus === "saved"
                  ? "已保存"
                  : autoSaveStatus === "error"
                    ? "保存失败"
                    : "等待编辑"}
            </span>
          )}
          <span className={cn("text-xs tabular-nums", charWarning)}>
            {charCount}/{MAX_CHARS}
          </span>
        </div>
      </div>
      {draftOpen && (
        <ContentDraftsPanel
          open
          onClose={() => setDraftOpen(false)}
          onRestore={handleRestore}
          initialContent={draftInitialContent}
          autoSaveEnabled={autoSaveEnabled}
          autoSaveStatus={autoSaveStatus}
          onAutoSaveChange={handleAutoSaveChange}
        />
      )}
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

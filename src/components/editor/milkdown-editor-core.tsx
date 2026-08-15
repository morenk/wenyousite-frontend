/** Milkdown 编辑器公开壳：草稿、字数与宿主生命周期。 */

"use client";

import { MilkdownProvider } from "@milkdown/react";
import { ContentDraftsPanel } from "@/components/editor/content-drafts-panel";
import { MilkdownEditorHost } from "@/components/editor/milkdown-editor-host";
import { useEditorDraftController } from "@/components/editor/use-editor-draft-controller";
import type { InlineDiceRoll } from "@/lib/dice-inline";
import type { UploadImageOptions } from "@/lib/upload-image";
import { cn } from "@/lib/utils";
import "@/components/editor/milkdown-editor.css";

const MAX_CHARS = 10000;

export interface MilkdownEditorProps {
  defaultValue?: string;
  onChange?: (value: string) => void;
  onUploadImage?: (file: File, options?: UploadImageOptions) => Promise<string>;
  placeholder?: string;
  disabled?: boolean;
  /** 内容区最大高度（px），超过后内容区出现滚动条；默认 400 */
  maxHeight?: number;
  /** 内容区最小高度（px），保证空白区可点击落位；默认 280 */
  minHeight?: number;
  /** 当前主题帖 ID；提供后启用受权限约束的 @候选菜单。 */
  threadId?: string;
  /** 已由服务端结算的结果；按 nodeId 映射到正文内联节点。 */
  diceRolls?: InlineDiceRoll[];
  /** 编辑器就绪后聚焦正文；仅用于明确的创建后续写流程。 */
  autoFocus?: boolean;
  /** contenteditable 正文输入区的可访问名称。 */
  ariaLabel?: string;
}

function EditorCore({
  defaultValue,
  onChange,
  onUploadImage,
  placeholder,
  disabled,
  maxHeight = 400,
  minHeight = 280,
  threadId,
  diceRolls = [],
  autoFocus = false,
  ariaLabel,
}: MilkdownEditorProps) {
  const {
    user,
    restoredValue,
    version,
    currentContent,
    draftOpen,
    setDraftOpen,
    autoSaveEnabled,
    autoSaveStatus,
    handleChange,
    handleRestore,
    handleOpenDrafts,
    handleAutoSaveChange,
  } = useEditorDraftController({ defaultValue: defaultValue ?? "", onChange });

  const charCount = currentContent.length;
  const editorAriaLabel = ariaLabel ?? placeholder ?? "正文编辑器";
  const charWarning = charCount > MAX_CHARS * 0.9
    ? "text-destructive"
    : charCount > MAX_CHARS * 0.7
      ? "text-warning"
      : "text-muted-foreground";

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-background overflow-hidden",
        disabled && "opacity-60 pointer-events-none",
      )}
      style={{
        "--editor-min-height": `${minHeight}px`,
        "--editor-max-height": `${maxHeight}px`,
      } as React.CSSProperties}
    >
      <MilkdownEditorHost
        key={`${version}-${user?.id ?? "guest"}`}
        initialValue={restoredValue ?? ""}
        onChange={handleChange}
        onUploadImage={onUploadImage}
        placeholder={placeholder}
        disabled={disabled}
        onOpenDrafts={user ? handleOpenDrafts : undefined}
        maxHeight={maxHeight}
        minHeight={minHeight}
        threadId={threadId}
        diceRolls={diceRolls}
        autoFocus={autoFocus}
        ariaLabel={editorAriaLabel}
      />
      <div className="flex items-center justify-between border-t border-border px-3 py-2">
        <span className="text-xs text-muted-foreground">
          仅工具栏中的格式会作为正文结构
        </span>
        <div className="flex items-center gap-3">
          {(autoSaveEnabled || autoSaveStatus === "error") && (
            <span className={cn(
              "text-xs",
              autoSaveStatus === "error" ? "text-destructive" : "text-muted-foreground",
            )}>
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
          initialContent={currentContent}
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

import type { Ref } from "react";
import type { MentionIdentity } from "@/lib/thread-identity";
import type { MarkdownMediaAudio } from "@/lib/markdown-audio";
import type { MarkdownMediaDisplay } from "@/lib/media-display";
import type { InlineDiceRoll } from "@/lib/dice-inline";
import type { UploadImageOptions } from "@/lib/upload-image";
import type { EditorSubmissionHandle } from "./use-editor-submission";

/** 轻量动态入口与实际编辑宿主共用的公开编辑器参数。 */
export interface MilkdownEditorProps {
  defaultValue?: string;
  /** 仅主题、子帖、楼层和回复正文显式启用取色。 */
  allowTextColor?: boolean;
  /** 仅主题、子帖、楼层和回复正文启用字体显示、加载与站内粘贴。 */
  allowTextFont?: boolean;
  audioDraftKey?: string;
  mediaAudios?: readonly MarkdownMediaAudio[];
  mediaDisplays?: readonly MarkdownMediaDisplay[];
  mentionIdentities?: readonly MentionIdentity[];
  editorRef?: Ref<EditorSubmissionHandle>;
  onValidityChange?: (valid: boolean) => void;
  onChange?: (value: string) => void;
  /** 每次文档变更即时通知；onChange 为延后的已验证 Markdown 快照。 */
  onDocumentChange?: () => void;
  onSyncErrorChange?: (hasError: boolean) => void;
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

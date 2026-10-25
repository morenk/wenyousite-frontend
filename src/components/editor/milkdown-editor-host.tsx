"use client";
import { useDynamicTextFonts } from "@/api/hooks/use-dynamic-text-fonts";
import { rememberDynamicFont } from "@/lib/dynamic-text-font-state";
import { EditorFontDownloadProgress, type EditorFontDownloadHandle } from "./editor-font-download-progress";
import { DynamicFontSpecimen } from "./dynamic-font-specimen";
import { useVisibleTextFonts } from "./use-visible-text-fonts";
import { useTextFontCatalog } from "@/api/hooks/use-text-font-catalog";
import { textFontOptions, textFontGroup } from "./editor-text-font-options";
import { validatedFontBase } from "@/lib/thread-font-runtime";
import { EditorFontPreview } from "./editor-font-preview";
import { editorTextFontSchema, editorTextFontAtomicPolicy, configureEditorTextFontRendering } from "./editor-text-font";
import { applyEditorTextFont, getEditorTextFont, editorTextFontTyping, clearEditorTextFontTyping } from "./editor-text-font-command";
/** Milkdown 编辑器核心：仅由轻量动态入口加载。 */



import { useEditorAudioView } from "./editor-audio-view";
import type { MarkdownMediaAudio } from "@/lib/markdown-audio";
import { useEditorAudioUpload } from "./use-editor-audio-upload";
import { useEditorToolbarPreference } from "./use-editor-toolbar-preference";
import { applyEditorTextColor, clearEditorTextColorTyping, editorTextColorTyping, getEditorTextColor } from "./editor-text-color-command";
import type { SelectionBookmark } from "@milkdown/kit/prose/state";
import { EditorHeadingMenu } from "./editor-heading-menu";
import { getSelectedEditorHeading } from "./editor-heading-state";
import { EDITOR_TOOLBAR_TOOLS, type EditorToolbarTool } from "@/lib/editor-toolbar-preference";
import type { Ctx } from "@milkdown/kit/ctx";
import { editorTextColorSchema, editorTextColorAtomicPolicy } from "./editor-text-color";
import type { MentionIdentity } from "@/lib/thread-identity";


import { threadAppearance } from "@/lib/thread-identity";
import { useEditorMediaDisplay } from "@/components/editor/use-editor-media-display";
import { editorMentionCaretPlugin } from "./editor-mention-caret";
import { editorInlineCodeCommand } from "./editor-inline-code";
import type { MarkdownMediaDisplay, MediaDisplay } from "@/lib/media-display";
import {
  memo,
  useCallback,
  useImperativeHandle,
  type Ref,
  useEffect,
  useMemo,
  useRef,
  useState,

} from "react";
import { Milkdown, useEditor, useInstance } from "@milkdown/react";
import { CrepeBuilder } from "@milkdown/crepe/builder";
import { cursor } from "@milkdown/crepe/feature/cursor";
import { imageBlock } from "@milkdown/crepe/feature/image-block";
import { linkTooltip } from "@milkdown/crepe/feature/link-tooltip";
import { listItem } from "@milkdown/crepe/feature/list-item";
import { placeholder as placeholderFeature } from "@milkdown/crepe/feature/placeholder";
import { topBar } from "@milkdown/crepe/feature/top-bar";
import { commandsCtx, editorViewCtx } from "@milkdown/core";
import { toggleLinkCommand } from "@milkdown/kit/component/link-tooltip";
import {
  codeBlockKeymap,
  createCodeBlockInputRule,
  emphasisStarInputRule,
  emphasisUnderscoreInputRule,
  headingKeymap,
  inlineCodeInputRule,
  inlineCodeSchema,
  insertHrCommand,
  insertHrInputRule,
  insertImageInputRule,
  linkSchema,
  strongInputRule,
  toggleInlineCodeCommand,
  wrapInBlockquoteCommand,
  wrapInBlockquoteInputRule,
  wrapInBulletListCommand,
  wrapInBulletListInputRule,
  wrapInHeadingCommand,
  wrapInOrderedListCommand,
  wrapInOrderedListInputRule,
  wrapInHeadingInputRule,
} from "@milkdown/kit/preset/commonmark";
import {
  insertTableInputRule,
  strikethroughInputRule,
  tableKeymap,
  toggleStrikethroughCommand,
  wrapInTaskListInputRule,
} from "@milkdown/kit/preset/gfm";
import { TextSelection } from "@milkdown/kit/prose/state";
import type { EditorView } from "@milkdown/kit/prose/view";
import { $useKeymap, $view } from "@milkdown/kit/utils";
import { useDebounce } from "use-debounce";
import { toast } from "sonner";
import { ImageUploadProgress } from "@/components/shared/image-upload-progress";
import type {
  UploadImageOptions,
  UploadImageProgress as UploadImageProgressValue,
} from "@/lib/upload-image";
import {
  createInlineDiceNode,
  DICE_INLINE_NODE_NAME,
  parseInlineDiceNodes,
  DICE_INSERTION_PRESENTATION,
  type InlineDiceRoll,
} from "@/lib/dice-inline";
import {
  getDiceNotationError,
  MAX_DICE_ROLLS_PER_POST,
  type DiceExpressionInput,
} from "@/lib/dice";
import {
  fitDefaultMilkdownToolbar,
  fitCustomMilkdownToolbar,
  handleCustomToolbarKeyDown,
  syncMilkdownHeadingOptions,
  syncMilkdownMoreMenuState,
  syncMilkdownToolbarSemantics,
  syncMilkdownToolbarItems,
  syncMilkdownToolbarVisibility,
  type MilkdownToolbarItemMetadata,
} from "@/lib/milkdown-toolbar";
import { getApiErrorMessage } from "@/api/errors";
import { useMentionCandidates } from "@/api/hooks/use-mention-candidates";
import { createDiceInlineEditorPlugins } from "@/components/editor/dice-inline-plugin";
import { DiceInsertPopover } from "@/components/editor/dice-insert-popover";
import {
  EditorMoreMenu,
  type EditorMoreMenuItem,
} from "@/components/editor/editor-more-menu";
import { createStickerInlineEditorPlugins } from "@/components/editor/sticker-inline-plugin";
import { StickerPickerPopover } from "@/components/sticker/sticker-picker-popover";
import { MAX_STICKERS_PER_POST, STICKER_INLINE_NODE_NAME } from "@/lib/sticker-inline";
import {
  MentionCandidateMenu,
  type MentionMenuItem,
} from "@/components/editor/mention-candidate-menu";
import {
  useEditorMentionController,
  type EditorMentionMenu,
} from "@/components/editor/use-editor-mention-controller";
import {
  EDITOR_CAPABILITY_LABELS,
  EDITOR_CREATABLE_HEADING_LEVELS,
  type EditorCapabilityId,
} from "@/lib/editor-capabilities";
import {
  editorAlignmentIconSvg,
  editorChevronDownSvg,
  editorIconSvg,
} from "@/lib/editor-icons";
import { WenyouIcon } from "@/components/ui/wenyou-icon";
import { createEditorMarkdownPastePlugin } from "@/components/editor/markdown-literal-paste";
import {
  configureEditorMarkdownSerializer,
  createEditorMarkdownBridge,
  editorAttentionBoundaryParser,
  editorBoundaryTextSchema,
  editorSoftBreakParser,
  prepareEditorMarkdown,
} from "@/components/editor/milkdown-markdown-codec";
import { createEditorLinkMarkView } from "@/components/shared/internal-reference-editor-dom";
import {
  createEditorAlignmentPlugin,
  configureEditorAlignmentParser,
  configureEditorAlignmentSchemas,
  toggleEditorAlignment,
  getSelectedTextAlignment,
  setSelectedEditorHeading,
} from "@/components/editor/editor-alignment";
import {
  alignmentLabel,
  type WenyouTextAlignment,
} from "@/lib/markdown-alignment";
import "@/components/editor/milkdown-editor.css";

import type { EditorSubmissionHandle } from "@/components/editor/use-editor-submission";

const toolbarHeadingKeymap = $useKeymap("wenyousiteHeadingKeymap", {
  TurnIntoH2: {
    shortcuts: "Mod-Alt-2",
    command: (ctx) => {
      const commands = ctx.get(commandsCtx);
      return () => setSelectedEditorHeading(ctx, 2)
        || commands.call(wrapInHeadingCommand.key, 2);
    },
  },
  TurnIntoH3: {
    shortcuts: "Mod-Alt-3",
    command: (ctx) => {
      const commands = ctx.get(commandsCtx);
      return () => setSelectedEditorHeading(ctx, 3)
        || commands.call(wrapInHeadingCommand.key, 3);
    },
  },
});

const internalReferenceLinkView = $view(
  linkSchema.mark,
  () => (mark) => createEditorLinkMarkView(mark),
);

const CN_HEADING_OPTIONS = [
  { label: "正文", level: null as number | null },
  { label: "标题 1", level: 1 },
  { label: "标题 2", level: 2 },
  { label: "标题 3", level: 3 },
  { label: "标题 4", level: 4 },
  { label: "标题 5", level: 5 },
  { label: "标题 6", level: 6 },
];

const CREATABLE_HEADING_LABELS = new Set([
  "正文",
  ...EDITOR_CREATABLE_HEADING_LEVELS.map((level) => `标题 ${level}`),
]);

function syncAlignmentToolbarState(
  root: ParentNode,
  alignment: WenyouTextAlignment,
) {
  for (const option of ["center", "right"] as const) {
    root.querySelectorAll<HTMLButtonElement>(`[data-editor-tool="align-${option}"]`)
      .forEach((button) => {
        button.setAttribute("aria-pressed", String(alignment === option));
      });
  }
}

function positionEditorPopover(
  anchor: DOMRect,
  width: number,
  estimatedHeight: number,
): { top: number; left: number } {
  const gap = 8;
  const maxLeft = Math.max(gap, window.innerWidth - width - gap);
  const belowTop = anchor.bottom + 6;
  const top = belowTop + estimatedHeight <= window.innerHeight - gap
    ? belowTop
    : Math.max(gap, anchor.top - estimatedHeight - 6);
  return {
    top,
    left: Math.max(gap, Math.min(maxLeft, anchor.right - width)),
  };
}

function getImageBlockConfig(onUploadImage: (file: File) => Promise<string>, proxyDomURL: (url: string) => string) {
  return {
    onUpload: onUploadImage,
    proxyDomURL,
    inlineUploadButton: "上传",
    inlineUploadPlaceholderText: "仅支持上传文件",
    blockUploadButton: "上传文件",
    blockConfirmButton: "确认",
    blockCaptionPlaceholderText: "输入图片说明",
    blockUploadPlaceholderText: "仅支持上传文件",
  };
}

export interface MilkdownEditorHostProps {
  mediaAudios?: readonly MarkdownMediaAudio[];
  audioDraftKey?: string;
  audioUserId?: string;
  initialValue: string;
  mediaDisplays?: readonly MarkdownMediaDisplay[];
  mentionIdentities?: readonly MentionIdentity[];
  markdownContractVersion: number;
  textFontVersion?: 1 | 2;
  textFontRenderingEnabled?: boolean;
  textFontWriteEnabled?: boolean;
  textColorVersion?: 1;
  textColorWriteEnabled?: boolean;
  textColorAccountId?: string;
  editorRef?: Ref<EditorSubmissionHandle>;
  onValidityChange?: (valid: boolean) => void;
  onChange?: (value: string) => void;
  onDocumentChange?: () => void;
  onCompositionChange?: (composing: boolean) => void;
  onSyncErrorChange?: (hasError: boolean) => void;
  onUploadImage?: (file: File, options?: UploadImageOptions) => Promise<string>;
  placeholder?: string;
  disabled?: boolean;
  onOpenDrafts?: () => void;
  maxHeight: number;
  minHeight: number;
  threadId?: string;
  diceRolls?: InlineDiceRoll[];
  autoFocus?: boolean;
  ariaLabel: string;
}

/** Crepe 编辑器宿主：以 initialValue 初始化；被外层按 key 重挂载以回填恢复的正文草稿 */
export const MilkdownEditorHost = memo(function MilkdownEditorHost({
  initialValue,
  mediaDisplays,
  mediaAudios,
  audioDraftKey,
  audioUserId,
  mentionIdentities,
  markdownContractVersion,
  textFontVersion,
  textFontRenderingEnabled = false,
  textFontWriteEnabled = false,
  textColorVersion,
  textColorWriteEnabled = false,
  textColorAccountId,
  editorRef,
  onValidityChange,
  onChange,
  onDocumentChange,
  onCompositionChange,
  onSyncErrorChange,
  onUploadImage,
  placeholder,
  disabled,
  onOpenDrafts,
  threadId,
  diceRolls = [],
  autoFocus = false,
  ariaLabel,
}: MilkdownEditorHostProps) {
  const [loading] = useInstance();
  const toolbarPreference = useEditorToolbarPreference();
  const toolbarActionsRef = useRef(new Map<string, (ctx: Ctx) => void>());
  const [customMore, setCustomMore] = useState<EditorToolbarTool[]>([]);
  const [stickerAnchor, setStickerAnchor] = useState<HTMLElement | null>(null);
  const [headingMenuAnchor, setHeadingMenuAnchor] = useState<HTMLElement | null>(null);
  const [headingLevel, setHeadingLevel] = useState<0 | 2 | 3>();
  const fontDemandScope = useRef(Symbol("editor-font-demand"));
  const fontDownloadRef = useRef<EditorFontDownloadHandle>(null);
  const colorSelectionRef = useRef<SelectionBookmark | null>(null);
  const [fontSelection, setFontSelection] = useState<{ enabled: boolean; fontId: string | null | undefined }>({ enabled: false, fontId: undefined });
  const fontCatalog = useTextFontCatalog(textFontWriteEnabled && textFontVersion === 1);
  const dynamicCatalog = useDynamicTextFonts(textFontWriteEnabled && textFontVersion === 2);
  const [colorSelection, setColorSelection] = useState<{ enabled: boolean; color: string | null | undefined }>({ enabled: false, color: undefined });
  const capabilityReady = true;
  const alignmentEnabled = markdownContractVersion >= 4;
  const imageAlignmentEnabled = markdownContractVersion >= 5;
  const crepeRef = useRef<CrepeBuilder | null>(null);
  useEffect(() => {
    if (!loading && !textColorWriteEnabled) crepeRef.current?.editor.action((ctx) => clearEditorTextColorTyping(ctx.get(editorViewCtx)));
  }, [loading, textColorWriteEnabled]);
  useEffect(() => {
    if (!loading && !textFontWriteEnabled) crepeRef.current?.editor.action((ctx) => clearEditorTextFontTyping(ctx.get(editorViewCtx)));
  }, [loading, textFontWriteEnabled]);
  const captureColorSelection = useCallback(() => {
    crepeRef.current?.editor.action((ctx) => {
      const state = ctx.get(editorViewCtx).state;
      colorSelectionRef.current = state.selection.getBookmark();
      setHeadingLevel(getSelectedEditorHeading(state));
      setColorSelection(getEditorTextColor(state));
      setFontSelection(getEditorTextFont(state));
    });
  }, []);
  const restoreColorSelection = () => {
    crepeRef.current?.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      if (colorSelectionRef.current) {
        const selection = colorSelectionRef.current.resolve(view.state.doc);
        if (!selection.eq(view.state.selection)) view.dispatch(view.state.tr.setSelection(selection));
      }
      view.focus();
    });
  };
  const audioView = useEditorAudioView(mediaAudios, audioUserId, audioDraftKey);
  const audioUpload = useEditorAudioUpload(crepeRef, audioUserId, audioDraftKey, loading, audioView.completed);
  const audioActionRef = useRef(audioUpload.open);
  useEffect(() => { audioActionRef.current = audioUpload.open; }, [audioUpload.open]);
  const mediaDisplay = useEditorMediaDisplay(mediaDisplays, crepeRef, loading);
  const hostRef = useRef<HTMLDivElement>(null);
  useVisibleTextFonts(hostRef, loading, undefined, textFontRenderingEnabled, fontDemandScope.current);
  const onChangeRef = useRef(onChange);
  const onValidityRef = useRef(onValidityChange);
  const flushRef = useRef<(() => string | null) | null>(null);
  const composingRef = useRef(false);
  const documentCallbacksRef = useRef({ onDocumentChange, onCompositionChange });
  useEffect(() => { documentCallbacksRef.current = { onDocumentChange, onCompositionChange }; }, [onDocumentChange, onCompositionChange]);
  useImperativeHandle(editorRef, () => ({
    flush: () => flushRef.current?.() ?? null,
    isComposing: () => composingRef.current,
    getMediaDisplays: mediaDisplay.snapshot,
    getMediaAudios: audioView.api.snapshot,
    hasPendingUpload: audioUpload.hasPending,
  }), [mediaDisplay, audioUpload.hasPending, audioView.api]);
  useEffect(() => { onValidityRef.current = onValidityChange; }, [onValidityChange]);
  const onSyncErrorChangeRef = useRef(onSyncErrorChange);
  useEffect(() => { onSyncErrorChangeRef.current = onSyncErrorChange; }, [onSyncErrorChange]);
  const toolbarItemsRef = useRef<MilkdownToolbarItemMetadata[]>([]);
  const uploadAbortRef = useRef<AbortController | null>(null);
  const imageAlignmentEnabledRef = useRef(imageAlignmentEnabled);
  const diceSelectionRef = useRef<{ from: number; to: number } | null>(null);
  const [dicePopover, setDicePopover] = useState<{ top: number; left: number } | null>(null);
  const [moreMenuAnchor, setMoreMenuAnchor] = useState<HTMLElement | null>(null);
  const [defaultMore, setDefaultMore] = useState<EditorCapabilityId[]>([]);
  const [currentAlignment, setCurrentAlignment] = useState<WenyouTextAlignment>("left");
  const [diceNodeCount, setDiceNodeCount] = useState(
    () => parseInlineDiceNodes(initialValue).length,
  );
  const [diceInput, setDiceInput] = useState<DiceExpressionInput>(() => ({
    quantity: String(DICE_INSERTION_PRESENTATION.defaults.quantity),
    sides: String(DICE_INSERTION_PRESENTATION.defaults.sides),
    modifier: String(DICE_INSERTION_PRESENTATION.defaults.modifier),
  }));
  const [mentionMenu, setMentionMenu] = useState<EditorMentionMenu | null>(null);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const [uploadProgress, setUploadProgress] = useState<UploadImageProgressValue | null>(null);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    imageAlignmentEnabledRef.current = imageAlignmentEnabled;
  }, [imageAlignmentEnabled]);

  useEffect(() => {
    if (!autoFocus || disabled || loading) return;
    const frame = window.requestAnimationFrame(() => {
      crepeRef.current?.editor.action((ctx) => ctx.get(editorViewCtx)).focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [autoFocus, disabled, loading]);
  const mentionQuery = mentionMenu?.query ?? "";
  const [debouncedMentionQuery] = useDebounce(mentionQuery, 180);
  const {
    data: mentionResponse,
    userMentionsUnavailable,
    isFetching: isMentionFetching,
    isError: isMentionError,
    refetch: refetchMentionCandidates,
  } = useMentionCandidates(
    threadId,
    debouncedMentionQuery,
    Boolean(mentionMenu),
  );

  const mentionItems = useMemo<MentionMenuItem[]>(() => {
    const items: MentionMenuItem[] = [];
    if (
      mentionResponse?.canMentionAllPlayers &&
      (!mentionQuery || "全体玩家".includes(mentionQuery))
    ) {
      items.push({ id: "all-players", label: "全体玩家", isGroup: true });
    }
    for (const candidate of mentionResponse?.users ?? []) {
      const appearance = threadAppearance(candidate);
      items.push({
        id: candidate.candidateKey ?? candidate.id,
        label: `@${candidate.mentionLabel ?? appearance.name}`,
        username: candidate.mentionLabel ?? appearance.name,
        mentionHref: candidate.mentionHref ?? "/users/" + candidate.id,
        accountUsername: candidate.rpIdentity ? candidate.username : undefined,
        avatar: appearance.avatar,
        avatarDisplay: appearance.avatarDisplay,
        relation: candidate.relation,
      });
    }
    return items;
  }, [mentionQuery, mentionResponse]);
  const mentionQueryPending = debouncedMentionQuery !== mentionQuery;
  const visibleMentionItems = useMemo(
    () => (mentionQueryPending ? [] : mentionItems),
    [mentionItems, mentionQueryPending],
  );
  const activeMentionIndex = Math.min(
    selectedMentionIndex,
    Math.max(visibleMentionItems.length - 1, 0),
  );

  const { handleMentionSelect } = useEditorMentionController({
    mentionIdentities,
    hostRef,
    crepeRef,
    disabled,
    loading,
    threadId,
    items: visibleMentionItems,
    setMenu: setMentionMenu,
    setSelectedIndex: setSelectedMentionIndex,
  });

  useEffect(() => () => uploadAbortRef.current?.abort(), []);

  /** 上传失败时统一弹 toast（Milkdown 内部会静默吞掉 onUpload 的 reject） */
  const handleUpload = useCallback(
    async (file: File) => {
      uploadAbortRef.current?.abort();
      const controller = new AbortController();
      uploadAbortRef.current = controller;
      const isCurrent = () => uploadAbortRef.current === controller && !controller.signal.aborted;
      setUploadProgress({
        stage: "preparing",
        loadedBytes: null,
        totalBytes: null,
        percent: null,
      });
      try {
        const url = await onUploadImage!(file, {
          signal: controller.signal,
          onProgress: (progress) => { if (isCurrent()) setUploadProgress(progress); },
          onCompleted: (uploaded) => { if (isCurrent()) mediaDisplay.completed(uploaded); },
        });
        if (!isCurrent()) throw new DOMException("上传已取消", "AbortError");
        return url;
      } catch (error) {
        if (isCurrent() && !(error instanceof DOMException && error.name === "AbortError")) {
          toast.error(
            getApiErrorMessage(error, "上传失败，请稍后重试"),
          );
        }
        throw error;
      } finally {
        if (uploadAbortRef.current === controller) {
          uploadAbortRef.current = null;
          setUploadProgress(null);
        }
      }
    },
    [onUploadImage, mediaDisplay],
  );

  const handleOpenDice = useCallback((view: EditorView, menuAnchor?: DOMRect) => {
    if (disabled) return;
    let count = 0;
    view.state.doc.descendants((node) => {
      if (node.type.name === DICE_INLINE_NODE_NAME) count++;
    });
    setDiceNodeCount(count);
    diceSelectionRef.current = {
      from: view.state.selection.from,
      to: view.state.selection.to,
    };
    const host = hostRef.current;
    const topBar = host?.querySelector<HTMLElement>(".milkdown-top-bar");
    const directTrigger = host?.querySelector<HTMLElement>('[data-editor-tool="dice"]');
    if (!host || !topBar) return;
    setMoreMenuAnchor(null);
    setDicePopover(positionEditorPopover(
      menuAnchor ?? directTrigger?.getBoundingClientRect() ?? topBar.getBoundingClientRect(),
      320,
      390,
    ));
  }, [disabled]);

  const handleOpenMore = useCallback(() => {
    if (disabled) return;
    const trigger = hostRef.current?.querySelector<HTMLElement>('[data-editor-tool="more"]');
    if (!trigger) return;
    setDicePopover(null);
    setMoreMenuAnchor(trigger);
  }, [disabled]);

  const runMoreCommand = useCallback((capability: EditorCapabilityId) => {
    crepeRef.current?.editor.action((ctx) => {
      const commands = ctx.get(commandsCtx);
      switch (capability) {
        case "link":
          commands.call(toggleLinkCommand.key);
          break;
        case "inline-code":
          {
            const view = ctx.get(editorViewCtx);
            const { state } = view;
            if (state.selection.empty) {
              const markType = inlineCodeSchema.type(ctx);
              const marks = state.storedMarks ?? state.selection.$from.marks();
              const active = marks.some((mark) => mark.type === markType);
              view.dispatch(active
                ? state.tr.removeStoredMark(markType)
                : state.tr.addStoredMark(markType.create()));
            } else {
              commands.call(toggleInlineCodeCommand.key);
            }
          }
          break;
        case "quote":
          commands.call(wrapInBlockquoteCommand.key);
          break;
        case "bullet-list":
          commands.call(wrapInBulletListCommand.key);
          break;
        case "ordered-list":
          commands.call(wrapInOrderedListCommand.key);
          break;
        case "hr":
          commands.call(insertHrCommand.key);
          break;
        case "strikethrough":
          commands.call(toggleStrikethroughCommand.key);
          break;
        default:
          toolbarActionsRef.current.get(capability)?.(ctx);
          break;
      }
      const view = ctx.get(editorViewCtx);
      view.focus();
    });
    setMoreMenuAnchor(null);
  }, []);

  const moreMenuItems = useMemo<EditorMoreMenuItem[]>(() => {
    return (toolbarPreference ? customMore : defaultMore)
      .map((id) => ({
        id,
        label: id === "alignment" ? "段落对齐" : EDITOR_CAPABILITY_LABELS[id],
      }));
  }, [customMore, defaultMore, toolbarPreference]);

  const handleMoreSelect = useCallback((capability: EditorCapabilityId, anchor: DOMRect) => {
    if (capability === "sticker" || capability === "heading") {
      const trigger = hostRef.current?.querySelector<HTMLElement>('[data-editor-tool="more"]');
      setMoreMenuAnchor(null);
      if (trigger) {
        if (capability === "sticker") setStickerAnchor(trigger);
        else { captureColorSelection(); setHeadingMenuAnchor(trigger); }
      }
      return;
    }
    if (capability === "dice") {
      const view = crepeRef.current?.editor.action((ctx) => ctx.get(editorViewCtx));
      if (view) handleOpenDice(view, anchor);
      return;
    }
    if (capability === "audio") {
      setMoreMenuAnchor(null);
      audioActionRef.current();
      return;
    }
    if (capability === "draft") {
      setMoreMenuAnchor(null);
      onOpenDrafts?.();
      return;
    }
    runMoreCommand(capability);
  }, [captureColorSelection, handleOpenDice, onOpenDrafts, runMoreCommand]);

  const handleMoreAlignmentSelect = useCallback((alignment: Exclude<WenyouTextAlignment, "left">) => {
    crepeRef.current?.editor.action((ctx) =>
      toggleEditorAlignment(ctx, alignment, imageAlignmentEnabledRef.current),
    );
    setMoreMenuAnchor(null);
  }, []);

  const handleCloseMore = useCallback(() => {
    setMoreMenuAnchor(null);
    crepeRef.current?.editor.action((ctx) => ctx.get(editorViewCtx)).focus();
  }, []);

  const handleInsertDice = useCallback((notationInput: string) => {
    const error = getDiceNotationError(notationInput);
    if (error) {
      toast.error(error);
      return;
    }
    const view = crepeRef.current?.editor.action((ctx) => ctx.get(editorViewCtx));
    if (!view) return;
    let diceCount = 0;
    view.state.doc.descendants((node) => {
      if (node.type.name === DICE_INLINE_NODE_NAME) diceCount++;
    });
    if (diceCount >= MAX_DICE_ROLLS_PER_POST) {
      toast.error(`每个帖子最多可插入 ${MAX_DICE_ROLLS_PER_POST} 个骰子`);
      return;
    }
    const dice = createInlineDiceNode(notationInput);
    const nodeType = view.state.schema.nodes[DICE_INLINE_NODE_NAME];
    if (!dice || !nodeType) return;
    const range = diceSelectionRef.current ?? view.state.selection;
    const maxPosition = view.state.doc.content.size;
    const from = Math.max(0, Math.min(range.from, maxPosition));
    const to = Math.max(from, Math.min(range.to, maxPosition));
    const node = nodeType.create(dice);
    const transaction = view.state.tr.replaceRangeWith(from, to, node);
    transaction.setSelection(TextSelection.near(transaction.doc.resolve(from + node.nodeSize)));
    view.dispatch(transaction);
    view.focus();
    setDiceNodeCount(diceCount + 1);
    diceSelectionRef.current = null;
    setDicePopover(null);
  }, []);

  const handleInsertSticker = useCallback((sticker: { asset: { id: string; url: string; display?: MediaDisplay | null } }) => {
    if (disabled) return;
    const view = crepeRef.current?.editor.action((ctx) => ctx.get(editorViewCtx));
    if (!view) return;
    let count = 0;
    view.state.doc.descendants((node) => {
      if (node.type.name === STICKER_INLINE_NODE_NAME) count++;
    });
    if (count >= MAX_STICKERS_PER_POST) {
      throw new Error(`每个帖子最多包含 ${MAX_STICKERS_PER_POST} 个表情`);
    }
    const nodeType = view.state.schema.nodes[STICKER_INLINE_NODE_NAME];
    if (!nodeType) throw new Error("编辑器表情节点尚未就绪");
    mediaDisplay.completed(sticker.asset);
    const node = nodeType.create({
      assetId: sticker.asset.id,
      src: sticker.asset.url,
      alt: "表情",
    });
    const transaction = view.state.tr.replaceSelectionWith(node);
    transaction.setSelection(TextSelection.near(transaction.doc.resolve(transaction.selection.to)));
    view.dispatch(transaction);
    view.focus();
  }, [disabled, mediaDisplay]);

  useEditor(
    (root) => {
      if (!capabilityReady) return undefined;
      const crepe = new CrepeBuilder({
        root,
        defaultValue: prepareEditorMarkdown(initialValue, { markdownContractVersion }),
      });

      // Markdown 定界符永远按字面输入；仅保留与工具栏白名单一致的显式快捷键。
      void crepe.editor.remove([
        wrapInBlockquoteInputRule,
        wrapInBulletListInputRule,
        wrapInOrderedListInputRule,
        wrapInHeadingInputRule,
        createCodeBlockInputRule,
        insertHrInputRule,
        emphasisStarInputRule,
        emphasisUnderscoreInputRule,
        inlineCodeInputRule,
        insertImageInputRule,
        strongInputRule,
        strikethroughInputRule,
        wrapInTaskListInputRule,
        insertTableInputRule,
        ...headingKeymap,
        ...codeBlockKeymap,
        ...tableKeymap,
      ]);
      crepe.editor.use(toolbarHeadingKeymap);
      crepe.editor.use(editorInlineCodeCommand);
      crepe.editor.use(editorBoundaryTextSchema);

      // 只装载当前顶部工具栏实际依赖的交互特性；表格、代码编辑器、公式、AI、
      // 块菜单和选择气泡工具栏均不进入客户端包。
      crepe
        // 正文自身是滚动容器；Crepe 虚拟光标会把滚动偏移同时计入坐标和元素滚动，导致错位。
        .addFeature(cursor, { virtual: false })
        .addFeature(listItem)
        .addFeature(linkTooltip, { inputPlaceholder: "粘贴链接…" })
        .addFeature(placeholderFeature, { text: placeholder ?? "开始输入…" });

      if (onUploadImage) {
        crepe.addFeature(imageBlock, getImageBlockConfig(handleUpload, mediaDisplay.resolve));
      }

      crepe.addFeature(topBar, {
        headingOptions: CN_HEADING_OPTIONS,
        boldIcon: editorIconSvg("bold"),
        italicIcon: editorIconSvg("italic"),
        strikethroughIcon: editorIconSvg("strikethrough"),
        codeIcon: editorIconSvg("inline-code"),
        linkIcon: editorIconSvg("link"),
        imageIcon: editorIconSvg("image"),
        quoteIcon: editorIconSvg("quote"),
        hrIcon: editorIconSvg("hr"),
        chevronDownIcon: editorChevronDownSvg(),
        buildTopBar: (builder) => {
          const formatting = builder.getGroup("formatting").group;
          formatting.items = formatting.items.filter((item) =>
            ["bold", "italic", "strikethrough", "code"].includes(item.key),
          );
          const insert = builder.getGroup("insert").group;
          const imageItem = insert.items.find((item) => item.key === "image");
          const block = builder.getGroup("block").group;
          block.items = [];
          const more = builder.getGroup("more").group;
          more.items = more.items.filter((item) => ["quote", "hr"].includes(item.key));

          const headingSelector = builder.getGroup("heading").group.items
            .find((item) => item.key === "heading-selector");
          headingSelector?.selector?.options.forEach((option) => {
            const configured = CN_HEADING_OPTIONS.find((item) => item.label === option.label);
            if (!configured) return;
            option.onSelect = (ctx) => {
              if (setSelectedEditorHeading(ctx, configured.level)) return;
              ctx.get(commandsCtx).call(wrapInHeadingCommand.key, configured.level ?? 0);
            };
          });

          const alignmentControls = builder.addGroup("alignment", "对齐");
          for (const alignment of ["center", "right"] as const) {
            alignmentControls.addItem(`align-${alignment}`, {
              icon: editorAlignmentIconSvg(alignment),
              active: (ctx) => getSelectedTextAlignment(
                ctx.get(editorViewCtx).state,
                imageAlignmentEnabledRef.current,
              ) === alignment,
              onRun: (ctx) => toggleEditorAlignment(ctx, alignment, imageAlignmentEnabledRef.current),
            });
          }

          const groups = builder.build();
          const alignmentIndex = groups.findIndex((group) => group.key === "alignment");
          const alignmentGroup = alignmentIndex === -1
            ? undefined
            : groups.splice(alignmentIndex, 1)[0];
          const insertGroupIndex = groups.findIndex((group) => group.key === "insert");
          if (alignmentGroup) {
            groups.splice(
              insertGroupIndex === -1 ? groups.length : insertGroupIndex,
              0,
              alignmentGroup,
            );
          }
          for (const groupKey of ["block", "list"]) {
            const index = groups.findIndex((group) => group.key === groupKey);
            if (index !== -1) groups.splice(index, 1);
          }
          if (insert.items.length === 0) {
            const insertIndex = groups.findIndex((group) => group.key === "insert");
            if (insertIndex !== -1) groups.splice(insertIndex, 1);
          }

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
                    view.dispatch(view.state.tr.replaceSelectionWith(node));
                    view.focus();
                  })
                  .catch(() => {});
              };
              input.click();
            };
          }
          builder.addGroup("dice", "骰子").addItem("dice", {
            icon: editorIconSvg("dice"),
            active: () => false,
            onRun: (ctx) => handleOpenDice(ctx.get(editorViewCtx)),
          });
          if (onOpenDrafts) {
            builder.addGroup("draft", "草稿").addItem("draft", {
              icon: editorIconSvg("draft"),
              active: () => false,
              onRun: () => onOpenDrafts(),
            });
          }
          builder.addGroup("sticker", "表情").addItem("sticker", {
            icon: editorIconSvg("sticker"),
            active: () => false,
            onRun: () => {
              const trigger = hostRef.current?.querySelector<HTMLElement>('[data-editor-tool="sticker"]');
              if (trigger) setStickerAnchor(trigger);
            },
          });
          builder.addGroup("audio", "音频").addItem("audio", {
            icon: editorIconSvg("audio"), active: () => false, onRun: () => audioActionRef.current(),
          });
          builder.addGroup("more-menu", "更多").addItem("more", {
            icon: editorIconSvg("more"),
            active: () => false,
            onRun: handleOpenMore,
          });
          toolbarActionsRef.current = new Map(builder.build().flatMap((group) =>
            group.items.filter((item) => item.onRun).map((item) => [item.key === "code" ? "inline-code" : item.key, item.onRun!] as const),
          ));
          toolbarItemsRef.current = builder.build().flatMap((group) =>
            group.items
              .filter((item) => item.key !== "heading-selector")
              .map((item) => {
                const key = item.key === "code" ? "inline-code" : item.key;
                return {
                  key,
                  label: key === "align-center" || key === "align-right"
                    ? alignmentLabel(key === "align-center" ? "center" : "right")
                    : EDITOR_CAPABILITY_LABELS[
                      key as keyof typeof EDITOR_CAPABILITY_LABELS
                    ] ?? item.key,
                };
              }),
          );
        },
      });

      crepe.editor.use(mediaDisplay.plugin);
      crepe.editor.use(audioView.api.plugin);
      crepe.editor.use(audioUpload.anchor.plugin);
      const dicePlugins = createDiceInlineEditorPlugins(diceRolls);
      const stickerPlugins = createStickerInlineEditorPlugins();
      const alignmentPlugin = createEditorAlignmentPlugin(
        setCurrentAlignment,
        () => imageAlignmentEnabledRef.current,
      );
      let codecErrorShown = false;
      const markdownBridge = createEditorMarkdownBridge({
        onDocumentChange: () => documentCallbacksRef.current.onDocumentChange?.(),
        onCompositionChange: (composing) => {
          composingRef.current = composing;
          documentCallbacksRef.current.onCompositionChange?.(composing);
        },
        onSyncErrorChange: (hasError) => {
          if (!hasError) codecErrorShown = false;
          onSyncErrorChangeRef.current?.(hasError);
        },
        markdownContractVersion,
        textColorVersion,
        textFontVersion,
        onReady: (flush) => { flushRef.current = flush; },
        onValid: () => onValidityRef.current?.(true),
        onChange: (markdown) => {
          codecErrorShown = false;
          onChangeRef.current?.(markdown);
        },
        onError: (error) => {
          onValidityRef.current?.(false);
          // 诊断只记录类型，不输出正文、URL 或节点身份。
          console.error("Editor markdown synchronization failed", error instanceof Error ? error.name : "UnknownError");
          if (codecErrorShown) return;
          codecErrorShown = true;
          toast.error("正文格式同步失败，请撤销刚才的操作后重试");
        },
      });
      crepe.editor
        .config((ctx) => configureEditorAlignmentParser(ctx, { markdownContractVersion }))
        .config((ctx) => configureEditorAlignmentSchemas(ctx, { markdownContractVersion }))
        .config(configureEditorMarkdownSerializer)
        .config(ctx => configureEditorTextFontRendering(ctx, textFontRenderingEnabled))

        .use(internalReferenceLinkView)
        .use(editorMentionCaretPlugin)
        .use(editorTextFontSchema)
        .use(editorTextFontAtomicPolicy)
        .use(editorTextFontTyping)
        .use(editorTextColorSchema)
        .use(editorTextColorAtomicPolicy)
        .use(editorTextColorTyping)
        .use(createEditorMarkdownPastePlugin({ allowTextFont: textFontRenderingEnabled }))
        .use(alignmentPlugin)
        .use(editorAttentionBoundaryParser)
        .use(editorSoftBreakParser)
        .use(dicePlugins.remarkDiceInline)
        .use(dicePlugins.diceInlineSchema)
        .use(dicePlugins.clonePastedDice)
        .use(stickerPlugins.remarkStickerInline)
        .use(stickerPlugins.stickerInlineSchema)
        .use(markdownBridge);

      // 初始 disabled effect 会早于异步编辑器 ref；创建前先写入初始只读值。
      crepe.setReadonly(disabled ?? false);
      crepeRef.current = crepe;

      return crepe;
    },
    [capabilityReady, markdownContractVersion, textColorVersion, textFontVersion, textFontRenderingEnabled],
  );

  useEffect(() => {
    const readonly = disabled ?? false;
    crepeRef.current?.setReadonly(readonly);
    const frame = window.requestAnimationFrame(() => {
      if (hostRef.current) {
        syncMilkdownToolbarVisibility(hostRef.current, readonly);
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [disabled]);

  useEffect(() => {
    if (!dicePopover) return;
    const close = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (
        target?.closest("[data-dice-popover]") ||
        target?.closest('[data-editor-tool="dice"]')
      ) {
        return;
      }
      setDicePopover(null);
      diceSelectionRef.current = null;
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setDicePopover(null);
      diceSelectionRef.current = null;
      crepeRef.current?.editor.action((ctx) => ctx.get(editorViewCtx)).focus();
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [dicePopover]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let layoutFrame: number | null = null;
    let resizeObserver: ResizeObserver | null = null;

    const openHeadingMenu = (event: Event) => {
      const target = event.target instanceof Element ? event.target : null;
      const trigger = target?.closest<HTMLButtonElement>(".top-bar-heading-button");
      if (!trigger || disabled) return;
      // 候选字尚未提交时不抢焦点，避免强制结束原生输入法组合。
      if (composingRef.current) { event.preventDefault(); event.stopPropagation(); return; }
      if (event instanceof PointerEvent && event.button !== 0) {
        event.stopPropagation();
        return;
      }
      // Crepe 在 pointerdown 中展开 DOM 内菜单；统一交给现有锚点弹层，正文选区仍由编辑器保存。
      event.preventDefault();
      event.stopPropagation();
      captureColorSelection();
      if (event.type !== "pointerdown") setHeadingMenuAnchor((current) => current === trigger ? null : trigger);
    };
    const onHeadingKeyDown = (event: KeyboardEvent) => {
      if (!["Enter", " ", "ArrowDown"].includes(event.key)) return;
      openHeadingMenu(event);
    };
    const scheduleToolbarLayout = () => {
      if (layoutFrame !== null) return;
      layoutFrame = window.requestAnimationFrame(() => {
        layoutFrame = null;
        const topBar = host.querySelector<HTMLElement>(".milkdown-top-bar");
        if (!topBar) return;
        if (toolbarPreference) {
          const available = new Set(EDITOR_TOOLBAR_TOOLS.filter((id) =>
            (id !== "alignment" || alignmentEnabled)
            && (id !== "draft" || Boolean(onOpenDrafts))
            && (id !== "image" || Boolean(onUploadImage))
            && (id !== "audio" || audioUpload.available)));
          const next = fitCustomMilkdownToolbar(topBar, toolbarPreference, available);
          setCustomMore((previous) => previous.join() === next.join() ? previous : next);
        } else {
          const next = fitDefaultMilkdownToolbar(topBar, Boolean(onOpenDrafts), alignmentEnabled, audioUpload.available);
          setDefaultMore((previous) => previous.join() === next.join() ? previous : next);
        }
        if (topBar.querySelector<HTMLElement>('[data-editor-tool="more"]')?.hidden) setMoreMenuAnchor(null);
      });
    };
    const syncEditorSemantics = () => {
      host.querySelector<HTMLElement>(".ProseMirror")?.setAttribute("aria-label", ariaLabel);
    };
    const syncTopBar = () => {
      syncEditorSemantics();
      syncMilkdownToolbarItems(host, toolbarItemsRef.current);
      syncAlignmentToolbarState(host, currentAlignment);
      syncMilkdownHeadingOptions(host, CREATABLE_HEADING_LABELS);
      if (toolbarPreference) host.querySelectorAll<HTMLButtonElement>(".top-bar-heading-option:not([hidden])").forEach((button) => { button.tabIndex = 0; });
      syncMilkdownToolbarVisibility(host, disabled ?? false);
      syncMilkdownToolbarSemantics(host);
      scheduleToolbarLayout();
    };

    const observer = new MutationObserver((records) => {
      // 正文增删节点不改变工具栏宽度，避免每次按键都切换密度并强制布局。
      const onlyContentChanged = records.every((record) => {
        const target = record.target instanceof Element ? record.target : record.target.parentElement;
        return target?.closest(".ProseMirror");
      });
      if (!onlyContentChanged) syncTopBar();
    });
    observer.observe(host, { childList: true, subtree: true });
    host.addEventListener("pointerdown", openHeadingMenu, true);
    host.addEventListener("click", openHeadingMenu, true);
    host.addEventListener("keydown", onHeadingKeyDown, true);
    host.addEventListener("keydown", handleCustomToolbarKeyDown);
    syncEditorSemantics();
    window.addEventListener("resize", scheduleToolbarLayout);

    const topBar = host.querySelector<HTMLElement>(".milkdown-top-bar");
    if (topBar) {
      syncTopBar();
      if (typeof ResizeObserver !== "undefined") {
        resizeObserver = new ResizeObserver(scheduleToolbarLayout);
        resizeObserver.observe(topBar);
      }
    }

    let attempts = 0;
    const maxAttempts = 50;
    const interval = setInterval(() => {
      attempts++;
      const tb = host.querySelector(".milkdown-top-bar");
      if (tb) {
        syncTopBar();
        if (!resizeObserver && typeof ResizeObserver !== "undefined") {
          resizeObserver = new ResizeObserver(scheduleToolbarLayout);
          resizeObserver.observe(tb);
        }
        clearInterval(interval);
        return;
      }
      if (attempts >= maxAttempts) {
        clearInterval(interval);
      }
    }, 100);

    return () => {
      clearInterval(interval);
      observer.disconnect();
      host.removeEventListener("pointerdown", openHeadingMenu, true);
      host.removeEventListener("click", openHeadingMenu, true);
      host.removeEventListener("keydown", onHeadingKeyDown, true);
      host.removeEventListener("keydown", handleCustomToolbarKeyDown);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", scheduleToolbarLayout);
      if (layoutFrame !== null) window.cancelAnimationFrame(layoutFrame);
    };
  }, [alignmentEnabled, ariaLabel, audioUpload.available, captureColorSelection, currentAlignment, disabled, onOpenDrafts, onUploadImage, toolbarPreference]);

  useEffect(() => {
    if (hostRef.current) {
      syncMilkdownMoreMenuState(hostRef.current, moreMenuAnchor !== null);
    }
  }, [moreMenuAnchor]);

  return (
    <>
      <div ref={hostRef} className="milkdown-editor relative">
        <Milkdown />
        {audioUpload.placeholder}
        {audioView.portals}
        {uploadProgress ? (
          <ImageUploadProgress
            progress={uploadProgress}
            onCancel={() => uploadAbortRef.current?.abort()}
            className="absolute right-3 top-12 z-[var(--layer-popup)] w-[min(22rem,calc(100%-1.5rem))] bg-background/95 shadow-popover backdrop-blur"
          />
        ) : null}
        {loading && (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <WenyouIcon id="status.loading" className="mr-2 h-5 w-5 animate-spin" />
            编辑器加载中…
          </div>
        )}
        <DiceInsertPopover
          position={dicePopover}
          count={diceNodeCount}
          maxCount={MAX_DICE_ROLLS_PER_POST}
          input={diceInput}
          onInputChange={setDiceInput}
          onInsert={handleInsertDice}
        />
        <EditorMoreMenu
          keyboardAccessible={Boolean(toolbarPreference) || audioUpload.available}
          anchor={moreMenuAnchor}
          items={moreMenuItems}
          alignment={currentAlignment}
          onSelect={handleMoreSelect}
          onSelectAlignment={handleMoreAlignmentSelect}
          onClose={handleCloseMore}
        />
        <MentionCandidateMenu
          position={mentionMenu}
          items={visibleMentionItems}
          activeIndex={activeMentionIndex}
          pending={mentionQueryPending || isMentionFetching}
          error={isMentionError}
          userMentionsUnavailable={userMentionsUnavailable}
          onRetry={() => void refetchMentionCandidates()}
          onSelect={handleMentionSelect}
        />
      </div>
      <EditorHeadingMenu
        key={(headingMenuAnchor ? "open" : "closed") + String(textColorWriteEnabled) + String(textFontWriteEnabled)}
        anchor={headingMenuAnchor}
        level={headingLevel}
        fontControls={textFontRenderingEnabled && (textFontVersion === 1 || textFontVersion === 2) ? {
          enabled: fontSelection.enabled && !disabled && !composingRef.current,
          value: fontSelection.fontId,
          accountId: textColorAccountId,
          options: textFontVersion === 2 ? (textFontWriteEnabled ? dynamicCatalog.data?.items.map(item=>({value:item.versionId,label:item.name,group:textFontGroup(item.designLanguage)})) ?? [] : []) : textFontWriteEnabled && fontCatalog.data?.manifest && validatedFontBase(fontCatalog.data.assetBaseUrl) ? textFontOptions(fontCatalog.data.fonts) : [],
          loading: textFontWriteEnabled && (textFontVersion === 2 ? dynamicCatalog.isLoading : fontCatalog.isLoading),
          error: (textFontVersion === 2 ? dynamicCatalog.isError && !dynamicCatalog.data : fontCatalog.isError) ? "字体列表加载失败" : undefined,
          onRetry: () => { void (textFontVersion === 2 ? dynamicCatalog.refetch() : fontCatalog.refetch()); },
          onOpen: () => { if(textFontVersion === 2)void dynamicCatalog.refetch(); },
          previewMode: textFontVersion === 2 ? "automatic" : "on-demand",
          renderThumbnail: textFontVersion === 2 ? font=><DynamicFontSpecimen versionId={font.value} compact/> : undefined,
          onApply: (fontId) => {
            if (disabled || composingRef.current) return false;
            if(fontId !== null) {
              if(!textFontWriteEnabled)return false;
              if(textFontVersion === 2){const item=dynamicCatalog.data?.items.find(item=>item.versionId===fontId);if(!item)return false;rememberDynamicFont({...item,revision:dynamicCatalog.data!.revision,status:"published"});}
              else if(!fontCatalog.data?.manifest||!validatedFontBase(fontCatalog.data.assetBaseUrl)||!fontCatalog.data.fonts.some(font=>font.id===fontId&&font.availability==="ready"))return false;
            }
            fontDownloadRef.current?.start(textFontVersion === 2 ? fontId : null, dynamicCatalog.data?.items.find(item => item.versionId === fontId)?.name);
            const applied = crepeRef.current?.editor.action((ctx) => applyEditorTextFont(ctx.get(editorViewCtx), fontId, colorSelectionRef.current ?? undefined)) ?? false;
            if (applied) setHeadingMenuAnchor(null);
            else fontDownloadRef.current?.start(null);
            return applied;
          },
          onCancel: () => { restoreColorSelection(); setHeadingMenuAnchor(null); },
          renderPreview: (font) => textFontVersion === 2 ? <DynamicFontSpecimen versionId={font.value}/> : <EditorFontPreview fontId={font.value} designLanguage={fontCatalog.data?.fonts.find(entry => entry.id === font.value)?.designLanguage} />,
        } : undefined}
        colorControls={textColorWriteEnabled && textColorVersion === 1 ? {
          ...colorSelection,
          enabled: colorSelection.enabled && !disabled && !composingRef.current,
          accountId: textColorAccountId,
          onApply: (color) => {
            if (!textColorWriteEnabled || disabled || composingRef.current) return false;
            const applied = crepeRef.current?.editor.action((ctx) =>
              applyEditorTextColor(ctx.get(editorViewCtx), color, colorSelectionRef.current ?? undefined)) ?? false;
            setHeadingMenuAnchor(null);
            return applied;
          },
          onCancel: () => { restoreColorSelection(); setHeadingMenuAnchor(null); },
        } : undefined}
        onClose={() => setHeadingMenuAnchor(null)}
        onSelect={(level) => {
        crepeRef.current?.editor.action((ctx) => {
          if (!setSelectedEditorHeading(ctx, level || null)) ctx.get(commandsCtx).call(wrapInHeadingCommand.key, level);
          ctx.get(editorViewCtx).focus();
        });
        setHeadingMenuAnchor(null);
      }} />
      {!loading ? <StickerPickerPopover externalAnchor={stickerAnchor} onExternalClose={() => setStickerAnchor(null)} onSelect={handleInsertSticker} disabled={disabled} align="end" /> : null}
      <EditorFontDownloadProgress ref={fontDownloadRef} scope={fontDemandScope.current} />
      <div
        data-slot="milkdown-editor-footer"
        className="flex items-center justify-between gap-3 border-t border-border px-3 py-2"
      >
        <div data-slot="milkdown-editor-context-actions" className="flex min-w-0 items-center">
          {!loading && !toolbarPreference ? (
            <StickerPickerPopover
              disabled={disabled}
              label="表情"
              onSelect={handleInsertSticker}
            />
          ) : null}
        </div>
        <div data-slot="milkdown-editor-footer-status" />
      </div>
    </>
  );
});

/** Milkdown 编辑器核心：仅由轻量动态入口加载。 */

"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
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
  fitMilkdownToolbar,
  getMilkdownMoreCapabilities,
  positionMilkdownHeadingDropdowns,
  syncMilkdownHeadingOptions,
  syncMilkdownMoreMenuState,
  syncMilkdownToolbarSemantics,
  syncMilkdownToolbarItems,
  syncMilkdownToolbarVisibility,
  type MilkdownToolbarDensity,
  type MilkdownToolbarItemMetadata,
} from "@/lib/milkdown-toolbar";
import { getApiErrorMessage } from "@/api/errors";
import { useApiMeta } from "@/api/hooks/use-api-meta";
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
import { editorMarkdownPastePlugin } from "@/components/editor/markdown-literal-paste";
import {
  configureEditorMarkdownSerializer,
  createEditorMarkdownBridge,
  editorAttentionBoundaryParser,
  editorSoftBreakParser,
  prepareEditorMarkdown,
} from "@/components/editor/milkdown-markdown-codec";
import { createEditorLinkMarkView } from "@/components/shared/internal-reference-editor-dom";
import {
  createEditorAlignmentPlugin,
  configureEditorAlignmentParser,
  configureEditorAlignmentSchemas,
  cycleEditorAlignment,
  getSelectedTextAlignment,
  setEditorAlignment,
  setSelectedEditorHeading,
} from "@/components/editor/editor-alignment";
import {
  alignmentLabel,
  type WenyouTextAlignment,
} from "@/lib/markdown-alignment";
import "@/components/editor/milkdown-editor.css";

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
  const icon = editorAlignmentIconSvg(alignment);
  const label = `${alignmentLabel(alignment)}，点击切换`;
  root.querySelectorAll<HTMLButtonElement>('[data-editor-tool="alignment"]')
    .forEach((button) => {
      button.title = label;
      button.setAttribute("aria-label", label);
      const previousAlignment = button.dataset.editorAlignment;
      button.dataset.editorAlignment = alignment;
      if (previousAlignment !== alignment) button.innerHTML = icon;
    });
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

function getImageBlockConfig(onUploadImage: (file: File) => Promise<string>) {
  return {
    onUpload: onUploadImage,
    inlineUploadButton: "上传",
    inlineUploadPlaceholderText: "仅支持上传文件",
    blockUploadButton: "上传文件",
    blockConfirmButton: "确认",
    blockCaptionPlaceholderText: "输入图片说明",
    blockUploadPlaceholderText: "仅支持上传文件",
  };
}

export interface MilkdownEditorHostProps {
  initialValue: string;
  onChange?: (value: string) => void;
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
  footerStatus: ReactNode;
}

/** Crepe 编辑器宿主：以 initialValue 初始化；被外层按 key 重挂载以回填恢复的正文草稿 */
export function MilkdownEditorHost({
  initialValue,
  onChange,
  onUploadImage,
  placeholder,
  disabled,
  onOpenDrafts,
  threadId,
  diceRolls = [],
  autoFocus = false,
  ariaLabel,
  footerStatus,
}: MilkdownEditorHostProps) {
  const [loading] = useInstance();
  const { data: apiMeta } = useApiMeta();
  const alignmentEnabled = (apiMeta?.markdownContractVersion ?? 0) >= 4;
  const crepeRef = useRef<CrepeBuilder | null>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  const toolbarItemsRef = useRef<MilkdownToolbarItemMetadata[]>([]);
  const uploadAbortRef = useRef<AbortController | null>(null);
  const diceSelectionRef = useRef<{ from: number; to: number } | null>(null);
  const [dicePopover, setDicePopover] = useState<{ top: number; left: number } | null>(null);
  const [moreMenuAnchor, setMoreMenuAnchor] = useState<HTMLElement | null>(null);
  const [toolbarDensity, setToolbarDensity] = useState<MilkdownToolbarDensity>("expanded");
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
      items.push({
        id: candidate.id,
        label: `@${candidate.username}`,
        username: candidate.username,
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
      setUploadProgress({
        stage: "preparing",
        loadedBytes: null,
        totalBytes: null,
        percent: null,
      });
      try {
        return await onUploadImage!(file, {
          signal: controller.signal,
          onProgress: setUploadProgress,
        });
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
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
    [onUploadImage],
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
        case "alignment":
          cycleEditorAlignment(ctx);
          break;
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
          return;
      }
      const view = ctx.get(editorViewCtx);
      view.focus();
    });
    setMoreMenuAnchor(null);
  }, []);

  const moreMenuItems = useMemo<EditorMoreMenuItem[]>(() => {
    return getMilkdownMoreCapabilities(
      toolbarDensity,
      Boolean(onOpenDrafts),
      alignmentEnabled,
    )
      .map((id) => ({
        id,
        label: id === "alignment" ? "段落对齐" : EDITOR_CAPABILITY_LABELS[id],
      }));
  }, [alignmentEnabled, onOpenDrafts, toolbarDensity]);

  const handleMoreSelect = useCallback((capability: EditorCapabilityId, anchor: DOMRect) => {
    if (capability === "dice") {
      const view = crepeRef.current?.editor.action((ctx) => ctx.get(editorViewCtx));
      if (view) handleOpenDice(view, anchor);
      return;
    }
    if (capability === "draft") {
      setMoreMenuAnchor(null);
      onOpenDrafts?.();
      return;
    }
    runMoreCommand(capability);
  }, [handleOpenDice, onOpenDrafts, runMoreCommand]);

  const handleMoreAlignmentSelect = useCallback((alignment: WenyouTextAlignment) => {
    crepeRef.current?.editor.action((ctx) => setEditorAlignment(ctx, alignment));
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

  const handleInsertSticker = useCallback((sticker: { asset: { id: string; url: string } }) => {
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
    const node = nodeType.create({
      assetId: sticker.asset.id,
      src: sticker.asset.url,
      alt: "表情",
    });
    const transaction = view.state.tr.replaceSelectionWith(node);
    transaction.setSelection(TextSelection.near(transaction.doc.resolve(transaction.selection.to)));
    view.dispatch(transaction);
    view.focus();
  }, [disabled]);

  useEditor(
    (root) => {
      const crepe = new CrepeBuilder({
        root,
        defaultValue: prepareEditorMarkdown(initialValue),
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

      // 只装载当前顶部工具栏实际依赖的交互特性；表格、代码编辑器、公式、AI、
      // 块菜单和选择气泡工具栏均不进入客户端包。
      crepe
        // 正文自身是滚动容器；Crepe 虚拟光标会把滚动偏移同时计入坐标和元素滚动，导致错位。
        .addFeature(cursor, { virtual: false })
        .addFeature(listItem)
        .addFeature(linkTooltip, { inputPlaceholder: "粘贴链接…" })
        .addFeature(placeholderFeature, { text: placeholder ?? "开始输入…" });

      if (onUploadImage) {
        crepe.addFeature(imageBlock, getImageBlockConfig(handleUpload));
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
        bulletListIcon: editorIconSvg("bullet-list"),
        orderedListIcon: editorIconSvg("ordered-list"),
        chevronDownIcon: editorChevronDownSvg(),
        buildTopBar: (builder) => {
          const formatting = builder.getGroup("formatting").group;
          formatting.items = formatting.items.filter((item) =>
            ["bold", "italic", "strikethrough", "code"].includes(item.key),
          );
          const list = builder.getGroup("list").group;
          list.items = list.items.filter((item) => item.key !== "task-list");
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

          builder.addGroup("alignment", "对齐").addItem("alignment", {
            icon: editorAlignmentIconSvg("left"),
            active: (ctx) => getSelectedTextAlignment(
              ctx.get(editorViewCtx).state,
            ) !== "left",
            onRun: cycleEditorAlignment,
          });

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
          for (const groupKey of ["block"]) {
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
          builder.addGroup("more-menu", "更多").addItem("more", {
            icon: editorIconSvg("more"),
            active: () => false,
            onRun: handleOpenMore,
          });
          toolbarItemsRef.current = builder.build().flatMap((group) =>
            group.items
              .filter((item) => item.key !== "heading-selector")
              .map((item) => {
                const key = item.key === "code" ? "inline-code" : item.key;
                return {
                  key,
                  label:
                    EDITOR_CAPABILITY_LABELS[
                      key as keyof typeof EDITOR_CAPABILITY_LABELS
                    ] ?? item.key,
                };
              }),
          );
        },
      });

      const dicePlugins = createDiceInlineEditorPlugins(diceRolls);
      const stickerPlugins = createStickerInlineEditorPlugins();
      const alignmentPlugin = createEditorAlignmentPlugin(setCurrentAlignment);
      let codecErrorShown = false;
      const markdownBridge = createEditorMarkdownBridge({
        onChange: (markdown) => {
          codecErrorShown = false;
          onChangeRef.current?.(markdown);
        },
        onError: (error) => {
          console.error(error);
          if (codecErrorShown) return;
          codecErrorShown = true;
          toast.error("正文格式同步失败，请撤销刚才的操作后重试");
        },
      });
      crepe.editor
        .config(configureEditorAlignmentParser)
        .config(configureEditorAlignmentSchemas)
        .config(configureEditorMarkdownSerializer)
        .use(internalReferenceLinkView)
        .use(editorMarkdownPastePlugin)
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
    [],
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
    let positionFrame: number | null = null;
    let layoutFrame: number | null = null;
    let resizeObserver: ResizeObserver | null = null;

    const scheduleDropdownPosition = () => {
      if (positionFrame !== null) return;
      positionFrame = window.requestAnimationFrame(() => {
        positionFrame = null;
        positionMilkdownHeadingDropdowns(host);
      });
    };
    const scheduleToolbarLayout = () => {
      if (layoutFrame !== null) return;
      layoutFrame = window.requestAnimationFrame(() => {
        layoutFrame = null;
        const topBar = host.querySelector<HTMLElement>(".milkdown-top-bar");
        if (!topBar) return;
        setToolbarDensity(fitMilkdownToolbar(topBar, alignmentEnabled));
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
      syncMilkdownToolbarVisibility(host, disabled ?? false);
      syncMilkdownToolbarSemantics(host);
      scheduleDropdownPosition();
      scheduleToolbarLayout();
    };

    const observer = new MutationObserver(syncTopBar);
    observer.observe(host, { childList: true, subtree: true });
    syncEditorSemantics();
    window.addEventListener("resize", scheduleToolbarLayout);
    window.addEventListener("resize", scheduleDropdownPosition);
    window.addEventListener("scroll", scheduleDropdownPosition, true);

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
      resizeObserver?.disconnect();
      window.removeEventListener("resize", scheduleToolbarLayout);
      window.removeEventListener("resize", scheduleDropdownPosition);
      window.removeEventListener("scroll", scheduleDropdownPosition, true);
      if (positionFrame !== null) window.cancelAnimationFrame(positionFrame);
      if (layoutFrame !== null) window.cancelAnimationFrame(layoutFrame);
    };
  }, [alignmentEnabled, ariaLabel, currentAlignment, disabled]);

  useEffect(() => {
    if (hostRef.current) {
      syncMilkdownMoreMenuState(hostRef.current, moreMenuAnchor !== null);
    }
  }, [moreMenuAnchor]);

  return (
    <>
      <div ref={hostRef} className="milkdown-editor relative">
        <Milkdown />
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
          onRetry={() => void refetchMentionCandidates()}
          onSelect={handleMentionSelect}
        />
      </div>
      <div
        data-slot="milkdown-editor-footer"
        className="flex items-center justify-between gap-3 border-t border-border px-3 py-2"
      >
        <div data-slot="milkdown-editor-context-actions" className="flex min-w-0 items-center">
          {!loading ? (
            <StickerPickerPopover
              disabled={disabled}
              label="表情"
              onSelect={handleInsertSticker}
            />
          ) : null}
        </div>
        {footerStatus}
      </div>
    </>
  );
}

/** Milkdown 编辑器核心：仅由轻量动态入口加载。 */

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Milkdown, MilkdownProvider, useEditor, useInstance } from "@milkdown/react";
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
  inlineCodeSchema,
  insertHrCommand,
  toggleInlineCodeCommand,
  wrapInBlockquoteCommand,
  wrapInBulletListCommand,
  wrapInOrderedListCommand,
} from "@milkdown/kit/preset/commonmark";
import { toggleStrikethroughCommand } from "@milkdown/kit/preset/gfm";
import { TextSelection } from "@milkdown/kit/prose/state";
import type { EditorView } from "@milkdown/kit/prose/view";
import { Loader2 } from "lucide-react";
import { useDebounce } from "use-debounce";
import { toast } from "sonner";
import { ImageUploadProgress } from "@/components/shared/image-upload-progress";
import { cn } from "@/lib/utils";
import { sanitizeMilkdownMarkdown } from "@/lib/markdown";
import type {
  UploadImageOptions,
  UploadImageProgress as UploadImageProgressValue,
} from "@/lib/upload-image";
import {
  createInlineDiceNode,
  DICE_INLINE_NODE_NAME,
  parseInlineDiceNodes,
  restoreSerializedInlineDiceNodes,
  type InlineDiceRoll,
} from "@/lib/dice-inline";
import { getDiceNotationError, MAX_DICE_ROLLS_PER_POST } from "@/lib/dice";
import {
  fitMilkdownToolbar,
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
import { useMentionCandidates } from "@/api/hooks/use-mention-candidates";
import {
  ContentDraftsPanel,
} from "@/components/editor/content-drafts-panel";
import { useEditorDraftController } from "@/components/editor/use-editor-draft-controller";
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
import "@/components/editor/milkdown-editor.css";

const MAX_CHARS = 10000;
const QUICK_DICE_SIDES = [4, 6, 8, 10, 12, 20, 100];

const DRAFT_ICON = `
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="currentColor" d="M5 3h11l3 3v15H5V3Zm2 2v14h10V7.5L14.5 5H7Zm2 4h6v2H9V9Zm0 4h6v2H9v-2Z" />
  </svg>
`;

const DICE_ICON = `
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="4" fill="none" stroke="currentColor" stroke-width="2" />
    <circle cx="8" cy="8" r="1.5" fill="currentColor" />
    <circle cx="16" cy="8" r="1.5" fill="currentColor" />
    <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    <circle cx="8" cy="16" r="1.5" fill="currentColor" />
    <circle cx="16" cy="16" r="1.5" fill="currentColor" />
  </svg>
`;

const MORE_ICON = `
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="5" cy="12" r="1.8" fill="currentColor" />
    <circle cx="12" cy="12" r="1.8" fill="currentColor" />
    <circle cx="19" cy="12" r="1.8" fill="currentColor" />
  </svg>
`;

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

const CREATABLE_HEADING_LABELS = new Set([
  "正文",
  ...EDITOR_CREATABLE_HEADING_LEVELS.map((level) => `标题 ${level}`),
]);

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

interface EditorHostProps {
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
}

/** Crepe 编辑器宿主：以 initialValue 初始化；被外层按 key 重挂载以回填恢复的正文草稿 */
function EditorHost({
  initialValue,
  onChange,
  onUploadImage,
  placeholder,
  disabled,
  onOpenDrafts,
  threadId,
  diceRolls = [],
}: EditorHostProps) {
  const [loading] = useInstance();
  const crepeRef = useRef<CrepeBuilder | null>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  const toolbarItemsRef = useRef<MilkdownToolbarItemMetadata[]>([]);
  const uploadAbortRef = useRef<AbortController | null>(null);
  const diceSelectionRef = useRef<{ from: number; to: number } | null>(null);
  const [dicePopover, setDicePopover] = useState<{ top: number; left: number } | null>(null);
  const [moreMenuPosition, setMoreMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [toolbarDensity, setToolbarDensity] = useState<MilkdownToolbarDensity>("expanded");
  const [diceNodeCount, setDiceNodeCount] = useState(
    () => parseInlineDiceNodes(initialValue).length,
  );
  const [customDiceNotation, setCustomDiceNotation] = useState("1d20");
  const [mentionMenu, setMentionMenu] = useState<EditorMentionMenu | null>(null);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const [uploadProgress, setUploadProgress] = useState<UploadImageProgressValue | null>(null);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
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

  const emitSerializedMarkdown = useCallback((markdown: string, view: EditorView) => {
    const diceNodes: Array<{ nodeId: string; notation: string }> = [];
    view.state.doc.descendants((node) => {
      if (node.type.name !== DICE_INLINE_NODE_NAME) return;
      diceNodes.push({
        nodeId: String(node.attrs.nodeId),
        notation: String(node.attrs.notation),
      });
    });
    let serialized = restoreSerializedInlineDiceNodes(markdown, diceNodes);
    const lastNode = view.state.doc.lastChild;
    if (lastNode?.type.name === "paragraph" && lastNode.content.size === 0) {
      serialized = `${serialized.replace(/\s+$/u, "")}\n\n<br />`;
    } else {
      // Milkdown 的序列化器会附加一个格式化换行；用户显式空段落由上面的 br 协议表达。
      serialized = serialized.replace(/\n$/u, "");
    }
    onChangeRef.current?.(sanitizeMilkdownMarkdown(serialized));
  }, []);

  const emitCurrentMarkdown = useCallback((view: EditorView) => {
    const markdown = crepeRef.current?.getMarkdown();
    if (markdown === undefined) return;
    emitSerializedMarkdown(markdown, view);
  }, [emitSerializedMarkdown]);

  const { handleMentionSelect } = useEditorMentionController({
    hostRef,
    crepeRef,
    disabled,
    loading,
    threadId,
    items: visibleMentionItems,
    setMenu: setMentionMenu,
    setSelectedIndex: setSelectedMentionIndex,
    onDocumentChange: emitCurrentMarkdown,
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
    setMoreMenuPosition(null);
    setDicePopover(positionEditorPopover(
      menuAnchor ?? directTrigger?.getBoundingClientRect() ?? topBar.getBoundingClientRect(),
      288,
      220,
    ));
  }, [disabled]);

  const handleOpenMore = useCallback(() => {
    if (disabled) return;
    const trigger = hostRef.current?.querySelector<HTMLElement>('[data-editor-tool="more"]');
    if (!trigger) return;
    setDicePopover(null);
    setMoreMenuPosition(positionEditorPopover(
      trigger.getBoundingClientRect(),
      240,
      360,
    ));
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
          return;
      }
      const view = ctx.get(editorViewCtx);
      emitCurrentMarkdown(view);
      view.focus();
    });
    setMoreMenuPosition(null);
  }, [emitCurrentMarkdown]);

  const moreMenuItems = useMemo<EditorMoreMenuItem[]>(() => {
    const items: EditorMoreMenuItem[] = [];
    const add = (
      id: EditorCapabilityId,
      group: EditorMoreMenuItem["group"],
    ) => items.push({ id, group, label: EDITOR_CAPABILITY_LABELS[id] });

    if (toolbarDensity === "compact") {
      add("strikethrough", "文字");
    }
    add("link", "文字");
    add("inline-code", "文字");
    add("quote", "段落");
    add("bullet-list", "段落");
    add("ordered-list", "段落");
    add("hr", "段落");
    add("dice", "创作");
    if (["without-draft", "compact"].includes(toolbarDensity) && onOpenDrafts) {
      add("draft", "创作");
    }
    return items;
  }, [onOpenDrafts, toolbarDensity]);

  const handleMoreSelect = useCallback((capability: EditorCapabilityId, anchor: DOMRect) => {
    if (capability === "dice") {
      const view = crepeRef.current?.editor.action((ctx) => ctx.get(editorViewCtx));
      if (view) handleOpenDice(view, anchor);
      return;
    }
    if (capability === "draft") {
      setMoreMenuPosition(null);
      onOpenDrafts?.();
      return;
    }
    runMoreCommand(capability);
  }, [handleOpenDice, onOpenDrafts, runMoreCommand]);

  const handleCloseMore = useCallback(() => {
    setMoreMenuPosition(null);
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
      toast.error(`每个帖子最多包含 ${MAX_DICE_ROLLS_PER_POST} 个骰子节点`);
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
    // Milkdown 的 markdownUpdated 固定防抖 200ms；骰子插入后必须立即同步，避免紧接着发布拿到旧正文。
    emitCurrentMarkdown(view);
    view.focus();
    setDiceNodeCount(diceCount + 1);
    diceSelectionRef.current = null;
    setDicePopover(null);
  }, [emitCurrentMarkdown]);

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
    emitCurrentMarkdown(view);
    view.focus();
  }, [disabled, emitCurrentMarkdown]);

  useEditor(
    (root) => {
      const crepe = new CrepeBuilder({
        root,
        defaultValue: initialValue,
      });

      // 只装载当前顶部工具栏实际依赖的交互特性；表格、代码编辑器、公式、AI、
      // 块菜单和选择气泡工具栏均不进入客户端包。基础 Markdown schema 仍能读取历史内容。
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

          const groups = builder.build();
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
                    emitCurrentMarkdown(view);
                    view.focus();
                  })
                  .catch(() => {});
              };
              input.click();
            };
          }
          builder.addGroup("dice", "骰子").addItem("dice", {
            icon: DICE_ICON,
            active: () => false,
            onRun: (ctx) => handleOpenDice(ctx.get(editorViewCtx)),
          });
          if (onOpenDrafts) {
            builder.addGroup("draft", "草稿").addItem("draft", {
              icon: DRAFT_ICON,
              active: () => false,
              onRun: () => onOpenDrafts(),
            });
          }
          builder.addGroup("more-menu", "更多").addItem("more", {
            icon: MORE_ICON,
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
      crepe.editor
        .use(dicePlugins.remarkDiceInline)
        .use(dicePlugins.diceInlineSchema)
        .use(dicePlugins.clonePastedDice)
        .use(stickerPlugins.remarkStickerInline)
        .use(stickerPlugins.stickerInlineSchema);

      crepeRef.current = crepe;

      crepe.on((listener) => {
        listener.markdownUpdated((ctx, markdown, prevMarkdown) => {
          if (markdown !== prevMarkdown) {
            // 清理空图片并规范化空段落协议；独占行 <br /> 必须保留以支持艺术化留白。
            const view = ctx.get(editorViewCtx);
            emitSerializedMarkdown(markdown, view);
          }
        });
      });

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
        setToolbarDensity(fitMilkdownToolbar(topBar));
      });
    };
    const syncTopBar = () => {
      syncMilkdownToolbarItems(host, toolbarItemsRef.current);
      syncMilkdownHeadingOptions(host, CREATABLE_HEADING_LABELS);
      syncMilkdownToolbarVisibility(host, disabled ?? false);
      syncMilkdownToolbarSemantics(host);
      scheduleDropdownPosition();
      scheduleToolbarLayout();
    };

    const observer = new MutationObserver(syncTopBar);
    observer.observe(host, { childList: true, subtree: true });
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
  }, [disabled]);

  useEffect(() => {
    if (hostRef.current) {
      syncMilkdownMoreMenuState(hostRef.current, moreMenuPosition !== null);
    }
  }, [moreMenuPosition]);

  return (
    <div ref={hostRef} className="milkdown-editor relative">
      <Milkdown />
      {uploadProgress ? (
        <ImageUploadProgress
          progress={uploadProgress}
          onCancel={() => uploadAbortRef.current?.abort()}
          className="absolute right-3 top-12 z-30 w-[min(22rem,calc(100%-1.5rem))] bg-background/95 shadow-popover backdrop-blur"
        />
      ) : null}
      {!loading && (
        <div className="absolute bottom-2 left-2 z-20 rounded-lg border border-border bg-background/95 shadow-sm backdrop-blur">
          <StickerPickerPopover
            disabled={disabled}
            label="表情"
            onSelect={handleInsertSticker}
          />
        </div>
      )}
      {loading && (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          编辑器加载中…
        </div>
      )}
      <DiceInsertPopover
        position={dicePopover}
        count={diceNodeCount}
        maxCount={MAX_DICE_ROLLS_PER_POST}
        quickSides={QUICK_DICE_SIDES}
        notation={customDiceNotation}
        onNotationChange={setCustomDiceNotation}
        onInsert={handleInsertDice}
      />
      <EditorMoreMenu
        position={moreMenuPosition}
        items={moreMenuItems}
        onSelect={handleMoreSelect}
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
  threadId,
  diceRolls = [],
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

  const charWarning =
    charCount > MAX_CHARS * 0.9
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
        threadId={threadId}
        diceRolls={diceRolls}
      />
      <div className="flex items-center justify-between border-t border-border px-3 py-2">
        <span className="text-xs text-muted-foreground">
          支持 Markdown，粘贴会保留兼容格式
        </span>
        <div className="flex items-center gap-3">
          {(autoSaveEnabled || autoSaveStatus === "error") && (
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

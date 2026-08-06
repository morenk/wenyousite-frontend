/** Milkdown Crepe WYSIWYG Markdown 编辑器封装 — 所有 UI 字符串中文本地化 */

"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { Milkdown, MilkdownProvider, useEditor, useInstance } from "@milkdown/react";
import { Crepe, CrepeFeature } from "@milkdown/crepe";
import { editorViewCtx } from "@milkdown/core";
import { TextSelection } from "@milkdown/kit/prose/state";
import type { EditorView } from "@milkdown/kit/prose/view";
import { AtSign, Loader2, UsersRound } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useDebounce } from "use-debounce";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { sanitizeMilkdownMarkdown } from "@/lib/markdown";
import {
  createInlineDiceNode,
  DICE_INLINE_NODE_NAME,
  parseInlineDiceNodes,
  type InlineDiceRoll,
} from "@/lib/dice-inline";
import { getDiceNotationError, MAX_DICE_ROLLS_PER_POST } from "@/lib/dice";
import { getMentionUserId, markEditorMentionAnchors } from "@/lib/mention";
import { syncMilkdownToolbarVisibility } from "@/lib/milkdown-toolbar";
import { useAuth } from "@/lib/auth";
import { apiClient } from "@/api/client";
import { useSaveDraft } from "@/api/hooks/use-save-draft";
import {
  ContentDraftsPanel,
  type EditorDraftSnapshot,
} from "@/components/user/content-drafts-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createDiceInlineEditorPlugins } from "@/components/editor/dice-inline-plugin";

const MAX_CHARS = 10000;
const QUICK_DICE_SIDES = [4, 6, 8, 10, 12, 20, 100];

const TOOLBAR_TOOLTIPS: Record<number, string> = {
  0: "粗体",
  1: "斜体",
  2: "无序列表",
  3: "链接",
  4: "图片",
  5: "引用",
  6: "分隔线",
  7: "骰子",
  8: "正文草稿",
};

const DRAFT_ICON = `
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="currentColor" d="M5 3h11l3 3v15H5V3Zm2 2v14h10V7.5L14.5 5H7Zm2 4h6v2H9V9Zm0 4h6v2H9v-2Z" />
  </svg>
`;

const DICE_ICON = `
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="currentColor" d="M5 3h6a2 2 0 0 1 2 2v1h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-6v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm0 2v14h6V5H5Zm8 3v8h6V8h-6ZM7 7h2v2H7V7Zm0 6h2v2H7v-2Zm8-3h2v2h-2v-2Zm2 3h2v2h-2v-2Z" />
  </svg>
`;

function injectToolbarTooltips(root: ParentNode) {
  root.querySelectorAll(".milkdown-top-bar").forEach((topBar) => {
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
  /** 当前主题帖 ID；提供后启用受权限约束的 @候选菜单。 */
  threadId?: string;
  /** 已由服务端结算的结果；按 nodeId 映射到正文内联节点。 */
  diceRolls?: InlineDiceRoll[];
}

interface MentionMenuItem {
  id: string;
  label: string;
  username?: string;
  relation?: "FOLLOWING" | "PLAYER";
  isGroup?: boolean;
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
  const crepeRef = useRef<Crepe | null>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const editorDomRef = useRef<HTMLElement | null>(null);
  const editorCleanupRef = useRef<(() => void) | null>(null);
  const mentionMenuRef = useRef<{ from: number; to: number; query: string } | null>(null);
  const mentionItemsRef = useRef<MentionMenuItem[]>([]);
  const selectedMentionIndexRef = useRef(0);
  const isComposingRef = useRef(false);
  const diceSelectionRef = useRef<{ from: number; to: number } | null>(null);
  const [dicePopover, setDicePopover] = useState<{ top: number; left: number } | null>(null);
  const [diceNodeCount, setDiceNodeCount] = useState(
    () => parseInlineDiceNodes(initialValue).length,
  );
  const [customDiceNotation, setCustomDiceNotation] = useState("1d20");
  const [mentionMenu, setMentionMenu] = useState<{
    from: number;
    to: number;
    query: string;
    top: number;
    left: number;
  } | null>(null);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const mentionQuery = mentionMenu?.query ?? "";
  const [debouncedMentionQuery] = useDebounce(mentionQuery, 180);
  const {
    data: mentionResponse,
    isFetching: isMentionFetching,
    isError: isMentionError,
    refetch: refetchMentionCandidates,
  } = useQuery({
    queryKey: ["mention-candidates", threadId, debouncedMentionQuery],
    queryFn: async () => {
      const { data, error } = await apiClient.GET(
        "/api/v1/users/mention-candidates",
        { params: { query: { threadId: threadId ?? "", ...(debouncedMentionQuery ? { q: debouncedMentionQuery } : {}) } } },
      );
      if (error) throw error;
      if (!data) return { users: [], canMentionAllPlayers: false };
      return data.data;
    },
    enabled: Boolean(threadId && mentionMenu),
    staleTime: 10_000,
  });

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

  useEffect(() => {
    mentionItemsRef.current = visibleMentionItems;
    selectedMentionIndexRef.current = Math.min(
      selectedMentionIndexRef.current,
      Math.max(visibleMentionItems.length - 1, 0),
    );
  }, [visibleMentionItems]);

  const activeMentionIndex = Math.min(
    selectedMentionIndex,
    Math.max(visibleMentionItems.length - 1, 0),
  );

  const handleMentionSelect = useCallback((event: ReactMouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    const itemId = event.currentTarget.dataset.mentionId;
    const item = mentionItemsRef.current.find((candidate) => candidate.id === itemId);
    if (!item) return;
    const view = crepeRef.current?.editor.action((ctx) => ctx.get(editorViewCtx));
    const range = mentionMenuRef.current;
    if (!view || !range) return;
    if (item.isGroup) {
      view.dispatch(view.state.tr.insertText("@全体玩家 ", range.from, range.to));
    } else {
      const linkMarkType = view.state.schema.marks.link;
      if (!linkMarkType || !item.username) return;
      const linkMark = linkMarkType.create({
        href: `/users/${item.id}`,
        title: null,
      });
      const mentionNode = view.state.schema.text(`@${item.username}`, [linkMark]);
      const transaction = view.state.tr.replaceWith(range.from, range.to, mentionNode);
      transaction.insertText(" ", range.from + mentionNode.nodeSize);
      view.dispatch(transaction);
    }
    view.focus();
    mentionMenuRef.current = null;
    setMentionMenu(null);
  }, []);

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

  const handleOpenDice = useCallback((view: EditorView) => {
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
    if (!host || !topBar) return;
    const width = 288;
    setDicePopover({
      top: topBar.offsetTop + topBar.offsetHeight + 6,
      left: Math.max(8, Math.min(host.clientWidth - width - 8, topBar.offsetLeft + topBar.offsetWidth - width)),
    });
  }, [disabled]);

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
    view.focus();
    setDiceNodeCount(diceCount + 1);
    diceSelectionRef.current = null;
    setDicePopover(null);
  }, []);

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
          [CrepeFeature.CodeMirror]: false,
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
              // 移除代码块：block 组仅含 code-block，整组删除避免残留分隔线
              const groups = builder.build();
              const blockIdx = groups.findIndex((g) => g.key === "block");
              if (blockIdx !== -1) groups.splice(blockIdx, 1);
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
            },
          },
          [CrepeFeature.LinkTooltip]: {
            inputPlaceholder: "粘贴链接…",
          },
          ...(onUploadImage ? getImageBlockConfig(handleUpload) : {}),
        },
      });

      const dicePlugins = createDiceInlineEditorPlugins(diceRolls);
      crepe.editor
        .use(dicePlugins.remarkDiceInline)
        .use(dicePlugins.diceInlineSchema)
        .use(dicePlugins.clonePastedDice);

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
      if (target?.closest("[data-dice-popover]")) return;
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
    if (!host || !threadId) return;

    const viewForInsert = () =>
      crepeRef.current?.editor.action((ctx) => ctx.get(editorViewCtx)) ?? null;

    const isMentionNode = (node: unknown): node is { isText: boolean; nodeSize: number; text: string; marks: Array<{ type: { name: string }; attrs: { href?: string } }> } => {
      if (!node || typeof node !== "object") return false;
      const candidate = node as {
        isText?: boolean;
        nodeSize?: number;
        text?: string;
        marks?: Array<{ type: { name: string }; attrs: { href?: string } }>;
      };
      return Boolean(
        candidate.isText &&
          candidate.nodeSize &&
          candidate.text &&
          candidate.marks?.some(
            (mark) =>
              mark.type.name === "link" &&
              getMentionUserId(mark.attrs.href, candidate.text),
          ),
      );
    };

    const findMentionRangeAt = (
      view: ReturnType<typeof viewForInsert>,
      position: number,
      direction: "back" | "delete",
    ): { from: number; to: number } | null => {
      if (!view) return null;
      const resolved = view.state.doc.resolve(position);
      const parentStart = resolved.start();
      let result: { from: number; to: number } | null = null;
      resolved.parent.forEach((node, offset) => {
        if (!isMentionNode(node)) return;
        const from = parentStart + offset;
        const to = from + node.nodeSize;
        const matches = direction === "back"
          ? position > from && position <= to
          : position >= from && position < to;
        if (matches) result = { from, to };
      });
      return result;
    };

    const updateMentionMenu = () => {
      const view = crepeRef.current?.editor.action((ctx) => ctx.get(editorViewCtx));
      const editor = editorDomRef.current;
      if (!view || !editor || disabled || isComposingRef.current) return;
      const { from, empty } = view.state.selection;
      if (!empty) {
        mentionMenuRef.current = null;
        setMentionMenu(null);
        return;
      }
      const resolved = view.state.doc.resolve(from);
      const textBefore = resolved.parent.textBetween(0, resolved.parentOffset, "\n", "\n");
      const match = /(^|[\s([>])@([a-zA-Z0-9_\u4e00-\u9fff]{0,24})$/u.exec(textBefore);
      if (!match) {
        mentionMenuRef.current = null;
        setMentionMenu(null);
        return;
      }
      const range = {
        from: from - match[0].length + match[1].length,
        to: from,
        query: match[2] ?? "",
      };
      const coords = view.coordsAtPos(from);
      const hostRect = host.getBoundingClientRect();
      const menuWidth = Math.min(288, Math.max(224, window.innerWidth - 16));
      const menuHeight = 240;
      const maxLeft = Math.max(8, host.clientWidth - menuWidth - 8);
      const belowTop = coords.bottom - hostRect.top + 4;
      const aboveTop = coords.top - hostRect.top - menuHeight - 4;
      const top = coords.bottom + menuHeight > window.innerHeight && aboveTop > 8
        ? aboveTop
        : belowTop;
      mentionMenuRef.current = range;
      setMentionMenu({
        ...range,
        top,
        left: Math.min(maxLeft, Math.max(8, coords.left - hostRect.left)),
      });
    };

    const attach = () => {
      const editor = host.querySelector<HTMLElement>(".ProseMirror");
      if (!editor) return;
      markEditorMentionAnchors(editor);
      if (editorDomRef.current === editor) return;
      editorDomRef.current = editor;
      const handleCompositionStart = () => {
        isComposingRef.current = true;
      };
      const handleCompositionEnd = () => {
        isComposingRef.current = false;
        window.requestAnimationFrame(() => {
          markEditorMentionAnchors(editor);
          updateMentionMenu();
        });
      };
      const handleInput = () => {
        markEditorMentionAnchors(editor);
        updateMentionMenu();
      };
      const handleKeyDown = (event: KeyboardEvent) => {
        if (isComposingRef.current || event.isComposing) return;
        const view = viewForInsert();
        if (!view) return;

        if (event.key === "Backspace" || event.key === "Delete") {
          const direction: "back" | "delete" = event.key === "Backspace" ? "back" : "delete";
          let range = findMentionRangeAt(view, view.state.selection.from, direction);
          if (
            event.key === "Backspace" &&
            !range &&
            view.state.selection.empty &&
            view.state.selection.from > 0 &&
            view.state.doc.resolve(view.state.selection.from).nodeBefore?.text?.endsWith(" ")
          ) {
            range = findMentionRangeAt(view, view.state.selection.from - 1, "back");
            if (range) range.to = view.state.selection.from;
          }
          if (range) {
            event.preventDefault();
            view.dispatch(view.state.tr.delete(range.from, range.to).scrollIntoView());
            window.requestAnimationFrame(updateMentionMenu);
            return;
          }
        }

        const menu = mentionMenuRef.current;
        const items = mentionItemsRef.current;
        if (!menu || items.length === 0) return;
        if (event.key === "ArrowDown") {
          event.preventDefault();
          const next = (selectedMentionIndexRef.current + 1) % items.length;
          selectedMentionIndexRef.current = next;
          setSelectedMentionIndex(next);
        } else if (event.key === "ArrowUp") {
          event.preventDefault();
          const next = (selectedMentionIndexRef.current - 1 + items.length) % items.length;
          selectedMentionIndexRef.current = next;
          setSelectedMentionIndex(next);
        } else if (event.key === "Escape") {
          event.preventDefault();
          mentionMenuRef.current = null;
          setMentionMenu(null);
        } else if (event.key === "Enter" || event.key === "Tab") {
          event.preventDefault();
          const item = items[selectedMentionIndexRef.current] ?? items[0];
          if (item.isGroup) {
            view.dispatch(view.state.tr.insertText("@全体玩家 ", menu.from, menu.to));
          } else {
            const linkMarkType = view.state.schema.marks.link;
            if (!linkMarkType || !item.username) return;
            const linkMark = linkMarkType.create({
              href: `/users/${item.id}`,
              title: null,
            });
            const mentionNode = view.state.schema.text(`@${item.username}`, [linkMark]);
            const transaction = view.state.tr.replaceWith(menu.from, menu.to, mentionNode);
            transaction.insertText(" ", menu.from + mentionNode.nodeSize);
            view.dispatch(transaction);
          }
          view.focus();
          mentionMenuRef.current = null;
          setMentionMenu(null);
        }
      };
      editor.addEventListener("compositionstart", handleCompositionStart);
      editor.addEventListener("compositionend", handleCompositionEnd);
      editor.addEventListener("input", handleInput);
      editor.addEventListener("keyup", updateMentionMenu);
      editor.addEventListener("keydown", handleKeyDown);
      editorCleanupRef.current = () => {
        editor.removeEventListener("compositionstart", handleCompositionStart);
        editor.removeEventListener("compositionend", handleCompositionEnd);
        editor.removeEventListener("input", handleInput);
        editor.removeEventListener("keyup", updateMentionMenu);
        editor.removeEventListener("keydown", handleKeyDown);
        editorDomRef.current = null;
      };
      updateMentionMenu();
    };

    const observer = new MutationObserver(attach);
    observer.observe(host, { childList: true, subtree: true });
    window.addEventListener("resize", updateMentionMenu);
    window.addEventListener("scroll", updateMentionMenu, true);
    attach();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateMentionMenu);
      window.removeEventListener("scroll", updateMentionMenu, true);
      editorCleanupRef.current?.();
      editorCleanupRef.current = null;
      mentionMenuRef.current = null;
      setMentionMenu(null);
    };
  }, [disabled, loading, threadId]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const syncTopBar = () => {
      injectToolbarTooltips(host);
      syncMilkdownToolbarVisibility(host, disabled ?? false);
    };

    const observer = new MutationObserver(syncTopBar);
    observer.observe(host, { childList: true, subtree: true });

    const topBar = host.querySelector(".milkdown-top-bar");
    if (topBar) syncTopBar();

    let attempts = 0;
    const maxAttempts = 50;
    const interval = setInterval(() => {
      attempts++;
      const tb = host.querySelector(".milkdown-top-bar");
      if (tb) {
        syncTopBar();
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
    };
  }, [disabled]);

  return (
    <div ref={hostRef} className="milkdown-editor relative">
      <Milkdown />
      {loading && (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          编辑器加载中…
        </div>
      )}
      {dicePopover && (
        <div
          data-dice-popover
          role="dialog"
          aria-label="插入骰子"
          className="absolute z-50 w-72 rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-lg"
          style={{ top: dicePopover.top, left: dicePopover.left }}
        >
          <div className="mb-2 flex items-center justify-between gap-3 text-sm font-medium">
            <span>插入骰子</span>
            <span className="text-xs font-normal text-muted-foreground">
              {diceNodeCount}/{MAX_DICE_ROLLS_PER_POST}
            </span>
          </div>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {QUICK_DICE_SIDES.map((sides) => (
              <Button
                key={sides}
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                disabled={diceNodeCount >= MAX_DICE_ROLLS_PER_POST}
                onClick={() => handleInsertDice(`1d${sides}`)}
              >
                d{sides}
              </Button>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              autoFocus
              value={customDiceNotation}
              onChange={(event) => setCustomDiceNotation(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                handleInsertDice(customDiceNotation);
              }}
              className="h-8"
              aria-label="自定义骰子表达式"
              placeholder="例如 2d6+3"
            />
            <Button
              type="button"
              size="sm"
              className="h-8 px-3"
              disabled={diceNodeCount >= MAX_DICE_ROLLS_PER_POST}
              onClick={() => handleInsertDice(customDiceNotation)}
            >
              插入
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">提交后由服务器生成结果</p>
        </div>
      )}
      {mentionMenu && (
        <div
          role="listbox"
          aria-label="艾特候选"
          className="absolute z-50 w-[min(18rem,calc(100vw-1rem))] overflow-hidden rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg"
          style={{ top: mentionMenu.top, left: mentionMenu.left }}
        >
          {(mentionQueryPending || isMentionFetching) && (
            <div className="flex items-center gap-2 px-2.5 py-2 text-sm text-muted-foreground" role="status">
              <Loader2 className="h-4 w-4 animate-spin" />
              正在查找可艾特用户…
            </div>
          )}
          {!mentionQueryPending && !isMentionFetching && isMentionError && (
            <button
              type="button"
              className="flex w-full items-center justify-center rounded-md px-2.5 py-2 text-sm text-destructive hover:bg-accent/60"
              onMouseDown={(event) => {
                event.preventDefault();
                void refetchMentionCandidates();
              }}
            >
              加载失败，点击重试
            </button>
          )}
          {!mentionQueryPending && !isMentionFetching && !isMentionError && visibleMentionItems.length === 0 && (
            <div className="px-2.5 py-2 text-sm text-muted-foreground">暂无可艾特用户</div>
          )}
          {!mentionQueryPending && !isMentionFetching && visibleMentionItems.map((item, index) => (
            <button
              key={item.id}
              type="button"
              role="option"
              aria-selected={index === activeMentionIndex}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm",
                index === activeMentionIndex ? "bg-accent text-accent-foreground" : "hover:bg-accent/60",
              )}
              data-mention-id={item.id}
              onMouseDown={handleMentionSelect}
            >
              {item.isGroup ? <UsersRound className="h-4 w-4" /> : <AtSign className="h-4 w-4" />}
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              <span className="text-xs text-muted-foreground">
                {item.isGroup ? "仅楼主/协作者" : item.relation === "PLAYER" ? "帖内玩家" : "我关注的人"}
              </span>
            </button>
          ))}
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
  threadId,
  diceRolls = [],
}: MilkdownEditorProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
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
  const autoSaveVersionRef = useRef<number | undefined>(undefined);
  const autoSaveEnabledRef = useRef(false);

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
    (snapshot: EditorDraftSnapshot) => {
      const { content } = snapshot;
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
    if (!user) return;
    const refreshDrafts = () => {
      void queryClient.refetchQueries({ queryKey: ["content-drafts"] });
      void queryClient.refetchQueries({ queryKey: ["draft-slots"] });
    };
    window.addEventListener("focus", refreshDrafts);
    return () => window.removeEventListener("focus", refreshDrafts);
  }, [queryClient, user]);

  useEffect(() => {
    if (!autoSaveEnabled) return;

    const content = currentContent.trim();
    if (!content) return;

    const sequence = ++autoSaveSequenceRef.current;
    const timer = window.setTimeout(() => {
      setAutoSaveStatus("saving");
      autoSaveQueueRef.current = autoSaveQueueRef.current
        .catch(() => undefined)
        .then(() => {
          if (!autoSaveEnabledRef.current) return null;
          return saveDraftAutomatically({
            content,
            slot: 1,
            ...(autoSaveVersionRef.current !== undefined
              ? { version: autoSaveVersionRef.current }
              : {}),
          });
        })
        .then((draft) => {
          if (!draft || !autoSaveEnabledRef.current) return;
          autoSaveVersionRef.current = draft.version;
          if (autoSaveSequenceRef.current === sequence) setAutoSaveStatus("saved");
        })
        .catch((error) => {
          if (autoSaveSequenceRef.current === sequence) {
            setAutoSaveStatus("error");
            autoSaveEnabledRef.current = false;
            setAutoSaveEnabled(false);
            toast.error(
              (error as { message?: string })?.message || "正文草稿自动保存失败",
            );
          }
        });
    }, 800);

    return () => window.clearTimeout(timer);
  }, [autoSaveEnabled, currentContent, saveDraftAutomatically]);

  const handleAutoSaveChange = useCallback((enabled: boolean, version?: number) => {
    autoSaveEnabledRef.current = enabled;
    autoSaveVersionRef.current = enabled ? version : undefined;
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
        threadId={threadId}
        diceRolls={diceRolls}
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

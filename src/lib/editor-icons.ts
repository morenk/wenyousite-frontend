import { iconSvg, type IconSemanticId } from "@wenyousite/foundation/icons";
import type { EditorCapabilityId } from "@/lib/editor-capabilities";
import type { WenyouTextAlignment } from "@/lib/markdown-alignment";

const EDITOR_ICON_IDS = {
  heading: "editor.heading",
  bold: "editor.bold",
  italic: "editor.italic",
  strikethrough: "editor.strikethrough",
  "inline-code": "editor.inline-code",
  "bullet-list": "editor.bullet-list",
  "ordered-list": "editor.ordered-list",
  alignment: "editor.alignment",
  link: "editor.link",
  image: "editor.image",
  quote: "editor.quote",
  hr: "editor.horizontal-rule",
  dice: "editor.dice",
  sticker: "editor.sticker",
  draft: "editor.content-drafts",
  more: "editor.more",
} as const satisfies Partial<Record<EditorCapabilityId, IconSemanticId>>;

const EDITOR_ALIGNMENT_ICON_IDS = {
  left: "editor.align-left",
  center: "editor.align-center",
  right: "editor.align-right",
} as const satisfies Record<WenyouTextAlignment, IconSemanticId>;

export type EditorIconCapability = keyof typeof EDITOR_ICON_IDS;

export function editorIconId(capability: EditorIconCapability): IconSemanticId {
  return EDITOR_ICON_IDS[capability];
}

export function isEditorIconCapability(
  capability: EditorCapabilityId,
): capability is EditorIconCapability {
  return capability in EDITOR_ICON_IDS;
}

export function editorIconSvg(capability: EditorIconCapability): string {
  return iconSvg(editorIconId(capability));
}

export function editorChevronDownSvg(): string {
  return iconSvg("editor.chevron-down");
}

export function editorAlignmentIconId(
  alignment: WenyouTextAlignment,
): IconSemanticId {
  return EDITOR_ALIGNMENT_ICON_IDS[alignment];
}

export function editorAlignmentIconSvg(alignment: WenyouTextAlignment): string {
  return iconSvg(editorAlignmentIconId(alignment));
}

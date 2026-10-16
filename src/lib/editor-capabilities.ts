import { EDITOR_CAPABILITY_LABELS as FOUNDATION_EDITOR_LABELS, type EditorCapabilityId as FoundationEditorCapabilityId } from "@wenyousite/foundation/editor";

/**
 * 编辑器能力的本地兼容入口；事实源由锁定的 wenyousite-foundation 版本提供。
 * 业务组件继续从此处导入，避免依赖包路径渗入组件层。
 */
export {
  EDITOR_CONTENT_POLICY,
  EDITOR_CONTEXTUAL_MOBILE,
  EDITOR_CONTEXTUAL_WEB,
  EDITOR_CREATABLE_HEADING_LEVELS,
  EDITOR_DENSITY_ORDER,
  EDITOR_INVARIANTS,
  EDITOR_MOBILE_CAPABILITIES,
  EDITOR_MOBILE_LAYOUT,
  EDITOR_MORE_FALLBACK,
  EDITOR_MORE_BY_DENSITY,
  EDITOR_MORE_PROGRESSIVE,
  EDITOR_PRIMARY_BY_DENSITY,
  EDITOR_PRIMARY_NARROW,
  EDITOR_PRIMARY_WIDE,
  EDITOR_TEXT_COLOR_PROFILE,
  EDITOR_WEB_CAPABILITIES,
  EDITOR_WEB_LAYOUT,
  FOUNDATION_VERSION,
} from "@wenyousite/foundation/editor";

export type {
  EditorCapabilityContract,
  EditorToolbarDensity,
} from "@wenyousite/foundation/editor";

/** 仅控制可见入口；列表能力和历史正文协议继续由 Foundation 提供。 */
export function isEditorToolbarCapabilityVisible(capability: string): boolean {
  return capability !== "bullet-list" && capability !== "ordered-list";
}

/** 音频行为与图标由 Foundation ./audio 提供；本层将可执行入口接入旧版 editor 能力类型。 */
export type EditorCapabilityId = FoundationEditorCapabilityId | "audio";
export const EDITOR_CAPABILITY_LABELS = { ...FOUNDATION_EDITOR_LABELS, audio: "音频" } as const;
export const editorCapabilityLabels = (ids: readonly EditorCapabilityId[]) => ids.map((id) => EDITOR_CAPABILITY_LABELS[id]);

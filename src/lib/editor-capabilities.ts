/**
 * 编辑器能力的本地兼容入口；事实源由锁定的 wenyousite-foundation 版本提供。
 * 业务组件继续从此处导入，避免依赖包路径渗入组件层。
 */
export {
  EDITOR_CAPABILITY_LABELS,
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
  EDITOR_SYNTAX_ONLY,
  EDITOR_WEB_CAPABILITIES,
  EDITOR_WEB_LAYOUT,
  FOUNDATION_VERSION,
  editorCapabilityLabels,
} from "@wenyousite/foundation/editor";

export type {
  EditorCapabilityContract,
  EditorCapabilityId,
  EditorToolbarDensity,
} from "@wenyousite/foundation/editor";

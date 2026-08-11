/**
 * 编辑器能力的本地兼容入口；事实源由锁定的 wenyousite-foundation 版本提供。
 * 业务组件继续从此处导入，避免依赖包路径渗入组件层。
 */
export {
  EDITOR_CAPABILITY_LABELS,
  EDITOR_CREATABLE_HEADING_LEVELS,
  EDITOR_MORE_FALLBACK,
  EDITOR_MORE_PROGRESSIVE,
  EDITOR_PRIMARY_NARROW,
  EDITOR_PRIMARY_WIDE,
  EDITOR_SYNTAX_ONLY,
  FOUNDATION_VERSION,
  editorCapabilityLabels,
} from "@wenyousite/foundation/editor";

export type { EditorCapabilityId } from "@wenyousite/foundation/editor";

import {
  isDynamicFontRevoked,
  rememberFontRevocation,
} from "./dynamic-font-revocations";
import type { components } from "@/api/types";
export type DynamicFontDescriptor =
  components["schemas"]["FontVersionDescriptorDto"];
type Permission = Pick<
  DynamicFontDescriptor,
  | "versionId"
  | "revision"
  | "status"
  | "selectable"
  | "pasteAllowed"
  | "renderAllowed"
>;
const entries = new Map<string, Permission>();
const listeners = new Set<() => void>();
let revision = 0;
let projectionVersion = 0;
export function dynamicFontProjectionVersion() {
  return projectionVersion;
}
function notify() {
  projectionVersion++;
  for (const listener of listeners) listener();
}
/** 轻量权限投影：未知版本只能保源；过时响应不能覆盖新修订或撤回。 */
export function rememberDynamicFont(value: Permission, notifyChange = true) {
  if (isDynamicFontRevoked(value.versionId)) return;
  if (value.status === "withdrawn") {
    rememberFontRevocation(value.versionId);
    entries.delete(value.versionId);
    notify();
    return;
  }
  const previous = entries.get(value.versionId);
  if (value.revision < (previous?.revision ?? 0)) return;
  const {
    versionId,
    revision,
    status,
    selectable,
    pasteAllowed,
    renderAllowed,
  } = value;
  if (
    previous &&
    previous.revision === revision &&
    previous.status === status &&
    previous.selectable === selectable &&
    previous.pasteAllowed === pasteAllowed &&
    previous.renderAllowed === renderAllowed
  )
    return;
  entries.delete(versionId);
  entries.set(versionId, {
    versionId,
    revision,
    status,
    selectable,
    pasteAllowed,
    renderAllowed,
  });
  while (entries.size > 512) entries.delete(entries.keys().next().value!);
  if (notifyChange) notify();
}
export function dynamicFontState(id: string) {
  if (isDynamicFontRevoked(id))
    return {
      versionId: id,
      revision: 0,
      status: "withdrawn" as const,
      selectable: false,
      pasteAllowed: false,
      renderAllowed: false,
    };
  return entries.get(id);
}
export function subscribeDynamicFonts(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function rememberDynamicFontCatalog(
  items: readonly { versionId: string }[],
  nextRevision: number,
) {
  if (nextRevision < revision) return;
  revision = nextRevision;
  const current = new Set(items.map((item) => item.versionId));
  for (const value of entries.values())
    if (!current.has(value.versionId) && value.status !== "withdrawn") {
      value.selectable = false;
    }
  for (const item of items)
    rememberDynamicFont(
      {
        versionId: item.versionId,
        revision: nextRevision,
        status: "published",
        selectable: true,
        pasteAllowed: true,
        renderAllowed: true,
      },
      false,
    );
  notify();
}

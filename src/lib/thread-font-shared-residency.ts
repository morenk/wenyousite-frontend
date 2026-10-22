import { FontResidency } from "./thread-font-residency";
const listeners = new Set<() => void>();
let residency: FontResidency | undefined;
/** v1/v2 在同一文档共用实际 face/SFNT 账本，导入 alias 按 SHA+family 合并。 */
export function sharedFontResidency() {
  return (residency ??= new FontResidency(
    {
      families: Number.MAX_SAFE_INTEGER,
      faces: 64,
      bytes: 16777216,
      originalBytes: 0,
    },
    () => {
      for (const listener of listeners) listener();
    },
  ));
}
export function onFontCapacityAvailable(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

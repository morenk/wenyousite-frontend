import imports from "../../contracts/thread-font-v1-import-map.json";
import { dynamicFontState } from "./dynamic-text-font-state";

const versions = new Map(
  imports.fonts.map(({ legacyId, versionId }) => [legacyId, versionId]),
);
export function importedTextFontVersion(id: string) {
  return versions.get(id);
}
export type LegacyFontRoute = "legacy-v1" | "mapped-v2" | "default-font";
/** 支持声明只提升本浏览器文档的路由；暂时降级不能绕过固定版本的撤回状态。 */
export class LegacyTextFontRouting {
  private activated = false;
  private readonly listeners = new Set<() => void>();
  constructor(
    private readonly withdrawn = (id: string) =>
      dynamicFontState(id)?.status === "withdrawn",
  ) {}
  observeCapability(value: unknown) {
    if (value !== true || this.activated) return;
    this.activated = true;
    for (const listener of this.listeners) listener();
  }
  route(id: string): LegacyFontRoute {
    const version = importedTextFontVersion(id);
    if (!version || this.withdrawn(version)) return "default-font";
    return this.activated ? "mapped-v2" : "legacy-v1";
  }
  get snapshot() {
    return [...versions.keys()].map((id) => this.route(id)).join(",");
  }
  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}
export const legacyTextFontRouting = new LegacyTextFontRouting();

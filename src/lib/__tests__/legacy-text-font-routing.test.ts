import { afterEach, beforeEach, expect, test, vi } from "vitest";
import fixtures from "../../../contracts/thread-font-dynamic-v2-fixtures.json";
import imports from "../../../contracts/thread-font-v1-import-map.json";
import type { DynamicFontDescriptor } from "../dynamic-text-font-state";

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

test.each(fixtures.legacyCapabilityCases)("能力防降级：$id", async (sample) => {
  const { LegacyTextFontRouting } = await import("../legacy-text-font-routing");
  const routing = new LegacyTextFontRouting(() => sample.knownWithdrawn);
  const changed = vi.fn();
  const release = routing.subscribe(changed);
  if (sample.previouslyActivated) routing.observeCapability(true);
  routing.observeCapability(sample.capability);
  expect(routing.route("great-vibes")).toBe(sample.expectedRoute);
  expect(routing.route("xiaocheng-lafeng")).toBe("default-font");
  expect(routing.route("unknown")).toBe("default-font");
  expect(changed).toHaveBeenCalledTimes(sample.previouslyActivated ? 1 : 0);
  release();
});

test.each(fixtures.legacyRoutingCases)(
  "固定版本状态与保源：$id",
  async (sample) => {
    const { DynamicFontMetadata } = await import("@/api/dynamic-font-metadata");
    const { FontMetadataError } =
      await import("@/api/hooks/text-font-recovery");
    const { legacyTextFontRouting, importedTextFontVersion } =
      await import("../legacy-text-font-routing");
    const { isPasteAllowedTextFont, readTextFont, textFontFamily } =
      await import("../markdown-text-font");
    const make = (
      status: "published" | "disabled" | "withdrawn",
      revision: number,
    ): DynamicFontDescriptor => ({
      fontVersion: 2,
      versionId: sample.versionId,
      familyId: imports.fonts.find((font) => font.legacyId === sample.legacyId)!
        .familyId,
      versionNumber: 1,
      revision,
      status,
      name: "历史字体",
      designLanguage: "en",
      selectable: status === "published",
      pasteAllowed: status === "published",
      renderAllowed: status !== "withdrawn",
      assetBasePath:
        status === "withdrawn"
          ? null
          : `/api/v1/meta/text-fonts/v2/versions/${sample.versionId}/assets/`,
      manifest:
        status === "withdrawn"
          ? null
          : { sha256: "a".repeat(64), bytes: 32, format: "json" },
      specimen:
        status === "withdrawn"
          ? null
          : { sha256: "b".repeat(64), bytes: 32, format: "png" },
    });
    let stage = sample.lastTrustedStatus;
    const descriptor = vi.fn(async () => {
      const status = stage ?? sample.response;
      if (["404", "unknown"].includes(status))
        throw new FontMetadataError(false, undefined, 404);
      if (status === "network-error") throw new TypeError("offline");
      return {
        data: make(
          status === "stale-published"
            ? "published"
            : (status as "published" | "disabled" | "withdrawn"),
          status === "stale-published" ? 1 : 2,
        ),
        etag: undefined,
        unchanged: false,
      };
    });
    const metadata = new DynamicFontMetadata({
      descriptor,
      page: vi.fn(),
      policy: vi.fn(),
    });
    legacyTextFontRouting.observeCapability(true);
    expect(importedTextFontVersion(sample.legacyId)).toBe(sample.versionId);
    const release = metadata.watch(sample.versionId, vi.fn());
    await vi.advanceTimersByTimeAsync(0);
    if (stage) {
      stage = null;
      window.dispatchEvent(new Event("focus"));
      await vi.advanceTimersByTimeAsync(0);
    }
    const value = metadata.get(sample.versionId);
    expect(value?.renderAllowed === true).toBe(sample.expectedRenderAllowed);
    expect(isPasteAllowedTextFont(sample.legacyId)).toBe(
      sample.expectedPasteAllowed,
    );
    const assets =
      value?.renderAllowed && metadata.assetsAvailable(sample.versionId)
        ? "v2"
        : "none";
    expect(assets).toBe(sample.expectedAssetRequest);
    const element = document.createElement("span");
    element.setAttribute("data-wenyou-font-v1", sample.legacyId);
    element.textContent = "Aa";
    const source = element.outerHTML;
    expect(readTextFont(element)).toBe(sample.legacyId);
    expect(textFontFamily(sample.legacyId)).toContain(sample.legacyId);
    expect(element.outerHTML === source).toBe(sample.expectedSourceUnchanged);
    expect(legacyTextFontRouting.route(sample.legacyId)).not.toBe("legacy-v1");
    release();
  },
);

test("导入字体墓碑不随普通权限 LRU 淘汰，迟到目录不能恢复", async () => {
  const { rememberDynamicFont, dynamicFontState } =
    await import("../dynamic-text-font-state");
  const { legacyTextFontRouting } = await import("../legacy-text-font-routing");
  const font = imports.fonts[0]!;
  const tombstone = {
    versionId: font.versionId,
    revision: 3,
    status: "withdrawn" as const,
    selectable: false,
    pasteAllowed: false,
    renderAllowed: false,
  };
  rememberDynamicFont(tombstone);
  for (let n = 0; n < 520; n++)
    rememberDynamicFont({
      ...tombstone,
      versionId: "tfv_" + n.toString(16).padStart(32, "0"),
      status: "published",
    });
  rememberDynamicFont({
    ...tombstone,
    revision: 4,
    status: "published",
    selectable: true,
    pasteAllowed: true,
    renderAllowed: true,
  });
  expect(dynamicFontState(font.versionId)?.status).toBe("withdrawn");
  expect(legacyTextFontRouting.route(font.legacyId)).toBe("default-font");
});

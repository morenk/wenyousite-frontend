import { afterEach, expect, test, vi } from "vitest";
import { installThreadFontFace } from "../thread-font-binary";
import fixtures from "../../../contracts/thread-font-dynamic-v2-fixtures.json";
import { FontResidency } from "../thread-font-residency";
afterEach(() => vi.unstubAllGlobals());
test.each(fixtures.legacyImportRegistrationCases)(
  "共享正式夹具：$id",
  async (scenario) => {
    const add = vi.fn(),
      remove = vi.fn(),
      load = vi.fn(async function (this: unknown) {
        return this;
      });
    const create = vi.fn();
    vi.stubGlobal(
      "FontFace",
      class {
        constructor(...args: unknown[]) {
          create(...args);
        }
        load = load;
      },
    );
    const original = document.fonts;
    Object.defineProperty(document, "fonts", {
      value: { add, delete: remove },
      configurable: true,
    });
    try {
      const resident = new FontResidency({
          families: Number.MAX_SAFE_INTEGER,
          faces: 64,
          bytes: 16777216,
          originalBytes: 0,
        }),
        leases = [];
      for (const event of scenario.events) {
        const lease = await resident.acquire(
          {
            key: event.sha256 + ":" + event.family,
            fontId: "protocol-" + event.protocol,
            bytes: event.bytes,
            original: false,
          },
          new AbortController().signal,
        );
        leases.push(lease);
        if (!lease.entry.dispose)
          resident.installed(
            lease.entry,
            await installThreadFontFace(
              {
                family: event.family,
                unicodeRanges: ["U+0041"],
                web: { sha256: event.sha256 },
              },
              new ArrayBuffer(event.bytes),
            ),
          );
      }
      expect(create).toHaveBeenCalledTimes(scenario.expectedNativeAttempts);
      expect(add).toHaveBeenCalledTimes(1);
      expect(resident.snapshot).toMatchObject({
        faces: 1,
        bytes: scenario.expectedChargedBytes,
        references: 2,
      });
      leases[0]!.release();
      expect(remove).not.toHaveBeenCalled();
      leases[1]!.release();
      resident.invalidate();
      expect(remove).toHaveBeenCalledTimes(1);
    } finally {
      Object.defineProperty(document, "fonts", {
        value: original,
        configurable: true,
      });
    }
  },
);
test("并发调用按SHA与family共用一次原生注册，最终引用释放才注销", async () => {
  const add = vi.fn(),
    remove = vi.fn(),
    create = vi.fn();
  vi.stubGlobal(
    "FontFace",
    class {
      constructor() {
        create();
      }
      async load() {
        return this;
      }
    },
  );
  const original = document.fonts;
  Object.defineProperty(document, "fonts", {
    value: { add, delete: remove },
    configurable: true,
  });
  try {
    const part = {
      family: "WYF2-" + "a".repeat(32) + "-core",
      unicodeRanges: ["U+0041"],
      web: { sha256: "b".repeat(64) },
    };
    const leases = await Promise.all([
      installThreadFontFace(part, new ArrayBuffer(48)),
      installThreadFontFace(part, new ArrayBuffer(48)),
    ]);
    expect(create).toHaveBeenCalledTimes(1);
    leases[0]!();
    leases[0]!();
    expect(remove).not.toHaveBeenCalled();
    leases[1]!();
    expect(remove).toHaveBeenCalledTimes(1);
  } finally {
    Object.defineProperty(document, "fonts", {
      value: original,
      configurable: true,
    });
  }
});

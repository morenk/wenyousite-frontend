import { isDynamicFontRevoked } from "@/lib/dynamic-font-revocations";
import { z } from "zod";
import {
  fetchDynamicFontDescriptor,
  fetchDynamicFontPage,
  fetchDynamicFontPolicy,
  type DynamicFontPage,
} from "./text-font-dynamic-transport";
import {
  FontMetadataError,
  fontMetadataRetry,
  fontMetadataRetryDelay,
} from "./hooks/text-font-recovery";
import {
  dynamicFontDescriptorSchema,
  parseDynamicFontPolicy,
  type DynamicFontPolicy,
} from "@/lib/dynamic-text-font-protocol";
import {
  rememberDynamicFont,
  rememberDynamicFontCatalog,
  type DynamicFontDescriptor,
} from "@/lib/dynamic-text-font-state";
type Entry = {
  value?: DynamicFontDescriptor;
  etag?: string;
  updated: number;
  negative: boolean;
  unavailable?: boolean;
  users: Set<() => void>;
  pending?: Promise<void>;
  controller?: AbortController;
  retry?: ReturnType<typeof setTimeout>;
  failures: number;
  retryAt?: number;
};
const itemSchema = z
  .object({
    familyId: z.string().regex(/^tff_[a-f0-9]{32}$/u),
    versionId: z.string().regex(/^tfv_[a-f0-9]{32}$/u),
    name: z.string().refine((value) => Array.from(value).length <= 80),
    designLanguage: z.enum(["zh", "ja", "en", "other"]),
    sortOrder: z.number().int(),
    selectable: z.literal(true),
    pasteAllowed: z.literal(true),
    renderAllowed: z.literal(true),
    assetBasePath: z.string(),
    specimen: z
      .object({
        sha256: z.string().regex(/^[a-f0-9]{64}$/u),
        bytes: z.number().int().positive().max(67108864),
        format: z.literal("png"),
      })
      .strict(),
  })
  .strict();
const pageSchema = z
  .object({
    fontVersion: z.literal(2),
    releaseId: z.string().regex(/^tfc_[a-f0-9]{32}$/u),
    revision: z.number().int().nonnegative(),
    items: z.array(itemSchema).max(200),
    nextCursor: z.string().nullable(),
  })
  .strict();
/** 公共轻元数据：请求合并、短负缓存和有界闲置 LRU；清单二进制不进入此缓存。 */
export class DynamicFontMetadata {
  private entries = new Map<string, Entry>();
  private catalogValue?: DynamicFontPage;
  private catalogEtag?: string;
  private catalogPending?: Promise<DynamicFontPage>;
  private policyValue?: DynamicFontPolicy;
  private policyUpdated = 0;
  private policyRetryAt = 0;
  private policyFailures = 0;
  private policyError: unknown;
  private catalogRetryAt = 0;
  private catalogError: unknown;
  private catalogFailures = 0;
  private policyPending?: Promise<DynamicFontPolicy>;
  private timer?: ReturnType<typeof setInterval>;
  constructor(
    private readonly transport = {
      page: fetchDynamicFontPage,
      descriptor: fetchDynamicFontDescriptor,
      policy: fetchDynamicFontPolicy,
    },
  ) {}
  private readonly foreground = () => {
    if (
      typeof document === "undefined" ||
      document.visibilityState !== "hidden"
    )
      for (const [id, entry] of this.entries)
        if (entry.users.size) void this.refresh(id, true);
  };
  get(id: string) {
    const value = this.entries.get(id)?.value;
    return value && isDynamicFontRevoked(id)
      ? {
          ...value,
          status: "withdrawn" as const,
          selectable: false,
          pasteAllowed: false,
          renderAllowed: false,
          manifest: null,
          specimen: null,
          assetBasePath: null,
        }
      : value;
  }
  assetsAvailable(id: string) {
    return (
      !isDynamicFontRevoked(id) && this.entries.get(id)?.unavailable !== true
    );
  }
  get snapshot() {
    return {
      versions: this.entries.size,
      active: [...this.entries.values()].filter((x) => x.users.size).length,
      pending: [...this.entries.values()].filter((x) => x.pending).length,
    };
  }
  async catalog(signal: AbortSignal): Promise<DynamicFontPage> {
    if (this.catalogPending)
      return this.catalogPending.catch((error) => {
        if (
          error instanceof DOMException &&
          error.name === "AbortError" &&
          !signal.aborted
        )
          return this.catalog(signal);
        throw error;
      });
    if (performance.now() < this.catalogRetryAt) throw this.catalogError;
    this.catalogPending = (async () => {
      for (let restart = 0; restart < 3; restart++) {
        try {
          let cursor: string | undefined,
            first: DynamicFontPage | undefined,
            etag: string | undefined,
            totalBytes = 0;
          const items: DynamicFontPage["items"] = [],
            seen = new Set<string>(),
            cursors = new Set<string>();
          do {
            const response = await this.transport.page(
              cursor,
              cursor ? undefined : this.catalogEtag,
              signal,
            );
            if (response.unchanged) {
              if (!cursor && this.catalogValue) return this.catalogValue;
              throw new FontMetadataError(false);
            }
            const page = pageSchema.parse(response.data);
            totalBytes += JSON.stringify(page).length * 2;
            if (totalBytes > 8 * 1024 * 1024)
              throw new FontMetadataError(false);
            if (!first) {
              first = page;
              etag = response.etag;
            } else if (
              first.releaseId !== page.releaseId ||
              first.revision !== page.revision
            )
              throw new FontMetadataError(true, undefined, 409);
            for (const item of page.items) {
              if (
                seen.has(item.versionId) ||
                item.assetBasePath !==
                  `/api/v1/meta/text-fonts/v2/versions/${item.versionId}/assets/`
              )
                throw new FontMetadataError(false);
              seen.add(item.versionId);
              items.push(item);
            }
            if (page.nextCursor && cursors.has(page.nextCursor))
              throw new FontMetadataError(false);
            if (page.nextCursor) cursors.add(page.nextCursor);
            cursor = page.nextCursor ?? undefined;
          } while (cursor);
          if (first!.revision < (this.catalogValue?.revision ?? 0))
            return this.catalogValue!;
          this.catalogValue = { ...first!, items, nextCursor: null };
          this.catalogEtag = etag;
          rememberDynamicFontCatalog(items, first!.revision);
          // 已在阅读的旧版本独立复核，不因新目录清理其注册或网络账本。
          this.foreground();
          return this.catalogValue;
        } catch (error) {
          if (error instanceof FontMetadataError && error.status === 409) {
            this.catalogEtag = undefined;
            continue;
          }
          throw error;
        }
      }
      throw new FontMetadataError(true);
    })()
      .then((value) => {
        this.catalogFailures = 0;
        this.catalogRetryAt = 0;
        return value;
      })
      .catch((error) => {
        this.catalogError = error;
        if (fontMetadataRetry(this.catalogFailures, error))
          this.catalogRetryAt =
            performance.now() +
            fontMetadataRetryDelay(this.catalogFailures++, error);
        throw error;
      })
      .finally(() => {
        this.catalogPending = undefined;
      });
    return this.catalogPending;
  }
  async policy(signal: AbortSignal): Promise<DynamicFontPolicy> {
    if (this.policyValue && Date.now() - this.policyUpdated < 300000)
      return this.policyValue;
    if (performance.now() < this.policyRetryAt) {
      if (this.policyValue) return this.policyValue;
      throw this.policyError;
    }
    if (!this.policyPending)
      this.policyPending = this.transport
        .policy(signal)
        .then(parseDynamicFontPolicy)
        .then((value) => {
          this.policyValue = value;
          this.policyUpdated = Date.now();
          this.policyRetryAt = 0;
          this.policyFailures = 0;
          return value;
        })
        .catch((error) => {
          this.policyError = error;
          this.policyRetryAt =
            performance.now() +
            (fontMetadataRetry(this.policyFailures, error)
              ? fontMetadataRetryDelay(this.policyFailures++, error)
              : 300000);
          if (this.policyValue) return this.policyValue;
          throw error;
        })
        .finally(() => {
          this.policyPending = undefined;
        });
    return this.policyPending.catch((error) => {
      if (
        error instanceof DOMException &&
        error.name === "AbortError" &&
        !signal.aborted
      ) {
        this.policyRetryAt = 0;
        return this.policy(signal);
      }
      throw error;
    });
  }
  watch(id: string, listener: () => void): () => void {
    let entry = this.entries.get(id);
    if (!entry) {
      this.trim(1);
      if (this.entries.size >= 512) return () => {};
      entry = { updated: 0, negative: false, users: new Set(), failures: 0 };
      this.entries.set(id, entry);
    }
    this.entries.delete(id);
    this.entries.set(id, entry);
    entry.users.add(listener);
    void this.refresh(id);
    if (!this.timer) {
      this.timer = setInterval(this.foreground, 300000);
      window.addEventListener("online", this.foreground);
      window.addEventListener("focus", this.foreground);
      document.addEventListener("visibilitychange", this.foreground);
    }
    return () => {
      entry.users.delete(listener);
      if (!entry.users.size) {
        entry.controller?.abort();
        clearTimeout(entry.retry);
        entry.retry = undefined;
      }
      this.trim();
      if (![...this.entries.values()].some((x) => x.users.size)) {
        clearInterval(this.timer);
        this.timer = undefined;
        window.removeEventListener("online", this.foreground);
        window.removeEventListener("focus", this.foreground);
        document.removeEventListener("visibilitychange", this.foreground);
      }
    };
  }
  async refresh(id: string, force = false): Promise<void> {
    const entry = this.entries.get(id);
    if (
      !entry ||
      isDynamicFontRevoked(id) ||
      entry.pending ||
      !entry.users.size
    )
      return entry?.pending;
    if (entry.retryAt && performance.now() < entry.retryAt) return;
    if (
      entry.value?.status === "withdrawn" ||
      (entry.updated &&
        Date.now() - entry.updated <
          (entry.negative ? 30000 : force ? 0 : 300000))
    )
      return;
    const controller = new AbortController();
    entry.controller = controller;
    entry.pending = (async () => {
      try {
        const response = await this.transport.descriptor(
          id,
          entry.etag,
          controller.signal,
        );
        if (controller.signal.aborted || isDynamicFontRevoked(id)) return;
        if (response.data) {
          const value = dynamicFontDescriptorSchema.parse(response.data);
          if (value.versionId !== id) throw new FontMetadataError(false);
          if (value.revision < (entry.value?.revision ?? 0)) return;
          entry.value = value;
          rememberDynamicFont(value);
        }
        if (response.unchanged && !entry.value)
          throw new FontMetadataError(false);
        entry.etag = response.etag;
        entry.updated = Date.now();
        entry.negative = false;
        entry.unavailable = false;
        entry.failures = 0;
        entry.retryAt = undefined;
      } catch (error) {
        if (controller.signal.aborted) return;
        entry.unavailable = true;
        if (error instanceof FontMetadataError && error.status === 404) {
          entry.negative = true;
          entry.updated = Date.now();
          if (!entry.value) entry.etag = undefined;
          clearTimeout(entry.retry);
          entry.retry = setTimeout(() => {
            entry.retry = undefined;
            void this.refresh(id);
          }, 30000);
        } else if (fontMetadataRetry(entry.failures, error)) {
          clearTimeout(entry.retry);
          const delay = fontMetadataRetryDelay(entry.failures++, error);
          entry.retryAt = performance.now() + delay;
          entry.retry = setTimeout(() => {
            entry.retry = undefined;
            void this.refresh(id, true);
          }, delay);
        }
      } finally {
        entry.pending = undefined;
        for (const listener of entry.users) listener();
        this.trim();
        if (controller.signal.aborted && entry.users.size)
          queueMicrotask(() => void this.refresh(id, true));
      }
    })();
    return entry.pending;
  }
  withdraw(id: string) {
    const entry = this.entries.get(id);
    if (!entry?.value) return;
    entry.value = {
      ...entry.value,
      status: "withdrawn",
      selectable: false,
      pasteAllowed: false,
      renderAllowed: false,
      manifest: null,
      specimen: null,
      assetBasePath: null,
    };
    rememberDynamicFont(entry.value);
    entry.controller?.abort();
    for (const listener of entry.users) listener();
  }
  private trim(reserve = 0) {
    const idle = [...this.entries].filter(
      ([, e]) => !e.users.size && !e.pending,
    );
    while (
      idle.length &&
      (idle.length > 128 || this.entries.size + reserve > 512)
    ) {
      const [id, e] = idle.shift()!;
      clearTimeout(e.retry);
      this.entries.delete(id);
    }
  }
}
export const dynamicFontMetadata = new DynamicFontMetadata();

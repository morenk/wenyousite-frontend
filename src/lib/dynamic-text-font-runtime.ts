import { isDynamicFontRevoked } from "./dynamic-font-revocations";
import { subscribeDynamicFonts } from "./dynamic-text-font-state";
import { dynamicFontMetadata } from "@/api/dynamic-font-metadata";
import { dynamicFontAssetTransport } from "@/api/text-font-dynamic-transport";
import {
  FontMetadataError,
  fontMetadataRetry,
  fontMetadataRetryDelay,
} from "@/api/hooks/text-font-recovery";
import { sharedThreadFontCache } from "./thread-font-cache";
import { FontAssetLoader, FontResourceError, type FontAssetDescriptor, type FontAssetProgress } from "./thread-font-assets";
import {
  installThreadFontFace,
  requiredFontShards,
  verifyFontBytes,
} from "./thread-font-binary";
import { threadFontNetwork } from "./thread-font-network";
import {
  sharedFontResidency,
  onFontCapacityAvailable,
} from "./thread-font-shared-residency";
import {
  dynamicFontAssetPath,
  parseDynamicFontManifest,
  type DynamicFontAsset,
  type DynamicFontManifest,
  type DynamicFontPolicy,
  type DynamicFontShard,
} from "./dynamic-text-font-protocol";
import type { DynamicFontDescriptor } from "./dynamic-text-font-state";
import type { ResidentFont } from "./thread-font-residency";
import type { FontSessionResult } from "./thread-font-session";
export interface FontDownloadSnapshot { status: FontSessionResult["status"]; started: boolean; receivedBytes: number; totalBytes: number | null; phase: "preparing" | "downloading" | "applying" }
const fallback = "var(--wenyou-font-body-family, system-ui)";
type ManifestEntry = {
  value: DynamicFontManifest;
  bytes: number;
  users: number;
};
type Lease = { entry: ResidentFont; release: () => void };
type Demand = {
  id: string;
  scope?: symbol;
  text: string;
  emit: (value: FontSessionResult) => void;
  abort: AbortController;
  holds: Map<string, Lease>;
  metadataRelease: () => void;
  manifest?: ManifestEntry;
  manifestHash?: string;
  parts?: DynamicFontShard[];
  running: boolean;
  retry?: ReturnType<typeof setTimeout>;
  failures: number;
  capacityWaiting: boolean;
  status: FontSessionResult["status"];
  transfers: Map<string, FontAssetProgress | null>;
  networkStarted: boolean;
  planReady: boolean;
};
/** 版本级可见需求；目录追加不销毁 loader、窗口、注册或退避。 */
export class DynamicTextFontRuntime {
  private readonly demands = new Set<Demand>();
  private readonly downloadListeners = new Set<{ id: string; scope: symbol; hasDemand: boolean; listener: (value: FontDownloadSnapshot) => void }>();
  private readonly manifests = new Map<string, ManifestEntry>();
  private readonly sfntBytes = new Map<string, number>();
  private readonly tasks = new Map<
    string,
    {
      promise: Promise<void>;
      abort: AbortController;
      entry: ResidentFont;
      versionId: string;
    }
  >();
  private readonly binary = sharedThreadFontCache();
  private loader?: FontAssetLoader;
  private policy?: DynamicFontPolicy;
  private capacityQueued = false;
  private readonly releaseRevocations: () => void;
  private readonly releaseCapacity: () => void;
  constructor() {
    this.releaseRevocations = subscribeDynamicFonts(() => {
      for (const demand of this.demands)
        if (isDynamicFontRevoked(demand.id)) this.withdrawDemand(demand);
    });
    this.releaseCapacity = onFontCapacityAvailable(() => {
      if (this.capacityQueued) return;
      this.capacityQueued = true;
      queueMicrotask(() => {
        this.capacityQueued = false;
        for (const demand of this.demands)
          if (!demand.running && demand.capacityWaiting)
            void this.attempt(demand);
      });
    });
  }
  dispose() {
    this.releaseCapacity();
    this.releaseRevocations();
    for (const demand of [...this.demands]) {
      demand.abort.abort();
      demand.metadataRelease();
      clearTimeout(demand.retry);
      this.clear(demand);
    }
    this.demands.clear();
    this.downloadListeners.clear();
    this.loader?.dispose();
    this.manifests.clear();
  }
  get snapshot() {
    return {
      demands: this.demands.size,
      manifests: this.manifests.size,
      manifestBytes: [...this.manifests.values()].reduce(
        (sum, v) => sum + v.bytes,
        0,
      ),
      residency: sharedFontResidency().snapshot,
      downloads: threadFontNetwork().snapshot,
      assets: this.loader?.snapshot,
    };
  }
  watch(id: string, text: string, emit: Demand["emit"], scope?: symbol): () => void {
    if (isDynamicFontRevoked(id)) {
      emit({ family: fallback, status: "fallback" });
      return () => {};
    }
    const demand: Demand = {
      id,
      scope,
      text,
      emit,
      abort: new AbortController(),
      holds: new Map(),
      metadataRelease: () => {},
      running: false,
      failures: 0,
      capacityWaiting: false,
      status: "loading",
      transfers: new Map(), networkStarted: false, planReady: false,
    };
    this.demands.add(demand);
    this.report(demand, "loading");
    demand.metadataRelease = dynamicFontMetadata.watch(id, () => {
      const value = dynamicFontMetadata.get(id);
      if (value?.status === "withdrawn") {
        this.withdrawDemand(demand);
        return;
      }
      void this.attempt(demand);
    });
    void this.attempt(demand);
    return () => {
      this.demands.delete(demand);
      demand.abort.abort();
      clearTimeout(demand.retry);
      demand.metadataRelease();
      this.clear(demand);
      this.broadcast(demand.id);
    };
  }
  private withdrawDemand(demand: Demand) {
    demand.status = "fallback";
    this.emitDownload(demand.id);
    demand.emit({ family: fallback, status: "fallback" });
    demand.abort.abort();
    clearTimeout(demand.retry);
    this.clear(demand);
    this.demands.delete(demand);
    demand.metadataRelease();
  }
  async specimen(descriptor: DynamicFontDescriptor, signal: AbortSignal) {
    if (
      isDynamicFontRevoked(descriptor.versionId) ||
      !descriptor.renderAllowed ||
      !descriptor.specimen
    )
      throw new FontResourceError("font-withdrawn");
    return this.bytes(descriptor, descriptor.specimen, signal);
  }
  private clear(demand: Demand) {
    for (const hold of demand.holds.values()) hold.release();
    demand.holds.clear();
    if (demand.manifest) {
      demand.manifest.users--;
      demand.manifest = undefined;
    }
    demand.parts = undefined;
    for (const task of this.tasks.values())
      if (!task.entry.references) task.abort.abort();
  }
  private alive(demand: Demand) {
    return this.demands.has(demand) && !demand.abort.signal.aborted;
  }
  private report(demand: Demand, status: FontSessionResult["status"]) {
    if (!this.alive(demand)) return;
    demand.status = status;
    this.broadcast(demand.id);
  }
  private broadcast(id: string) {
    const demands = [...this.demands].filter(
      (demand) => demand.id === id && this.alive(demand),
    );
    const families =
      dynamicFontMetadata.get(id)?.status === "withdrawn"
        ? []
        : [
            ...new Set(
              demands.flatMap((demand) =>
                [...demand.holds.values()]
                  .filter(
                    (hold) =>
                      sharedFontResidency().has(hold.entry) &&
                      hold.entry.dispose,
                  )
                  .map((hold) => '"' + hold.entry.key.split(":").at(-1) + '"'),
              ),
            ),
          ];
    for (const demand of demands)
      demand.emit({
        family: [...families, fallback].join(", "),
        status: demand.status,
      });
    this.emitDownload(id);
  }
  /** 仅观察现有需求，不创建字体请求；供作者主动应用后的轻量状态条订阅。 */
  subscribeDownload(id: string, scope: symbol, listener: (value: FontDownloadSnapshot) => void) {
    const subscription = { id, scope, listener, hasDemand: false };
    this.downloadListeners.add(subscription);
    return () => { this.downloadListeners.delete(subscription); };
  }
  private emitDownload(id: string) {
    for (const subscription of this.downloadListeners) {
      if (subscription.id !== id) continue;
      const demands = [...this.demands].filter(d => d.id === id && d.scope === subscription.scope && this.alive(d));
      if (!demands.length) {
        // 空光标尚未产生需求时，同字体的阅读事件不能提前解除作者订阅。
        if (!subscription.hasDemand) continue;
        queueMicrotask(() => {
          if (!this.downloadListeners.has(subscription) || [...this.demands].some(d => d.id === id && d.scope === subscription.scope && this.alive(d))) return;
          subscription.listener({ status: "ready", started: false, receivedBytes: 0, totalBytes: 0, phase: "applying" });
        });
        continue;
      }
      subscription.hasDemand = true;
      const transfers = new Map<string, FontAssetProgress | null>();
      for (const demand of demands) for (const [hash, value] of demand.transfers) {
        const previous = transfers.get(hash);
        if (value?.phase === "cached" && previous && previous.phase !== "cached") continue;
        if (value || !transfers.has(hash)) transfers.set(hash, value);
      }
      const values = [...transfers.values()];
      const receivedBytes = values.reduce((sum, item) => sum + (item?.receivedBytes ?? 0), 0);
      const planReady = demands.every(d => d.planReady || d.status === "ready");
      const totalBytes = planReady && values.every(Boolean) ? values.reduce((sum, item) => sum + (item?.totalBytes ?? 0), 0) : null;
      const preparingMetadata = !dynamicFontMetadata.get(id) && dynamicFontMetadata.assetsAvailable(id);
      const started = demands.some(d => d.networkStarted);
      const value: FontDownloadSnapshot = { status: preparingMetadata ? "loading" : demands.every(d => d.status === "ready") ? "ready" : demands.some(d => d.status === "loading") ? "loading" : "fallback", started, receivedBytes, totalBytes, phase: !planReady || !started ? "preparing" : totalBytes !== null && receivedBytes >= totalBytes ? "applying" : "downloading" };
      try { subscription.listener(value); } catch { /* 反馈订阅不影响字体注册。 */ }
    }
  }
  private transferProgress(asset: FontAssetDescriptor, progress: FontAssetProgress) {
    if (asset.path.endsWith(".png")) return;
    const changed = new Set<string>();
    for (const demand of this.demands) {
      if (!this.alive(demand) || !demand.transfers.has(asset.sha256)) continue;
      demand.transfers.set(asset.sha256, progress);
      if (progress.phase === "receiving") demand.networkStarted = true;
      changed.add(demand.id);
    }
    for (const id of changed) this.emitDownload(id);
  }
  private async prepare(signal: AbortSignal) {
    const policy = await dynamicFontMetadata.policy(signal);
    this.policy = policy;
    const scheduler = threadFontNetwork();
    scheduler.updatePolicy({
      concurrency: Math.min(2, policy.web.network.maxConcurrent),
      windowMs: 60000,
      requestsPerWindow: Math.min(64, policy.web.network.maxRequests),
      bytesPerWindow: Math.min(16777216, policy.web.network.maxBytes),
      originalBytesPerWindow: 0,
    });
    sharedFontResidency().tightenPolicy({
      faces: policy.web.residency.maxFaces,
      bytes: policy.web.residency.maxSfntBytes,
    });
    if (!this.loader)
      this.loader = new FontAssetLoader({
        base:
          typeof location === "undefined"
            ? "http://localhost"
            : location.origin,
        transport: async (input, init) => {
          const response = await dynamicFontAssetTransport(input, init);
          if (response.status === 410) {
            const id = /\/versions\/(tfv_[a-f0-9]{32})\//u.exec(
              String(input),
            )?.[1];
            if (id) dynamicFontMetadata.withdraw(id);
          }
          return response;
        },
        onProgress: (asset, progress) => this.transferProgress(asset, progress),
        cache: this.binary,
        scheduler,
        timeoutMs: 15000,
        transferTimeout: {
          mode: "progress",
          firstByteMs: 15000,
          idleMs: 15000,
          maxDurationMs: 600000,
        },
        cacheBytes: policy.diskCacheBytes,
        retryBaseMs: 1000,
        retryMaxMs: 60000,
        verify: verifyFontBytes,
        protectedHashes: () =>
          new Set(
            [...this.demands].flatMap((d) => [
              ...(d.manifest && d.manifestHash ? [d.manifestHash] : []),
              ...(d.parts ?? []).map((p) => p.web.sha256),
            ]),
          ),
        resourceKey: (a) => a.path,
        maxFailures: 512,
      });
    await this.loader.tightenCacheBytes(policy.diskCacheBytes);
    return this.loader;
  }
  private async bytes(
    descriptor: DynamicFontDescriptor,
    asset: DynamicFontAsset,
    signal: AbortSignal,
  ) {
    if (isDynamicFontRevoked(descriptor.versionId))
      throw new FontResourceError("font-withdrawn");
    const path = dynamicFontAssetPath(descriptor, asset);
    const privatePreview = path.startsWith("/api/v1/admin/text-fonts/");
    // 描述符暂时不可核验时只复用已核验缓存；不据旧描述符发起资产请求。
    if (
      !privatePreview &&
      !dynamicFontMetadata.assetsAvailable(descriptor.versionId)
    ) {
      const cached = await this.binary.get(asset.sha256);
      if (signal.aborted) throw new DOMException("Released", "AbortError");
      if (cached && (await verifyFontBytes(cached, asset))) return cached;
      throw new FontResourceError("metadata-unavailable");
    }
    const loader = await this.prepare(signal);
    return loader.get(
      {
        ...asset,
        path,
        cacheable: !privatePreview,
        contentType:
          asset.format === "json"
            ? "application/json"
            : asset.format === "png"
              ? "image/png"
              : "font/" + asset.format,
      },
      signal,
    );
  }
  private async manifest(descriptor: DynamicFontDescriptor, demand: Demand) {
    const asset = descriptor.manifest!;
    if (demand.manifest && demand.manifestHash === asset.sha256)
      return demand.manifest.value;
    let entry = this.manifests.get(asset.sha256);
    if (!entry) {
      demand.transfers.set(asset.sha256, { phase: "queued", receivedBytes: 0, totalBytes: asset.bytes });
      const bytes = await this.bytes(descriptor, asset, demand.abort.signal);
      if (
        !this.alive(demand) ||
        dynamicFontMetadata.get(demand.id)?.status === "withdrawn"
      )
        throw new DOMException("Released", "AbortError");
      let value: DynamicFontManifest;
      try {
        value = parseDynamicFontManifest(
          JSON.parse(new TextDecoder().decode(bytes)),
        );
      } catch {
        this.loader?.quarantine(
          dynamicFontAssetPath(descriptor, asset),
          "font-manifest",
        );
        throw new FontResourceError("font-manifest");
      }
      let usage = [...this.manifests.values()].reduce(
        (sum, v) => sum + v.bytes,
        0,
      );
      for (const [key, candidate] of this.manifests) {
        if (usage + bytes.byteLength <= 16777216 && this.manifests.size < 128)
          break;
        if (!candidate.users) {
          usage -= candidate.bytes;
          this.manifests.delete(key);
        }
      }
      if (usage + bytes.byteLength > 16777216 || this.manifests.size >= 128)
        throw new FontResourceError(
          "manifest-capacity",
          performance.now() + 1000,
        );
      entry = this.manifests.get(asset.sha256) ?? {
        value,
        bytes: bytes.byteLength,
        users: 0,
      };
      this.manifests.set(asset.sha256, entry);
    }
    if (demand.manifest) demand.manifest.users--;
    entry.users++;
    demand.manifest = entry;
    demand.manifestHash = asset.sha256;
    this.manifests.delete(asset.sha256);
    this.manifests.set(asset.sha256, entry);
    return entry.value;
  }
  private async attempt(demand: Demand) {
    if (!this.alive(demand) || demand.running) return;
    const descriptor = dynamicFontMetadata.get(demand.id);
    if (!descriptor?.renderAllowed || !descriptor.manifest) {
      this.clear(demand);
      this.report(demand, "fallback");
      return;
    }

    demand.running = true;
    this.report(demand, "loading");
    demand.capacityWaiting = false;
    clearTimeout(demand.retry);
    try {
      if (dynamicFontMetadata.assetsAvailable(demand.id))
        await this.prepare(demand.abort.signal);
      else if (!this.policy)
        throw new FontResourceError("metadata-unavailable");
      if (
        demand.parts?.length &&
        demand.parts.every((p) => {
          const entry = demand.holds.get(p.web.sha256 + ":" + p.family)?.entry;
          return entry && sharedFontResidency().has(entry) && entry.dispose;
        })
      ) {
        this.report(demand, "ready");
        return;
      }
      const manifest = await this.manifest(descriptor, demand);
      if (
        !this.alive(demand) ||
        dynamicFontMetadata.get(demand.id)?.status === "withdrawn"
      )
        return;
      demand.parts = requiredFontShards(manifest.shards, demand.text);
      if (!demand.parts.length) {
        this.clear(demand);
        throw new FontResourceError("missing-glyph");
      }
      for (const asset of [...manifest.notices, ...demand.parts.map(part => part.web)]) {
        if (!demand.transfers.has(asset.sha256)) demand.transfers.set(asset.sha256, { phase: "queued", receivedBytes: 0, totalBytes: asset.bytes });
      }
      demand.planReady = true;
      this.emitDownload(demand.id);
      for (const notice of manifest.notices)
        await this.bytes(descriptor, notice, demand.abort.signal);
      const results = await Promise.allSettled(
        demand.parts.map(async (part) => {
          const key = part.web.sha256 + ":" + part.family;
          let hold = demand.holds.get(key);
          if (hold && !sharedFontResidency().has(hold.entry)) {
            hold.release();
            demand.holds.delete(key);
            hold = undefined;
          }
          if (!hold) {
            hold = await sharedFontResidency().acquire(
              {
                key,
                fontId: demand.id,
                bytes: this.sfntBytes.get(part.web.sha256) ?? part.mobile.bytes,
                original: false,
              },
              demand.abort.signal,
              false,
            );
            if (!this.alive(demand)) {
              hold.release();
              return;
            }
            demand.holds.set(key, hold);
          }
          if (hold.entry.dispose) {
            if (!demand.transfers.get(part.web.sha256)?.receivedBytes) demand.transfers.set(part.web.sha256, { phase: "cached", receivedBytes: 0, totalBytes: 0 });
            return;
          }
          const entry = hold.entry;
          let task = this.tasks.get(key);
          if (task?.abort.signal.aborted) task = undefined;
          if (!task) {
            const abort = new AbortController();
            const promise = (async () => {
              const bytes = await this.bytes(
                descriptor,
                part.web,
                abort.signal,
              );
              const header = new DataView(bytes);
              if (
                bytes.byteLength < 48 ||
                header.getUint32(0) !== 0x774f4632 ||
                header.getUint32(8) !== bytes.byteLength ||
                header.getUint32(16) < 12
              ) {
                this.loader?.quarantine(
                  dynamicFontAssetPath(descriptor, part.web),
                  "font-header",
                );
                throw new FontResourceError("font-header");
              }
              const size = Math.max(part.mobile.bytes, header.getUint32(16));
              if (size > (this.policy?.web.residency.maxSfntBytes ?? 16777216))
                throw new FontResourceError("font-size");
              if (size > entry.bytes) {
                this.sfntBytes.set(part.web.sha256, size);
                while (this.sfntBytes.size > 1024)
                  this.sfntBytes.delete(this.sfntBytes.keys().next().value!);
                throw new FontResourceError(
                  "font-reestimate",
                  performance.now(),
                );
              }
              if (abort.signal.aborted || !entry.references) return;
              let dispose: () => void;
              try {
                dispose = await installThreadFontFace(part, bytes);
              } catch {
                this.loader?.quarantine(
                  dynamicFontAssetPath(descriptor, part.web),
                  "font-decode",
                );
                throw new FontResourceError("font-decode");
              }
              if (abort.signal.aborted || !entry.references) {
                dispose();
                return;
              }
              sharedFontResidency().installed(entry, dispose);
            })().finally(() => {
              if (this.tasks.get(key)?.abort === abort) this.tasks.delete(key);
            });
            task = { promise, abort, entry, versionId: descriptor.versionId };
            this.tasks.set(key, task);
          }
          try {
            await task.promise;
          } catch (error) {
            if (!entry.dispose) {
              hold.release();
              demand.holds.delete(key);
            }
            if (
              task.versionId !== demand.id &&
              dynamicFontMetadata.get(task.versionId)?.status === "withdrawn" &&
              error instanceof FontResourceError &&
              error.retryAt === undefined
            ) {
              throw new FontResourceError("alias-withdrawn", performance.now());
            }
            throw error;
          }
        }),
      );
      const failure = results.find((result) => result.status === "rejected");
      if (failure?.status === "rejected") throw failure.reason;
      this.report(demand, "ready");
      demand.failures = 0;
    } catch (error) {
      if (!this.alive(demand)) return;
      this.report(demand, "fallback");
      demand.capacityWaiting =
        error instanceof Error && error.message === "resident-capacity";
      const at = error instanceof FontResourceError ? error.retryAt : undefined;
      if (at !== undefined || fontMetadataRetry(demand.failures, error)) {
        demand.retry = setTimeout(
          () => void this.attempt(demand),
          at !== undefined
            ? Math.max(1, at - performance.now())
            : fontMetadataRetryDelay(demand.failures++, error),
        );
      } else if (error instanceof FontMetadataError && error.status === 410)
        dynamicFontMetadata.withdraw(demand.id);
    } finally {
      demand.running = false;
    }
  }
}
let runtime: DynamicTextFontRuntime | undefined;
export function dynamicTextFontRuntime() {
  return (runtime ??= new DynamicTextFontRuntime());
}

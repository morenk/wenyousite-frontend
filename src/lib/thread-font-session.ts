import { normalizeTextFont } from "./markdown-text-font";
import { IndexedDbThreadFontCache, type ThreadFontAssetCache } from "./thread-font-cache";
import { FontAssetLoader, FontResourceError } from "./thread-font-assets";
import { FontDownloadScheduler, type FontDownloadPolicy } from "./thread-font-scheduler";
import { FontResidency, type FontResidencyPolicy, type ResidentFont } from "./thread-font-residency";
import { asset, threadFontManifestSchema, verifyFontBytes, validatedFontBase, requiredFontShards, systemFamily, type ThreadFontCatalog, type ThreadFontManifest, type ThreadFontShard } from "./thread-font-protocol";

/** 内部规范化配置；由已提交的独立策略契约适配，不改变旧manifest字段含义。 */
export interface FontSessionPolicy {
  manifestSha256: string;
  download: FontDownloadPolicy;
  residency: FontResidencyPolicy;
  timeoutMs: number; cacheBytes: number; retryBaseMs: number; retryMaxMs: number; maxAssetBytes: number;
}
export interface FontSessionResult { family: string; status: "loading" | "ready" | "fallback"; reason?: string }
interface Demand {
  id: symbol; fontId: string; text: string; abort: AbortController; emit: (result: FontSessionResult) => void;
  source: Source; holds: Map<string, { entry: ResidentFont; release: () => void }>;
  parts?: ThreadFontShard[]; running: boolean; retry?: ReturnType<typeof setTimeout>; retryNeeded: boolean; capacityWaiting: boolean;
}
interface Source { key: string; catalog: ThreadFontCatalog; policy: FontSessionPolicy; loader: FontAssetLoader; manifest?: ThreadFontManifest }
interface FaceTask { promise: Promise<void>; abort: AbortController; entry: ResidentFont }
const installFont = async (part: ThreadFontShard, bytes: ArrayBuffer) => {
  const face = new FontFace(part.family, bytes, { unicodeRange: part.unicodeRanges.join(","), weight: "400", style: "normal", display: "swap" });
  await face.load(); document.fonts.add(face); return () => { document.fonts.delete(face); };
};
/** 可见需求持有分片引用；只保留一个目录代次、有限驻留集和进行中的二进制。 */
export class ThreadFontSession {
  private source?: Source;
  private scheduler?: FontDownloadScheduler;
  private residency?: FontResidency;
  private demands = new Map<symbol, Demand>();
  private faces = new Map<string, FaceTask>();
  private listeners = false;
  private capacityTimer?: ReturnType<typeof setTimeout>;
  private capacityChanged = () => {
    if (this.capacityTimer) return;
    this.capacityTimer = setTimeout(() => { this.capacityTimer = undefined; for (const demand of this.demands.values()) if (demand.capacityWaiting) void this.attempt(demand); }, 0);
  };
  private sfntSizes = new Map<string, number>();
  private registrationBytes = 0;
  private peakRegistrationBytes = 0;
  private readonly connectionChanged = () => {
    this.scheduler?.setPaused(typeof navigator !== "undefined" && navigator.onLine === false);
    this.wake();
  };
  constructor(private readonly transport: typeof fetch = (...args) => fetch(...args), private readonly cache: ThreadFontAssetCache = new IndexedDbThreadFontCache(), private readonly install: (part: ThreadFontShard, bytes: ArrayBuffer) => Promise<(() => void) | void> = installFont, private readonly options: {random?:()=>number; scheduler?: FontDownloadScheduler} = {}) { this.scheduler = options.scheduler; }
  get snapshot() {
    return { demands: this.demands.size, waitingForCapacity: [...this.demands.values()].filter(demand=>demand.capacityWaiting).length, faceTasks: this.faces.size, manifests: this.source?.manifest ? 1 : 0,
      registrationBytes: this.registrationBytes, peakRegistrationBytes: this.peakRegistrationBytes,
      residency: this.residency?.snapshot, downloads: this.scheduler?.snapshot, assets: this.source?.loader.snapshot,
      protectedHashes: this.protectedHashes().size };
  }
  watch(catalog: ThreadFontCatalog | null | undefined, policy: FontSessionPolicy | null | undefined, fontId: string, text: string, emit: Demand["emit"]): () => void {
    const base = validatedFontBase(catalog?.assetBaseUrl ?? null);
    const descriptor = asset.safeParse(catalog?.manifest);
    if (!catalog || catalog.fontVersion !== 1 || !Array.isArray(catalog.fonts) || !policy || !base || !descriptor.success || policy.manifestSha256 !== descriptor.data.sha256) {
      this.invalidate(); emit({family:systemFamily,status:"fallback",reason:"source-unavailable"}); return () => {};
    }
    const key = base + descriptor.data.sha256 + JSON.stringify([catalog.catalogVersion, catalog.fonts.map(font => [font?.id, font?.availability]), policy]);
    if (this.source?.key !== key) {
      this.invalidate();
      // 窗口账本跨目录代次保留；目录切换不刷新流量额度。
      if (this.scheduler) this.scheduler.updatePolicy(policy.download); else this.scheduler = new FontDownloadScheduler(policy.download);
      this.residency = new FontResidency(policy.residency, this.capacityChanged);
      const loader = new FontAssetLoader({base,transport:this.transport,cache:this.cache,scheduler:this.scheduler,
        timeoutMs:policy.timeoutMs,cacheBytes:policy.cacheBytes,retryBaseMs:policy.retryBaseMs,retryMaxMs:policy.retryMaxMs,
        verify:verifyFontBytes,protectedHashes:()=>this.protectedHashes(),random:this.options.random});
      this.source = {key,catalog,policy,loader};
    }
    if (!normalizeTextFont(fontId) || !text || !catalog.fonts.some(font=>font.id===fontId&&font.availability==="ready")) {
      for (const demand of [...this.demands.values()]) if (demand.fontId===fontId) { demand.emit({family:systemFamily,status:"fallback",reason:"unavailable"});this.release(demand); }
      this.residency?.invalidate(fontId);emit({family:systemFamily,status:"fallback",reason:"unavailable"});return()=>{};
    }
    const demand: Demand = {id:Symbol(),fontId,text,emit,source:this.source!,abort:new AbortController(),holds:new Map(),running:false,retryNeeded:false,capacityWaiting:false};
    this.demands.set(demand.id,demand);this.listen();
    emit({family:this.family(fontId),status:"loading"});void this.attempt(demand);
    return()=>this.release(demand);
  }
  wake() { for (const demand of this.demands.values()) if(demand.retryNeeded) void this.attempt(demand); }
  invalidate() {
    for (const demand of [...this.demands.values()]) { demand.emit({family:systemFamily,status:"fallback",reason:"source-unavailable"});this.release(demand); }
    this.source?.loader.dispose(); this.source=undefined; this.sfntSizes.clear(); this.residency?.invalidate();
  }
  private listen() {
    if (this.listeners || typeof window==="undefined") return;
    this.listeners=true;window.addEventListener("focus",this.connectionChanged);window.addEventListener("online",this.connectionChanged);window.addEventListener("offline",this.connectionChanged);document.addEventListener("visibilitychange",this.connectionChanged);
    this.scheduler?.setPaused(navigator.onLine===false);
  }
  private release(demand: Demand) {
    if (!this.demands.delete(demand.id)) return;
    clearTimeout(demand.retry);demand.abort.abort();for(const hold of demand.holds.values())hold.release();demand.holds.clear();
    for(const task of this.faces.values())if(!task.entry.references)task.abort.abort();
    if(!this.demands.size){ clearTimeout(this.capacityTimer); this.capacityTimer=undefined; }
    if(!this.demands.size&&this.listeners){window.removeEventListener("focus",this.connectionChanged);window.removeEventListener("online",this.connectionChanged);window.removeEventListener("offline",this.connectionChanged);document.removeEventListener("visibilitychange",this.connectionChanged);this.listeners=false;}
  }
  private current(demand: Demand) { return this.demands.has(demand.id)&&this.source===demand.source&&!demand.abort.signal.aborted; }
  private family(fontId: string) { return [...(this.residency?.values().filter(entry=>entry.fontId===fontId&&entry.dispose).map(entry=>'"'+entry.key.split(":").at(-1)+'"')??[]),systemFamily].join(", "); }
  private protectedHashes() {
    const hashes=new Set<string>();
    for(const demand of this.demands.values()) {
      if(demand.source.catalog.manifest)hashes.add(demand.source.catalog.manifest.sha256);
      const font=demand.source.manifest?.fonts.find(font=>font.id===demand.fontId);
      if(font?.availability==="ready")for(const notice of font.notices)hashes.add(notice.sha256);
      for(const part of demand.parts??[])hashes.add(part.web.sha256);
    }
    return hashes;
  }
  private report(demand: Demand, status: FontSessionResult["status"], reason?: string) {
    if(this.current(demand))demand.emit({family:this.family(demand.fontId),status,...(reason?{reason}:{})});
  }
  private refresh(fontId: string) {
    for(const demand of this.demands.values())if(demand.fontId===fontId) {
      const ready=demand.parts?.length&&demand.parts.every(part=>demand.holds.get(part.web.sha256)?.entry.dispose);
      this.report(demand,demand.parts?.length===0?"fallback":ready?"ready":"loading",demand.parts?.length===0?"missing-glyph":undefined);
    }
  }
  private async attempt(demand: Demand) {
    if(!this.current(demand)||demand.running)return;
    clearTimeout(demand.retry);demand.retry=undefined;demand.running=true;demand.retryNeeded=false;demand.capacityWaiting=false;
    const {source}=demand;
    try {
      if(!source.manifest){
        const bytes=await source.loader.get(source.catalog.manifest!,demand.abort.signal);
        if(!this.current(demand))return;
        if(!source.manifest) {
          try {
            source.manifest=threadFontManifestSchema.parse(JSON.parse(new TextDecoder().decode(bytes)));
            if(source.manifest.catalogVersion!==source.catalog.catalogVersion)throw Error("catalog-version");
          }catch{source.manifest=undefined;source.loader.quarantine(source.catalog.manifest!.sha256,"manifest-invalid");throw new FontResourceError("manifest-invalid")}
        }
      }
      const font=source.manifest.fonts.find(font=>font.id===demand.fontId);
      if(!font||font.availability!=="ready")throw new FontResourceError("unavailable");
      demand.parts=requiredFontShards(font.shards,demand.text);
      if(!demand.parts.length)throw new FontResourceError("missing-glyph");
      const results=await Promise.allSettled(demand.parts.map(async part=>{
        if(part.web.bytes>source.policy.maxAssetBytes&&font.deliveryMode!=="original")throw new FontResourceError("asset-budget");
        if(!part.mobile)throw new FontResourceError("resident-metadata");
        let hold=demand.holds.get(part.web.sha256);
        if(!hold){hold=await this.residency!.acquire({key:part.web.sha256+":"+part.family,fontId:font.id,bytes:this.sfntSizes.get(part.web.sha256)??part.mobile.bytes,original:font.deliveryMode==="original"},demand.abort.signal,false);if(!this.current(demand)){hold.release();return}demand.holds.set(part.web.sha256,hold)}
        if(hold.entry.dispose)return;
        let task=this.faces.get(hold.entry.key);
        if(task?.abort.signal.aborted)task=undefined;
        if(!task){
          const entry=hold.entry,abort=new AbortController();
          const work: FaceTask={entry,abort,promise:Promise.resolve()};
          work.promise=(async()=>{
            for(const notice of font.notices)await source.loader.get(notice,abort.signal);
            const bytes=await source.loader.get(part.web,abort.signal,font.deliveryMode==="original");
            if(abort.signal.aborted||source!==this.source)return;
            if(font.deliveryMode!=="original") {
              const header=new DataView(bytes);
              if(bytes.byteLength<48||header.getUint32(0)!==0x774f4632||header.getUint32(8)!==bytes.byteLength||header.getUint32(16)<12) {
                source.loader.quarantine(part.web.sha256,"font-header");throw new FontResourceError("font-header");
              }
              const sfntBytes=Math.max(part.mobile!.bytes,header.getUint32(16));
              if(sfntBytes>source.policy.residency.bytes){source.loader.quarantine(part.web.sha256,"font-sfnt-budget");throw new FontResourceError("font-sfnt-budget")}
              this.sfntSizes.set(part.web.sha256,sfntBytes);
              if(sfntBytes>entry.bytes)throw new FontResourceError("resident-reestimate",performance.now());
            }
            this.registrationBytes+=bytes.byteLength;this.peakRegistrationBytes=Math.max(this.peakRegistrationBytes,this.registrationBytes);
            try {
              let dispose: (()=>void)|void;
              try {dispose=await this.install(part,bytes)}catch{source.loader.quarantine(part.web.sha256,"font-decode");throw new FontResourceError("font-decode")}
              if(abort.signal.aborted||source!==this.source||!entry.references){dispose?.();return}
              this.residency!.installed(entry,dispose??(()=>{}));this.refresh(font.id);
            }finally{this.registrationBytes-=bytes.byteLength}
          })().finally(()=>{if(this.faces.get(entry.key)===work)this.faces.delete(entry.key)});
          task=work;this.faces.set(entry.key,task);
        }
        try { await task.promise; } catch (error) {
          if (!hold.entry.dispose) { hold.release(); demand.holds.delete(part.web.sha256); }
          throw error;
        }
      }));
      const errors=results.flatMap(result=>result.status==="rejected"?[result.reason]:[]);
      if(errors.length){
        const transient=errors.filter((error):error is FontResourceError=>error instanceof FontResourceError&&error.retryAt!==undefined).sort((a,b)=>a.retryAt!-b.retryAt!);
        throw transient[0]??errors[0];
      }
      this.report(demand,"ready");
    }catch(error){
      if(!this.current(demand))return;
      this.report(demand,"fallback",error instanceof Error?error.message:"unavailable");
      if(error instanceof Error&&error.message==="resident-capacity")demand.capacityWaiting=true;
      if(error instanceof FontResourceError&&error.retryAt!==undefined){
        demand.retryNeeded=true;demand.retry=setTimeout(()=>void this.attempt(demand),Math.max(1,error.retryAt-performance.now()));
      }
    }finally{demand.running=false}
  }
}

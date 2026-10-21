/** 注册输入的驻留预算；引用中的字形不淘汰，释放后按 LRU 回收 FontFace。 */
export interface FontResidencyPolicy { families: number; faces: number; bytes: number; originalBytes: number }
export interface ResidentFont {
  key: string; fontId: string; bytes: number; original: boolean;
  references: number; touched: number; dispose?: () => void;
}
interface Waiting {
  font: Pick<ResidentFont, "key" | "fontId" | "bytes" | "original">;
  signal: AbortSignal; wait: boolean; reject: () => void;
  grant: (font: ResidentFont) => void;
  abort: () => void;
}
export class FontResidency {
  private entries = new Map<string, ResidentFont>();
  private waiting: Waiting[] = [];
  private clock = 0;
  constructor(private readonly policy: FontResidencyPolicy, private readonly available: () => void = () => {}) {}
  tightenPolicy(policy: Partial<FontResidencyPolicy>) {
    let changed=false;
    for(const key of Object.keys(policy) as (keyof FontResidencyPolicy)[]) {const next=Math.min(this.policy[key],policy[key]!);changed ||= next!==this.policy[key];this.policy[key]=next;}
    if(!changed)return;
    const ordered=[...this.entries.values()].sort((a,b)=>Number(!!a.references)-Number(!!b.references)||a.touched-b.touched);
    while(ordered.length&&(this.entries.size>this.policy.faces||this.snapshot.bytes>this.policy.bytes||this.snapshot.originalBytes>this.policy.originalBytes))this.evict(ordered.shift()!);
    this.pump();this.available();
  }
  get snapshot() {
    const values = [...this.entries.values()];
    return { families: new Set(values.map(font => font.fontId)).size, faces: values.filter(font => !!font.dispose).length,
      bytes: values.filter(font => !font.original).reduce((sum, font) => sum + font.bytes, 0),
      originalBytes: values.filter(font => font.original).reduce((sum, font) => sum + font.bytes, 0),
      references: values.reduce((sum, font) => sum + font.references, 0), queued: this.waiting.length };
  }
  acquire(font: Waiting["font"], signal: AbortSignal, wait = true): Promise<{ entry: ResidentFont; release: () => void }> {
    if (font.bytes > (font.original ? this.policy.originalBytes : this.policy.bytes)) return Promise.reject(new Error("resident-asset-size"));
    if (signal.aborted) return Promise.reject(new DOMException("Demand released", "AbortError"));
    return new Promise((resolve, reject) => {
      const request: Waiting = { font, signal, wait, reject: () => {
        this.waiting = this.waiting.filter(item => item !== request); signal.removeEventListener("abort", request.abort); reject(new Error("resident-capacity"));
      }, abort: () => {
        this.waiting = this.waiting.filter(item => item !== request);
        signal.removeEventListener("abort", request.abort);
        reject(new DOMException("Demand released", "AbortError"));
      }, grant: entry => {
        signal.removeEventListener("abort", request.abort);
        let released = false;
        const release = () => {
          if (released) return; released = true;
          signal.removeEventListener("abort", release);
          entry.references--; entry.touched = ++this.clock;
          if (!entry.references && !entry.dispose && this.entries.get(entry.key) === entry) this.evict(entry);
          this.pump(); if (!entry.references) this.available();
        };
        signal.addEventListener("abort", release, { once: true });
        resolve({ entry, release });
      } };
      signal.addEventListener("abort", request.abort, { once: true });
      this.waiting.push(request); this.pump();
    });
  }
  /** 异步解码完成时检查预留仍有效；已撤回的字形立即移除。 */
  installed(entry: ResidentFont, dispose: () => void): boolean {
    if (this.entries.get(entry.key) !== entry) { dispose(); return false; }
    if(entry.dispose){dispose();return true;}
    entry.dispose = dispose; return true;
  }
  has(entry: ResidentFont) { return this.entries.get(entry.key) === entry; }
  values() { return [...this.entries.values()]; }
  invalidate(fontId?: string) {
    for (const entry of [...this.entries.values()]) if (fontId === undefined || entry.fontId === fontId) this.evict(entry);
    this.pump();
  }
  private evict(entry: ResidentFont) {
    this.entries.delete(entry.key); entry.dispose?.(); entry.dispose = undefined;
  }
  private fits(font: Waiting["font"]) {
    const usage = this.snapshot;
    return this.entries.size < this.policy.faces && (this.entries.size === 0 || [...this.entries.values()].some(entry => entry.fontId === font.fontId) || usage.families < this.policy.families) &&
      (font.original ? usage.originalBytes + font.bytes <= this.policy.originalBytes : usage.bytes + font.bytes <= this.policy.bytes);
  }
  private pump() {
    for (const request of [...this.waiting]) {
      if (request.signal.aborted) { request.abort(); continue; }
      let entry = this.entries.get(request.font.key);
      if (!entry) {
        const idle = [...this.entries.values()].filter(font => !font.references).sort((a,b) => a.touched-b.touched);
        while (!this.fits(request.font) && idle.length) this.evict(idle.shift()!);
        if (!this.fits(request.font)) { if (!request.wait) request.reject(); continue; }
        entry = { ...request.font, references: 0, touched: ++this.clock }; this.entries.set(entry.key, entry);
      }
      entry.references++; entry.touched = ++this.clock;
      this.waiting = this.waiting.filter(item => item !== request); request.grant(entry);
    }
  }
}

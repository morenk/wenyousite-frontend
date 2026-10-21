/** 字库下载只限制当前窗口与并发；等待的可见需求不会消耗额度。 */
export interface FontDownloadPolicy {
  concurrency: number;
  windowMs: number;
  requestsPerWindow: number;
  bytesPerWindow: number;
  originalBytesPerWindow: number;
}
interface Job {
  bytes: number;
  original: boolean;
  signal: AbortSignal;
  start: () => Promise<void>;
  cancel: () => void;
  rejectSize: () => void;
}
export class FontDownloadScheduler {
  private jobs: Job[] = [];
  private reservations: { at: number; bytes: number; original: boolean }[] = [];
  private active = 0;
  private paused = false;
  private timer?: ReturnType<typeof setTimeout>;
  readonly stats = { started: 0, peakConcurrent: 0 };
  constructor(private policy: FontDownloadPolicy) {}
  updatePolicy(policy: FontDownloadPolicy) {
    this.policy = { ...policy };
    for (const job of [...this.jobs]) if (job.bytes > (job.original ? policy.originalBytesPerWindow : policy.bytesPerWindow)) job.rejectSize();
    this.pump();
  }
  get snapshot() {
    this.prune();
    return { active: this.active, queued: this.jobs.length, windowRequests: this.reservations.length,
      windowBytes: this.reservations.filter(entry => !entry.original).reduce((sum, entry) => sum + entry.bytes, 0),
      originalWindowBytes: this.reservations.filter(entry => entry.original).reduce((sum, entry) => sum + entry.bytes, 0) };
  }
  setPaused(paused: boolean) { this.paused = paused; this.pump(); }
  run<T>(bytes: number, original: boolean, signal: AbortSignal, task: () => Promise<T>): Promise<T> {
    if (bytes > (original ? this.policy.originalBytesPerWindow : this.policy.bytesPerWindow)) return Promise.reject(new Error("asset-window-size"));
    if (signal.aborted) return Promise.reject(new DOMException("Demand released", "AbortError"));
    return new Promise<T>((resolve, reject) => {
      const job: Job = { bytes, original, signal, rejectSize: () => {
        this.jobs = this.jobs.filter(item => item !== job); signal.removeEventListener("abort", job.cancel); reject(new Error("asset-window-size"));
      }, cancel: () => {
        this.jobs = this.jobs.filter(item => item !== job);
        signal.removeEventListener("abort", job.cancel);
        reject(new DOMException("Demand released", "AbortError"));
        this.pump();
      }, start: async () => {
        signal.removeEventListener("abort", job.cancel);
        try { resolve(await task()); } catch (error) { reject(error); }
      } };
      signal.addEventListener("abort", job.cancel, { once: true });
      this.jobs.push(job); this.pump();
    });
  }
  private prune() { this.reservations = this.reservations.filter(entry => entry.at + this.policy.windowMs > performance.now()); }
  private pump() {
    clearTimeout(this.timer); this.timer = undefined;
    this.prune();
    if (this.paused || !this.jobs.length || this.active >= this.policy.concurrency) return;
    const usage = this.snapshot;
    const index = this.jobs.findIndex(job => this.reservations.length < this.policy.requestsPerWindow &&
      (job.original ? usage.originalWindowBytes + job.bytes <= this.policy.originalBytesPerWindow : usage.windowBytes + job.bytes <= this.policy.bytesPerWindow));
    if (index < 0) {
      const next = this.reservations[0];
      if (next) this.timer = setTimeout(() => this.pump(), Math.max(1, next.at + this.policy.windowMs - performance.now()));
      return;
    }
    const [job] = this.jobs.splice(index, 1);
    if (job!.signal.aborted) { job!.cancel(); return; }
    this.reservations.push({ at: performance.now(), bytes: job!.bytes, original: job!.original });
    this.active++; this.stats.started++; this.stats.peakConcurrent = Math.max(this.stats.peakConcurrent, this.active);
    void job!.start().finally(() => { this.active--; this.pump(); });
    this.pump();
  }
}

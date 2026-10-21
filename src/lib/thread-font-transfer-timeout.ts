/** 网络阶段使用显式超时语义；旧策略的总时长不会因收到分片而续期。 */
export type FontTransferTimeoutPolicy =
  | { mode: "absolute"; timeoutMs: number }
  | { mode: "progress"; firstByteMs: number; idleMs: number; maxDurationMs: number };
export class FontTransferTimeout {
  private readonly controller = new AbortController();
  private phaseTimer?: ReturnType<typeof setTimeout>;
  private totalTimer?: ReturnType<typeof setTimeout>;
  private finished = false;
  private idleDeadline: number;
  private readonly totalDeadline: number;
  private readonly released = () => this.abort(this.demand.reason ?? new DOMException("Demand released", "AbortError"));
  readonly signal = this.controller.signal;
  constructor(private readonly policy: FontTransferTimeoutPolicy, private readonly demand: AbortSignal) {
    const now = performance.now();
    this.idleDeadline = now + (policy.mode === "absolute" ? policy.timeoutMs : policy.firstByteMs);
    this.totalDeadline = now + (policy.mode === "absolute" ? policy.timeoutMs : policy.maxDurationMs);
    if (demand.aborted) { this.released(); return; }
    demand.addEventListener("abort", this.released, { once: true });
    this.phaseTimer = setTimeout(() => this.expired(), this.idleDeadline - now);
    if (policy.mode === "progress") this.totalTimer = setTimeout(() => this.expired(), policy.maxDurationMs);
  }
  /** 回调可能晚于定时器截止；数据块和 EOF 必须先通过单调时钟检查。 */
  check() {
    if (!this.finished && (performance.now() >= this.totalDeadline || performance.now() >= this.idleDeadline)) this.expired();
    if (this.signal.aborted) throw this.signal.reason;
  }
  /** 仅通过流式长度检查的非空响应体续期；响应头和空块不计为进度。 */
  bytesReceived(bytes: number) {
    this.check();
    if (this.finished || bytes <= 0 || this.policy.mode !== "progress") return;
    clearTimeout(this.phaseTimer);
    this.idleDeadline = performance.now() + this.policy.idleMs;
    this.phaseTimer = setTimeout(() => this.expired(), this.policy.idleMs);
  }
  /** 读完响应或离开传输阶段即清除全部计时与需求引用。 */
  complete() {
    this.finished = true;
    clearTimeout(this.phaseTimer); clearTimeout(this.totalTimer);
    this.demand.removeEventListener("abort", this.released);
  }
  private expired() { this.abort(new DOMException("Font transfer timeout", "TimeoutError")); }
  private abort(reason: unknown) {
    if (this.finished) return;
    this.complete(); this.controller.abort(reason);
  }
}

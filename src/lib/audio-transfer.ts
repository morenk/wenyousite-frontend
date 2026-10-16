/** 对齐治理 audio-transfer-policy；仅音频调用，不改变图片传输。 */
export const AUDIO_TRANSFER_TOTAL_MS = 5 * 60_000;
export const AUDIO_TRANSFER_IDLE_MS = 30_000;

export async function withAudioTransfer<T>(
  parent: AbortSignal | undefined,
  timeoutMessage: string,
  task: (signal: AbortSignal, progress: (bytes: number) => void) => Promise<T>,
): Promise<T> {
  parent?.throwIfAborted();
  const controller = new AbortController();
  const signal = controller.signal;
  const abort = () => controller.abort(parent?.reason);
  const timeout = () => controller.abort(new DOMException(timeoutMessage, "TimeoutError"));
  const total = setTimeout(timeout, AUDIO_TRANSFER_TOTAL_MS);
  let idle = setTimeout(timeout, AUDIO_TRANSFER_IDLE_MS);
  let bytes = 0;
  let disposed = false;
  const progress = (next: number) => {
    if (disposed || signal.aborted || !Number.isFinite(next) || next <= bytes) return;
    bytes = next;
    clearTimeout(idle); idle = setTimeout(timeout, AUDIO_TRANSFER_IDLE_MS);
  };
  let rejectAbort: () => void = () => {};
  const aborted = new Promise<never>((_resolve, reject) => {
    rejectAbort = () => reject(signal.reason);
    signal.addEventListener("abort", rejectAbort, { once: true });
  });
  parent?.addEventListener("abort", abort, { once: true });
  try {
    return await Promise.race([aborted, Promise.resolve().then(() => { signal.throwIfAborted(); return task(signal, progress); })]);
  } catch (error) {
    // 内部超时保留 TimeoutError；不能被 XHR 的 abort 事件误认为用户取消。
    if (signal.aborted) throw signal.reason;
    controller.abort(error);
    throw error;
  } finally {
    disposed = true; clearTimeout(total); clearTimeout(idle);
    signal.removeEventListener("abort", rejectAbort);
    parent?.removeEventListener("abort", abort);
  }
}

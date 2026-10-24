/** 创建、恢复和启动只传少量 JSON；避免上传超时后又永远等在恢复查询。二进制上传使用独立的进度续期计时器。 */
export async function withAdminFontDeadline<T>(operation: (signal: AbortSignal) => Promise<T>, upstream?: AbortSignal): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  upstream?.addEventListener("abort", abort, { once: true });
  if (upstream?.aborted) controller.abort();
  const timer = setTimeout(abort, 120_000);
  try { return await operation(controller.signal); }
  finally { clearTimeout(timer); upstream?.removeEventListener("abort", abort); }
}

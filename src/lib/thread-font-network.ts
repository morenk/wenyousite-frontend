import { FontDownloadScheduler } from "./thread-font-scheduler";
/** 目录/策略冷启动即使用保守 v2 窗口；验证后资源请求继续使用同一本账。 */
let scheduler: FontDownloadScheduler | undefined;
export function threadFontNetwork() {
  if (!scheduler) {
    scheduler = new FontDownloadScheduler({ concurrency: 2, windowMs: 60000, requestsPerWindow: 64, bytesPerWindow: 16777216, originalBytesPerWindow: 18410600 });
    if (typeof window !== "undefined") {
      const update = () => scheduler!.setPaused(navigator.onLine === false);
      window.addEventListener("online", update); window.addEventListener("offline", update);
      window.addEventListener("focus", update); document.addEventListener("visibilitychange", update); update();
    }
  }
  return scheduler;
}

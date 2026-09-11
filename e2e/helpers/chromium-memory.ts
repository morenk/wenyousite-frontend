import { readFile } from "node:fs/promises";
import type { Browser } from "@playwright/test";

type Memory = { rssKiB: number; pssKiB: number };
type Snapshot = { atMs: number; total: Memory; byType: Record<string, Memory>; processes: { pid: number; type: string }[] };

/** 仅采样本次Playwright浏览器CDP报告的进程；PSS按共享页分摊，RSS合计可能重复计共享页。 */
export async function observeChromiumMemory(browser: Browser, intervalMs = 150) {
  const session = await browser.newBrowserCDPSession();
  const startedAt = performance.now();
  const read = async (): Promise<Snapshot> => {
    const { processInfo } = await session.send("SystemInfo.getProcessInfo");
    const entries = await Promise.all(processInfo.map(async ({ id, type }: { id: number; type: string }) => {
      if (!Number.isSafeInteger(id) || id <= 0) throw new Error("CDP返回无效进程ID");
      const rollup = await readFile(`/proc/${id}/smaps_rollup`, "utf8");
      const value = (name: string) => {
        const found = rollup.match(new RegExp(`^${name}:\\s+(\\d+) kB$`, "m"));
        if (!found) throw new Error(`进程${id}缺少${name}`);
        return Number(found[1]);
      };
      return { pid: id, type, rssKiB: value("Rss"), pssKiB: value("Pss") };
    }));
    const byType: Record<string, Memory> = {}, total = { rssKiB: 0, pssKiB: 0 };
    for (const entry of entries) {
      const group = byType[entry.type] ??= { rssKiB: 0, pssKiB: 0 };
      group.rssKiB += entry.rssKiB; group.pssKiB += entry.pssKiB;
      total.rssKiB += entry.rssKiB; total.pssKiB += entry.pssKiB;
    }
    return { atMs: performance.now() - startedAt, total, byType, processes: entries.map(({ pid, type }) => ({ pid, type })) };
  };
  const snapshots: Snapshot[] = [], errors: string[] = [];
  try { snapshots.push(await read()); } catch (error) { errors.push(String(error)); }
  let stopped = false;
  const loop = (async () => {
    while (!stopped && snapshots.length) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
      if (stopped) break;
      try { snapshots.push(await read()); } catch (error) { errors.push(String(error)); }
    }
  })();
  let result: Promise<unknown> | null = null;
  return { stop: () => result ??= (async () => {
    stopped = true; await loop; await session.detach();
    if (!snapshots.length) return { available: false, source: "CDP SystemInfo + /proc/PID/smaps_rollup", errors };
    const baseline = snapshots[0], peak = { rssKiB: 0, pssKiB: 0 }, byTypePeak: Record<string, Memory> = {};
    for (const sample of snapshots) {
      peak.rssKiB = Math.max(peak.rssKiB, sample.total.rssKiB); peak.pssKiB = Math.max(peak.pssKiB, sample.total.pssKiB);
      for (const [type, memory] of Object.entries(sample.byType)) {
        const group = byTypePeak[type] ??= { rssKiB: 0, pssKiB: 0 };
        group.rssKiB = Math.max(group.rssKiB, memory.rssKiB); group.pssKiB = Math.max(group.pssKiB, memory.pssKiB);
      }
    }
    return { available: true, source: "CDP SystemInfo + /proc/PID/smaps_rollup", intervalMs,
      observedSamples: snapshots.length, observedSpanMs: snapshots.at(-1)!.atMs - baseline.atMs,
      baseline: baseline.total, observedPeak: peak, observedDelta: { rssKiB: peak.rssKiB - baseline.total.rssKiB, pssKiB: peak.pssKiB - baseline.total.pssKiB },
      byTypeBaseline: baseline.byType, byTypePeak, errors, snapshots };
  })() };
}

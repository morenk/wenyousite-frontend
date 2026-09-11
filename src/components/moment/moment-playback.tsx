"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

const PlaybackContext = createContext<{ blocked: boolean; setOverlay: (open: boolean) => void }>({ blocked: false, setOverlay: () => {} });
const FailureContext = createContext<{ failures: Record<string, boolean>; setFailure: (url: string, failed: boolean) => void } | null>(null);

/** 同一详情的全部评论和轮播共用灯箱状态，Portal 仍在上下文内。 */
export function MomentPlaybackProvider({ children }: { children: ReactNode }) {
  const [blocked, setOverlay] = useState(false);
  const [failures, setFailures] = useState<Record<string, boolean>>({});
  const setFailure = useCallback((url: string, failed: boolean) => setFailures((previous) => ({ ...previous, [url]: failed })), []);
  return <PlaybackContext.Provider value={{ blocked, setOverlay }}><FailureContext.Provider value={{ failures, setFailure }}>{children}</FailureContext.Provider></PlaybackContext.Provider>;
}

export function useMomentOverlay(open: boolean) {
  const { setOverlay } = useContext(PlaybackContext);
  useEffect(() => {
    if (!open) return;
    setOverlay(true);
    return () => setOverlay(false);
  }, [open, setOverlay]);
}

export function useMomentPlayback(allowed: boolean, foreground = false) {
  const { blocked } = useContext(PlaybackContext);
  const ref = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);
  const [pageVisible, setPageVisible] = useState(() => typeof document !== "undefined" && !document.hidden);
  useEffect(() => {
    const update = () => setPageVisible(!document.hidden);
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting && entry.intersectionRatio > 0), { threshold: [0, 0.001] });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return { ref, playing: allowed && visible && pageVisible && (foreground || !blocked) };
}

/** 失败锁存到详情生命周期，轮播切换或灯箱卸载不会偷偷重试。 */
export function useMomentAnimationFailure(url: string) {
  const shared = useContext(FailureContext);
  const [localFailure, setLocalFailure] = useState(false);
  return [shared ? !!shared.failures[url] : localFailure, (failed: boolean) => shared ? shared.setFailure(url, failed) : setLocalFailure(failed)] as const;
}

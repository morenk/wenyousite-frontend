"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { CoverPlaybackSize } from "@/lib/thread-cover-preview";
import { coverPlayback, subscribeCoverPreference, readCoverDataSaver, setCoverDataSaver } from "./cover-playback";

export function useCoverPlayback(enabled: boolean, identity: string) {
  const ref = useRef<HTMLDivElement>(null);
  const generation = useRef(0);
  const [selection, setSelection] = useState<{ identity: string; size: CoverPlaybackSize; generation: number } | null>(null);
  useEffect(() => {
    const node = ref.current;
    if (!enabled || !node) return;
    return coverPlayback.register(node, (active) => {
      if (!active) { setSelection(null); return; }
      const { width, height } = node.getBoundingClientRect();
      // 每次真正选中才取尺寸；无关重渲染、分页追加不更换本次播放源。
      setSelection({ identity, size: { width, height, dpr: window.devicePixelRatio || 1 }, generation: ++generation.current });
    });
  }, [enabled, identity]);
  return { ref, active: enabled && selection?.identity === identity, size: selection?.size, generation: selection?.generation };
}

function subscribePreference(change: () => void) {
  return subscribeCoverPreference(change);
}

export function useCoverDataSaver() {
  const enabled = useSyncExternalStore(subscribePreference, readCoverDataSaver, () => false);
  return { enabled, setEnabled: setCoverDataSaver };
}

"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { coverPlayback, subscribeCoverPreference, readCoverDataSaver, setCoverDataSaver } from "./cover-playback";

export function useCoverPlayback(enabled: boolean, identity: string) {
  const ref = useRef<HTMLDivElement>(null);
  const [activeIdentity, setActiveIdentity] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled || !ref.current) return;
    return coverPlayback.register(ref.current, (active) => setActiveIdentity(active ? identity : null));
  }, [enabled, identity]);
  return { ref, active: enabled && activeIdentity === identity };
}

function subscribePreference(change: () => void) {
  return subscribeCoverPreference(change);
}

export function useCoverDataSaver() {
  const enabled = useSyncExternalStore(subscribePreference, readCoverDataSaver, () => false);
  return { enabled, setEnabled: setCoverDataSaver };
}

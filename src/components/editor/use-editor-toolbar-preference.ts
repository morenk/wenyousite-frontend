"use client";

import { useMemo, useSyncExternalStore } from "react";
import {
  EDITOR_TOOLBAR_CHANGE_EVENT, EDITOR_TOOLBAR_STORAGE_KEY,
  parseEditorToolbarPreference, readEditorToolbarStorage,
} from "@/lib/editor-toolbar-preference";

function subscribe(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === EDITOR_TOOLBAR_STORAGE_KEY || event.key === null) onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(EDITOR_TOOLBAR_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(EDITOR_TOOLBAR_CHANGE_EVENT, onChange);
  };
}
const serverSnapshot = () => null;
export function useEditorToolbarPreference() {
  const raw = useSyncExternalStore(subscribe, readEditorToolbarStorage, serverSnapshot);
  return useMemo(() => parseEditorToolbarPreference(raw), [raw]);
}

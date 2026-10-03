"use client";

import { useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBackdrop, DialogCloseButton, DialogDescription, DialogFooter, DialogPopup, DialogPortal, DialogTitle, DialogViewport } from "@/components/ui/dialog";
import { detectMobileDevice, type MobileDevice } from "@/lib/mobile-device";
import { AppDownloadEntry } from "./app-download-entry";

export const DOWNLOAD_PROMPT_SESSION_KEY = "wenyou:app-download-prompt";

const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

export function MobileDownloadPrompt() {
  const hydrated = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
  return hydrated ? <ClientMobileDownloadPrompt /> : null;
}

function ClientMobileDownloadPrompt() {
  const [device] = useState<MobileDevice | null>(() => detectMobileDevice({
    userAgent: navigator.userAgent, maxTouchPoints: navigator.maxTouchPoints,
    mobileHint: (navigator as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData?.mobile,
  }));
  const [open, setOpen] = useState(() => {
    if (!device) return false;
    try { return sessionStorage.getItem(DOWNLOAD_PROMPT_SESSION_KEY) !== "handled"; }
    catch { return true; }
  });

  function remember() {
    try { sessionStorage.setItem(DOWNLOAD_PROMPT_SESSION_KEY, "handled"); } catch { /* 本次挂载的 open 状态仍避免重复提示。 */ }
  }
  function changeOpen(value: boolean) {
    setOpen(value);
    if (!value) remember();
  }

  return <Dialog open={open} onOpenChange={changeOpen}>
    <DialogPortal><DialogBackdrop /><DialogViewport>
      <DialogPopup className="max-w-sm space-y-5 p-6">
        <div className="flex items-center justify-between gap-4">
          <DialogTitle>温油站 APP</DialogTitle>
          <DialogCloseButton label="关闭下载提示" />
        </div>
        <DialogDescription>{device === "android"
          ? "目前仅支持 Android。可下载安装包，也可以继续使用网页版。"
          : device === "ios" ? "目前仅支持 Android，暂无 iOS 版本。你可以继续使用网页版。"
          : "目前仅支持 Android。你可以继续使用网页版。"}</DialogDescription>
        <DialogFooter className="flex-col items-stretch gap-3 pt-1 text-sm font-bold">
          {device === "android" && <AppDownloadEntry variant="dialog" onAction={remember} />}
          <Button type="button" variant={device === "android" ? "outline" : "default"} className="w-full" onClick={() => changeOpen(false)}>继续使用网页</Button>
        </DialogFooter>
      </DialogPopup>
    </DialogViewport></DialogPortal>
  </Dialog>;
}

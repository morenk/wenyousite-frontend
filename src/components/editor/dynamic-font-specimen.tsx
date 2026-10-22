"use client";
import { useEffect, useRef, useState } from "react";
import { dynamicFontMetadata } from "@/api/dynamic-font-metadata";
import { dynamicTextFontRuntime } from "@/lib/dynamic-text-font-runtime";
import { FontResourceError } from "@/lib/thread-font-assets";
import {
  fontMetadataRetry,
  fontMetadataRetryDelay,
} from "@/api/hooks/text-font-recovery";
import {
  subscribeDynamicFonts,
  type DynamicFontDescriptor,
} from "@/lib/dynamic-text-font-state";
import { isDynamicFontRevoked } from "@/lib/dynamic-font-revocations";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fontSpecimenBounds, type FontSpecimenBounds } from "@/lib/font-specimen-bounds";
/** 可见样张才下载 PNG；选择器从不为样张安装 FontFace。 */
export function DynamicFontSpecimen({
  versionId,
  descriptor,
  compact = false,
  onReady,
}: {
  versionId: string;
  descriptor?: DynamicFontDescriptor;
  compact?: boolean;
  onReady?: (ready: boolean) => void;
}) {
  const ref = useRef<HTMLSpanElement>(null),
    readyCallback = useRef(onReady),
    retry = useRef<() => void>(() => {});
  const [measured, setMeasured] = useState<{ url: string; bounds: FontSpecimenBounds; naturalWidth: number }>();
  const [url, setUrl] = useState<string>(),
    [failed, setFailed] = useState(false);
  useEffect(() => {
    readyCallback.current = onReady;
  }, [onReady]);
  useEffect(() => {
    let release: (() => void) | undefined,
      abort: AbortController | undefined,
      objectUrl: string | undefined,
      last: string | undefined,
      alive = true,
      failures = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const cancel = () => {
      clearTimeout(timer);
      abort?.abort();
      abort = undefined;
      last = undefined;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = undefined;
      readyCallback.current?.(false);
      if (alive) setUrl(undefined);
    };
    const update = () => {
      if (!release) return;
      const value = descriptor ?? dynamicFontMetadata.get(versionId);
      if (
        isDynamicFontRevoked(versionId) ||
        !value?.renderAllowed ||
        !value.specimen
      ) {
        cancel();
        return;
      }
      const key = value.specimen.sha256;
      if (last === key) return;
      cancel();
      last = key;
      setFailed(false);
      const controller = new AbortController();
      abort = controller;
      void dynamicTextFontRuntime()
        .specimen(value, controller.signal)
        .then(
          (bytes) => {
            if (controller.signal.aborted || !alive) return;
            failures = 0;
            objectUrl = URL.createObjectURL(
              new Blob([bytes], { type: "image/png" }),
            );
            setUrl(objectUrl);
          },
          (error) => {
            if (controller.signal.aborted || !alive) return;
            last = undefined;
            setFailed(true);
            setUrl(undefined);
            const at =
              error instanceof FontResourceError ? error.retryAt : undefined;
            if (at !== undefined || fontMetadataRetry(failures, error))
              timer = setTimeout(
                update,
                at !== undefined
                  ? Math.max(1, at - performance.now())
                  : fontMetadataRetryDelay(failures++, error),
              );
          },
        );
    };
    retry.current = () => {
      last = undefined;
      update();
    };
    const start = () => {
      if (!release) {
        release = descriptor
          ? () => {}
          : dynamicFontMetadata.watch(versionId, update);
        update();
      }
    };
    const observer =
      typeof IntersectionObserver === "undefined"
        ? undefined
        : new IntersectionObserver((entries) => {
            if (entries.some((e) => e.isIntersecting)) start();
            else {
              release?.();
              release = undefined;
              cancel();
            }
          });
    const releasePermissions = subscribeDynamicFonts(update);
    window.addEventListener("online", update);
    if (observer && ref.current) observer.observe(ref.current);
    else start();
    return () => {
      alive = false;
      observer?.disconnect();
      window.removeEventListener("online", update);
      releasePermissions();
      release?.();
      release = undefined;
      cancel();
    };
  }, [versionId, descriptor]);
  const crop = compact && measured?.url === url ? measured : undefined;
  return (
    <span
      ref={ref}
      aria-hidden={compact || undefined}
      className={cn(
        "inline-flex items-center justify-center overflow-hidden",
        compact ? "h-7 w-full justify-start" : "h-24 w-full",
      )}
    >
      {url ? (
        <span className={cn("relative inline-flex items-center overflow-hidden", compact ? "justify-start" : "justify-center", crop ? "shrink-0" : "h-full w-full")} style={crop ? { width: `min(100%, ${crop.bounds.width / crop.bounds.height * 1.5}rem)`, aspectRatio: `${crop.bounds.width} / ${crop.bounds.height}` } : undefined}>
          {/* eslint-disable-next-line @next/next/no-img-element -- 已校验 PNG 的临时 blob URL */}
          <img
            src={url}
            alt={compact ? "" : "字体样张"}
            className={cn("dynamic-font-specimen-image object-contain", crop ? "absolute" : "max-h-full max-w-full")}
            style={crop ? { width: `${crop.naturalWidth / crop.bounds.width * 100}%`, maxWidth: "none", height: "auto", left: `${-crop.bounds.x / crop.bounds.width * 100}%`, top: `${-crop.bounds.y / crop.bounds.height * 100}%` } : undefined}
            onLoad={event => {
              readyCallback.current?.(true);
              const img = event.currentTarget;
              if (!compact || img.naturalWidth * img.naturalHeight > 4_194_304) return;
              const canvas = document.createElement("canvas");
              try {
                canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
                const context = canvas.getContext("2d", { willReadFrequently: true });
                if (!context) return;
                context.drawImage(img, 0, 0);
                const bounds = fontSpecimenBounds(context.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
                if (bounds) setMeasured({ url, bounds, naturalWidth: img.naturalWidth });
              } catch { /* 无法读取像素时完整显示原样张。 */ }
              finally { canvas.width = 0; canvas.height = 0; }
            }}
            onError={() => {
              readyCallback.current?.(false);
              setFailed(true);
              setUrl(undefined);
            }}
          />
        </span>
      ) : failed && descriptor ? (
        <span className="flex items-center gap-2 text-sm">
          <span role="alert">样张读取失败</span>
          <Button
            variant="outline"
            size="compact"
            onClick={() => retry.current()}
          >
            重试
          </Button>
        </span>
      ) : (
        <span className="text-xs text-muted-foreground">{failed ? "样张暂不可用" : "样张"}</span>
      )}
    </span>
  );
}

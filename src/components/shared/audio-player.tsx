"use client";

import { useEffect, useId, useRef, useState, type ReactNode, type CSSProperties } from "react";
import { AUDIO_ACCESSIBILITY, AUDIO_PLAYBACK } from "@wenyousite/foundation/audio";
import { WenyouIcon } from "@/components/ui/wenyou-icon";
import { Tooltip } from "@/components/ui/tooltip";
import { usePathname } from "next/navigation";
import type { MarkdownMediaAudio } from "@/lib/markdown-audio";
import { audioDownloadName, downloadAudioBlob } from "@/lib/download-audio";
import { cn } from "@/lib/utils";
import styles from "./audio-player.module.css";
import { audioTime, claimAudioPlayback, ownsAudioPlayback, releaseAudioPlayback } from "@/lib/audio-playback";

/** 上传占位复用音频卡片外观；没有音源或持久文档节点。 */
export function AudioUploadCard({ fileName, status, progress, error, onCancel, onResume, onRemove }: {
  fileName: string;
  status: "uploading" | "paused" | "failed";
  progress: { stage: "uploading" | "processing"; percent?: number | null } | null;
  error: string;
  onCancel: () => void;
  onResume: () => void;
  onRemove: () => void;
}) {
  const processing = progress?.stage === "processing";
  const percent = processing ? 100 : Math.min(100, Math.max(0, progress?.percent ?? 0));
  const message = status === "failed" ? error : status === "paused" ? "已暂停"
    : processing ? "处理中…" : `上传中 ${percent}%`;
  return <div role="status" data-slot="audio-upload-card" className={cn(styles.player, "not-prose my-3 grid w-full items-center gap-3 rounded-[var(--radius-compact)] border border-border/50 bg-card px-3 py-2 text-foreground")}>
    <button type="button" disabled aria-label="播放" className={cn(styles.playButton, "flex size-10 shrink-0 items-center justify-center rounded-full text-accent-foreground opacity-50")}>
      <span className={styles.playFace}><span className={styles.icon} data-visible="true"><WenyouIcon id="media.play" className="size-5" /></span></span>
    </button>
    <div className={cn(styles.body, "min-w-0 flex-1")}>
      <div className={cn(styles.heading, "flex min-w-0 items-baseline gap-3")}>
        <span data-slot="audio-label" className={cn(styles.label, "min-w-0 flex-1 truncate text-base leading-6 text-foreground")}>{fileName}</span>
        {status !== "failed" ? <span className={cn(styles.time, "shrink-0 text-xs tabular-nums text-muted-foreground")}>{message}</span> : null}
      </div>
      <div className={cn(styles.progress, "flex items-center")}>
        <div role="progressbar" aria-label="音频上传进度" aria-valuemin={0} aria-valuemax={100}
          aria-valuenow={processing ? undefined : percent} aria-valuetext={message} className={styles.uploadProgress}>
          <span className={styles.uploadTrack}><span className={styles.uploadFill} style={{ width: `${percent}%` }} /></span>
        </div>
      </div>
      {status === "failed" ? <span role="alert" className={cn(styles.feedback, "text-xs text-destructive")}>{error}</span> : null}
    </div>
    <div className={styles.uploadActions}>
      {status === "uploading" ? <button type="button" onClick={onCancel}>取消</button> : <button type="button" onClick={onResume}>{status === "paused" ? "继续" : "重试"}</button>}
      <button type="button" aria-label="移除音频上传" onClick={onRemove}>移除</button>
    </div>
  </div>;
}

/** 不在挂载、滚动或 hover 时设置 src；浏览器直接读取桶的 Range 响应。 */
export function AudioPlayer(props: { media: MarkdownMediaAudio; children: ReactNode; showDownload?: boolean }) {
  const pathname = usePathname();
  return <AudioPlayerBody key={JSON.stringify([props.media.sourceUrl, pathname])} {...props} />;
}

function AudioPlayerBody({ media, children, showDownload = true }: { media: MarkdownMediaAudio; children: ReactNode; showDownload?: boolean }) {
  const ref = useRef<HTMLAudioElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const desiredPosition = useRef(0);
  const pendingSeek = useRef<{ target: number; deadline: number } | null>(null);
  const seekTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dragging, setDragging] = useState(false);
  const [inView, setInView] = useState(true);
  const [pageActive, setPageActive] = useState(true);
  const labelId = useId();
  const labelRef = useRef<HTMLSpanElement>(null);
  const mounted = useRef(true);
  const downloadRef = useRef<AbortController | null>(null);
  const downloadUrl = useRef<string | null>(null);
  const downloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  useEffect(() => { mounted.current = true; return () => {
    mounted.current = false; downloadRef.current?.abort();
    if (downloadTimer.current !== null) clearTimeout(downloadTimer.current);
    if (downloadUrl.current) URL.revokeObjectURL(downloadUrl.current);
  }; }, []);
  const save = async () => {
    if (downloadRef.current) { downloadRef.current.abort(); return; }
    const controller = new AbortController(); downloadRef.current = controller;
    setSaving(true); setSaveFailed(false);
    try {
      const blob = await downloadAudioBlob(media, controller.signal); controller.signal.throwIfAborted();
      if (downloadUrl.current) URL.revokeObjectURL(downloadUrl.current);
      if (downloadTimer.current !== null) clearTimeout(downloadTimer.current);
      const url = URL.createObjectURL(blob); downloadUrl.current = url;
      const link = document.createElement("a"); link.href = url; link.download = audioDownloadName(labelRef.current?.textContent ?? "音频");
      document.body.append(link); link.click(); link.remove();
      downloadTimer.current = setTimeout(() => { URL.revokeObjectURL(url); downloadUrl.current = null; downloadTimer.current = null; }, 60_000);
    } catch { if (mounted.current && (!controller.signal.aborted || controller.signal.reason?.name === "TimeoutError")) setSaveFailed(true); }
    finally {
      if (downloadRef.current === controller) downloadRef.current = null;
      if (mounted.current) setSaving(false);
    }
  };
  const generation = useRef(0);
  const resumeAt = useRef(0);
  const [playing, setPlaying] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [failed, setFailed] = useState(false);
  const [seekReady, setSeekReady] = useState(false);
  const [position, setPosition] = useState(0);
  const duration = media.durationMs / 1000;
  useEffect(() => {
    if (!frame.current || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting));
    observer.observe(frame.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const audio = ref.current;
    if (!audio) return;
    const stop = () => {
      generation.current++;
      if (audio.getAttribute("src")) resumeAt.current = pendingSeek.current?.target ?? audio.currentTime;
      draggingRef.current = false; pendingSeek.current = null; setDragging(false);
      if (seekTimer.current !== null) clearTimeout(seekTimer.current);
      releaseAudioPlayback(audio);
      // 后台中止在途缓冲；返回前台不设置 src、不自动续播。
      audio.removeAttribute("src"); audio.load();
      desiredPosition.current = resumeAt.current; setPosition(resumeAt.current);
      setSeekReady(false); setWaiting(false); setPlaying(false);
    };
    const pagehide = () => { setPageActive(false); stop(); };
    const visibility = () => { if (document.visibilityState === "hidden") pagehide(); else setPageActive(true); };
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", pagehide);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pagehide", pagehide);
    };
  }, [media.sourceUrl]);
  const toggle = async () => {
    const audio = ref.current;
    if (!audio) return;
    if (playing || !audio.paused || waiting) { generation.current++; audio.pause(); setWaiting(false); return; }
    const request = ++generation.current;
    claimAudioPlayback(audio);
    setFailed(false);
    setWaiting(true);
    if (!audio.getAttribute("src") || audio.error) audio.src = media.sourceUrl;
    try {
      await audio.play();
      if (generation.current !== request || !ownsAudioPlayback(audio)) audio.pause();
    } catch {
      if (generation.current === request) { setFailed(true); setPlaying(false); }
    } finally { if (generation.current === request) setWaiting(false); }
  };
  // 拖动只预览目标；松手才提交。提交后等待当前 seek 的事件，避免旧 timeupdate 回弹。
  const readPosition = (audio: HTMLAudioElement) => {
    if (!audio.getAttribute("src") || draggingRef.current) return;
    if (pendingSeek.current !== null) {
      if (audio.seeking || (Date.now() < pendingSeek.current.deadline && Math.abs(audio.currentTime - pendingSeek.current.target) > 0.25)) return;
      pendingSeek.current = null;
      if (seekTimer.current !== null) clearTimeout(seekTimer.current);
    }
    desiredPosition.current = audio.currentTime; setPosition(audio.currentTime);
  };
  const beginSeek = (audio: HTMLAudioElement, target: number) => {
    if (seekTimer.current !== null) clearTimeout(seekTimer.current);
    const pending = { target, deadline: Date.now() + 750 };
    pendingSeek.current = pending; audio.currentTime = target;
    // 原生 seek 可能有落点偏差；一次有界确认后恢复真实进度，不插值或循环驱动 UI。
    seekTimer.current = setTimeout(() => { if (pendingSeek.current === pending) readPosition(audio); }, 750);
  };
  const seekTo = (seconds: number) => {
    const audio = ref.current;
    if (!audio || !seekReady || failed) return;
    const target = Math.min(duration, Math.max(0, seconds));
    try {
      beginSeek(audio, target);
      resumeAt.current = target; desiredPosition.current = target; setPosition(target);
    } catch { pendingSeek.current = null; setSeekReady(false); readPosition(audio); }
  };
  const finishDrag = (commit: boolean) => {
    if (!draggingRef.current) return;
    draggingRef.current = false; setDragging(false);
    if (commit) seekTo(desiredPosition.current);
    else if (ref.current) readPosition(ref.current);
  };
  const action = failed ? `${AUDIO_ACCESSIBILITY.retryLabel}${AUDIO_ACCESSIBILITY.playLabel}` : playing || waiting ? AUDIO_ACCESSIBILITY.pauseLabel : AUDIO_ACCESSIBILITY.playLabel;
  return (
    <div ref={frame} data-slot="audio-player" data-wenyou-clipboard-audio={media.sourceUrl}
      data-playing={playing} data-download={showDownload} data-dragging={dragging} data-visual-motion={inView && pageActive ? "on" : "off"}
      className={cn(styles.player, "not-prose my-3 flex w-full items-center gap-3 rounded-[var(--radius-compact)] border border-border/50 bg-card px-3 py-2 text-foreground")}>
      <Tooltip content={action}><button type="button" className={cn(styles.playButton, "flex size-10 shrink-0 items-center justify-center rounded-full text-accent-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring")}
        aria-label={action} aria-describedby={labelId} aria-pressed={playing} aria-busy={waiting} onClick={() => void toggle()}>
        <span className={styles.playFace} aria-hidden="true">
          <span className={styles.icon} data-visible={!waiting && !playing}><WenyouIcon id="media.play" className="size-5" /></span>
          <span className={styles.icon} data-visible={!waiting && playing}><WenyouIcon id="media.pause" className="size-5" /></span>
          <span className={styles.icon} data-visible={waiting}><WenyouIcon id="status.loading" className={cn("size-5", waiting && styles.loading)} /></span>
        </span>
      </button></Tooltip>
      <div className={cn(styles.body, "min-w-0 flex-1")}>
        <div className={cn(styles.heading, "flex min-w-0 items-baseline gap-3")}>
          <span ref={labelRef} id={labelId} data-slot="audio-label" className={cn(styles.label, "min-w-0 flex-1 truncate text-base leading-6 text-foreground")}>{children}</span>
          <span className={cn(styles.time, "shrink-0 text-xs tabular-nums text-muted-foreground")}>{audioTime(position)} / {audioTime(duration)}</span>
        </div>
        <div className={cn(styles.progress, "flex items-center")}>
          <input type="range" min={0} max={duration} step={0.1} value={Math.min(position, duration)} aria-label={AUDIO_ACCESSIBILITY.seekLabel} aria-valuetext={`${audioTime(position)} / ${audioTime(duration)}`}
            disabled={!seekReady || failed}
            onPointerDown={(event) => {
              if (event.button !== 0 || !seekReady || failed) return;
              draggingRef.current = true; setDragging(true);
              event.currentTarget.setPointerCapture?.(event.pointerId);
            }}
            onPointerUp={() => finishDrag(true)} onPointerCancel={() => finishDrag(false)}
            onLostPointerCapture={() => finishDrag(false)} onBlur={() => finishDrag(false)}
            onChange={(event) => {
              const seconds = Number(event.target.value);
              desiredPosition.current = seconds; setPosition(seconds);
              if (!draggingRef.current) seekTo(seconds);
            }}
            style={{ "--audio-progress": `${Math.min(100, Math.max(0, position / duration * 100))}%` } as CSSProperties}
            className={styles.seek} />
        </div>
        {failed ? <span role="alert" className={cn(styles.feedback, "text-xs text-destructive")}>播放失败</span> : null}
        {showDownload && saveFailed ? <span role="alert" className={cn(styles.feedback, "text-xs text-destructive")}>保存失败，请重试</span> : null}
      </div>
      {showDownload ? <Tooltip content={saving ? "取消保存" : "保存到本地"}><button type="button" aria-label={saving ? "取消保存" : "保存到本地"} aria-busy={saving} onClick={() => void save()}
        className={cn(styles.saveButton, "flex size-10 shrink-0 items-center justify-center rounded-full text-muted-foreground disabled:opacity-50")}>
        <WenyouIcon id={saving ? "status.loading" : "action.download"} className={cn("size-5", saving && styles.loading)} />
      </button></Tooltip> : null}
      <audio ref={ref} preload={AUDIO_PLAYBACK.preload} onLoadedMetadata={(event) => {
        const audio = event.currentTarget;
        if (audio.readyState < 1) return;
        try {
          if (resumeAt.current > 0) beginSeek(audio, Math.min(resumeAt.current, duration));
          setSeekReady(true);
        }
        catch { setSeekReady(false); }
      }} onPlaying={() => { setPlaying(true); setWaiting(false); }}
        onPause={(event) => {
          draggingRef.current = false; pendingSeek.current = null;
          if (seekTimer.current !== null) clearTimeout(seekTimer.current);
          setDragging(false); setPlaying(false); setWaiting(false); readPosition(event.currentTarget);
        }} onWaiting={() => setWaiting(true)}
        onTimeUpdate={(event) => readPosition(event.currentTarget)} onSeeked={(event) => readPosition(event.currentTarget)}
        onEnded={() => {
          setPlaying(false); setWaiting(false);
          if (draggingRef.current || pendingSeek.current !== null) return;
          resumeAt.current = 0; desiredPosition.current = duration; setPosition(duration);
        }}
        onError={() => {
          if (!ref.current?.getAttribute("src")) return;
          generation.current++; draggingRef.current = false; pendingSeek.current = null;
          if (seekTimer.current !== null) clearTimeout(seekTimer.current);
          setDragging(false); setFailed(true); setPlaying(false); setWaiting(false);
        }} />
    </div>
  );
}

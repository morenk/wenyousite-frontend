"use client";

import { useEffect, useId, useRef, useState, type ReactNode, type CSSProperties } from "react";
import { AUDIO_ACCESSIBILITY, AUDIO_PLAYBACK } from "@wenyousite/foundation/audio";
import { WenyouIcon } from "@/components/ui/wenyou-icon";
import { Tooltip } from "@/components/ui/tooltip";
import { usePathname } from "next/navigation";
import type { MarkdownMediaAudio } from "@/lib/markdown-audio";
import styles from "./audio-player.module.css";
import { audioTime, claimAudioPlayback, ownsAudioPlayback, releaseAudioPlayback } from "@/lib/audio-playback";

/** 不在挂载、滚动或 hover 时设置 src；浏览器直接读取桶的 Range 响应。 */
export function AudioPlayer(props: { media: MarkdownMediaAudio; children: ReactNode }) {
  const pathname = usePathname();
  return <AudioPlayerBody key={JSON.stringify([props.media.sourceUrl, pathname])} {...props} />;
}

function AudioPlayerBody({ media, children }: { media: MarkdownMediaAudio; children: ReactNode }) {
  const ref = useRef<HTMLAudioElement>(null);
  const labelId = useId();
  const generation = useRef(0);
  const resumeAt = useRef(0);
  const [playing, setPlaying] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [failed, setFailed] = useState(false);
  const [seekReady, setSeekReady] = useState(false);
  const [position, setPosition] = useState(0);
  const duration = media.durationMs / 1000;
  useEffect(() => {
    const audio = ref.current;
    if (!audio) return;
    const stop = () => {
      generation.current++;
      if (audio.getAttribute("src")) resumeAt.current = audio.currentTime;
      releaseAudioPlayback(audio);
      // 后台中止在途缓冲；返回前台不设置 src、不自动续播。
      audio.removeAttribute("src"); audio.load();
      setSeekReady(false); setWaiting(false); setPlaying(false);
    };
    const visibility = () => { if (document.visibilityState === "hidden") stop(); };
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", stop);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pagehide", stop);
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
  const action = failed ? `${AUDIO_ACCESSIBILITY.retryLabel}${AUDIO_ACCESSIBILITY.playLabel}` : playing || waiting ? AUDIO_ACCESSIBILITY.pauseLabel : AUDIO_ACCESSIBILITY.playLabel;
  return (
    <div data-slot="audio-player" data-wenyou-clipboard-audio={media.sourceUrl}
      className="not-prose my-3 flex w-full items-center gap-3 rounded-[var(--radius-compact)] border border-border/50 bg-card px-3 py-2 text-foreground">
      <Tooltip content={action}><button type="button" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent/65 text-accent-foreground transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        aria-label={action} aria-describedby={labelId} aria-pressed={playing} aria-busy={waiting} onClick={() => void toggle()}>
        <WenyouIcon id={waiting ? "status.loading" : playing ? "media.pause" : "media.play"} className={waiting ? "size-5 animate-spin motion-reduce:animate-none" : "size-5"} />
      </button></Tooltip>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-baseline gap-3">
          <span id={labelId} data-slot="audio-label" className="min-w-0 flex-1 truncate text-base leading-6 text-foreground">{children}</span>
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{audioTime(position)} / {audioTime(duration)}</span>
        </div>
        <div className="-mt-2 flex items-center">
          <input type="range" min={0} max={duration} step={0.1} value={Math.min(position, duration)} aria-label={AUDIO_ACCESSIBILITY.seekLabel} aria-valuetext={`${audioTime(position)} / ${audioTime(duration)}`}
            disabled={!seekReady || failed}
            onChange={(event) => {
              const seconds = Number(event.target.value);
              try { if (ref.current) ref.current.currentTime = seconds; setPosition(seconds); }
              catch { setSeekReady(false); }
            }}
            style={{ "--audio-progress": `${Math.min(100, Math.max(0, position / duration * 100))}%` } as CSSProperties}
            className={styles.seek} />
        </div>
        {failed ? <span role="alert" className="text-xs text-destructive">播放失败</span> : null}
      </div>
      <audio ref={ref} preload={AUDIO_PLAYBACK.preload} onLoadedMetadata={(event) => {
        const audio = event.currentTarget;
        if (audio.readyState < 1) return;
        try { if (resumeAt.current > 0) audio.currentTime = Math.min(resumeAt.current, duration); setSeekReady(true); }
        catch { setSeekReady(false); }
      }} onPlaying={() => { setPlaying(true); setWaiting(false); }}
        onPause={() => { setPlaying(false); setWaiting(false); }} onWaiting={() => setWaiting(true)}
        onTimeUpdate={(event) => { if (event.currentTarget.getAttribute("src")) setPosition(event.currentTarget.currentTime); }}
        onEnded={() => { resumeAt.current = 0; setPlaying(false); setWaiting(false); }}
        onError={() => { if (!ref.current?.getAttribute("src")) return; generation.current++; setFailed(true); setPlaying(false); setWaiting(false); }} />
    </div>
  );
}

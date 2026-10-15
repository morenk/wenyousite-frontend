/** 全页面仅一个活动音源；离开后仅用户动作能重新播放。 */
let current: HTMLAudioElement | null = null;
export function claimAudioPlayback(audio: HTMLAudioElement) {
  if (current && current !== audio) current.pause();
  current = audio;
}
export function ownsAudioPlayback(audio: HTMLAudioElement) { return current === audio; }
export function releaseAudioPlayback(audio: HTMLAudioElement) {
  audio.pause();
  if (current === audio) current = null;
}
export function audioTime(seconds: number) {
  const value = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;
}

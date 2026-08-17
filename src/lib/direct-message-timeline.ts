import { formatWenyouTime } from "@wenyousite/foundation/formatting";

const TIMELINE_GAP_MS = 5 * 60 * 1000;

export function shouldShowDirectMessageTime(
  currentCreatedAt: string,
  previousCreatedAt?: string,
) {
  if (!previousCreatedAt) return true;
  const currentTime = new Date(currentCreatedAt).getTime();
  const previousTime = new Date(previousCreatedAt).getTime();
  if (!Number.isFinite(currentTime) || !Number.isFinite(previousTime)) return true;
  return currentTime - previousTime >= TIMELINE_GAP_MS;
}

export function formatDirectMessageTime(createdAt: string, now: Date) {
  return formatWenyouTime(createdAt, now);
}

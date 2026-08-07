import { format, isSameDay, isSameYear, subDays } from "date-fns";

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
  const messageTime = new Date(createdAt);
  if (!Number.isFinite(messageTime.getTime())) return "时间未知";
  if (isSameDay(messageTime, now)) return format(messageTime, "HH:mm");
  if (isSameDay(messageTime, subDays(now, 1))) {
    return `昨天 ${format(messageTime, "HH:mm")}`;
  }
  if (isSameYear(messageTime, now)) return format(messageTime, "MM月dd日 HH:mm");
  return format(messageTime, "yyyy年MM月dd日 HH:mm");
}

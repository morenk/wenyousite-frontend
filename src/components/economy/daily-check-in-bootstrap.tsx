"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useDailyCheckIn } from "@/api/hooks/use-economy";
import { useAuth } from "@/lib/auth";

/** 登录态就绪后自动触发每日签到；重复挂载由服务端幂等兜底。 */
export function DailyCheckInBootstrap() {
  const { user, isInitialized } = useAuth();
  const checkIn = useDailyCheckIn(user?.id);
  const attemptedUserRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isInitialized || !user) {
      attemptedUserRef.current = null;
      return;
    }
    if (attemptedUserRef.current === user.id) return;
    attemptedUserRef.current = user.id;
    checkIn.mutate(undefined, {
      onSuccess: (result) => {
        if (result.claimedNow) {
          toast.success(`今日签到获得 ${result.rewardAmount} 升温油`);
        }
      },
    });
  }, [checkIn, isInitialized, user]);

  return null;
}

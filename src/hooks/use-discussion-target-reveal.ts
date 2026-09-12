"use client";

import { useEffect, useRef } from "react";
import { startDiscussionTargetReveal } from "@/lib/discussion-target-reveal";

export function useDiscussionTargetReveal(
  targetId: string | undefined,
  activationKey?: string | number,
  contentKey?: string | number,
) {
  const reveal = useRef<ReturnType<typeof startDiscussionTargetReveal> | undefined>(undefined);
  useEffect(() => {
    if (!targetId) return;
    const session = startDiscussionTargetReveal(targetId);
    reveal.current = session;
    return () => {
      session.dispose();
      reveal.current = undefined;
    };
  }, [targetId, activationKey]);
  useEffect(() => reveal.current?.schedule(), [contentKey]);
}

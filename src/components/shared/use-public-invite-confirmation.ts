"use client";

import { useCallback, useRef } from "react";
import { useConfirm } from "@/components/ui/confirm-provider";
import { getInternalInviteReferenceSignature } from "@/lib/internal-reference";

/**
 * 公开内容分享邀请前只确认一次；同一正文失败重试不重复打断，邀请内容变化后重新确认。
 */
export function usePublicInviteConfirmation() {
  const confirm = useConfirm();
  const confirmedInviteSignatureRef = useRef<string | null>(null);

  const confirmPublicInvite = useCallback(async (content: string, isPublic = true) => {
    const inviteSignature = isPublic
      ? getInternalInviteReferenceSignature(content)
      : null;
    if (!inviteSignature) {
      confirmedInviteSignatureRef.current = null;
      return true;
    }
    if (confirmedInviteSignatureRef.current === inviteSignature) return true;
    const accepted = await confirm({
      title: "公开分享私密邀请？",
      description: "这段内容包含私密帖邀请传送门。发布后，看到内容的人都可能使用该邀请加入对应帖子。",
      confirmLabel: "确认分享并发布",
    });
    if (accepted) confirmedInviteSignatureRef.current = inviteSignature;
    return accepted;
  }, [confirm]);

  const resetPublicInviteConfirmation = useCallback(() => {
    confirmedInviteSignatureRef.current = null;
  }, []);

  return { confirmPublicInvite, resetPublicInviteConfirmation };
}

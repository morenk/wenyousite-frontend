"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useThreadIdentity, readThreadIdentity } from "@/api/hooks/use-thread-identity";
import { useConfirm } from "@/components/ui/confirm-provider";

export type PublicationIdentityMode = "ACCOUNT" | "RP";
export interface PublicationIdentity {
  identityMode: PublicationIdentityMode;
  identityToken?: string;
}

export interface PublicationIdentitySelection { scope: string; mode: PublicationIdentityMode; token: string | null; name: string; requiresConfirmation?: boolean }

/** 每次新编辑会话冻结默认选择；身份变化在发布前确认，写入时仍由 token 防竞态。 */
export function useThreadIdentitySubmission(threadId: string | undefined, supported: boolean, active: boolean, scope = "", storage?: { value?: PublicationIdentitySelection; onChange: (value: PublicationIdentitySelection | undefined) => void }) {
  const query = useThreadIdentity(threadId, supported && active);
  const confirm = useConfirm();
  const mustConfirm = useRef(false);
  const [localSelection, setLocalSelection] = useState<PublicationIdentitySelection>();
  const selection = storage ? storage.value : localSelection;
  const onChange = storage?.onChange;
  const setSelection = useCallback((next: PublicationIdentitySelection) => { if (onChange) onChange(next); else setLocalSelection(next); }, [onChange]);
  const state = query.data;
  const canUseRp = Boolean(state?.enabled && state.eligible && state.display);
  // 独立表单只初始化自己的状态；统一编辑会话另将首次远端身份同步到外部草稿。
  if (!storage && supported && active && state && selection?.scope !== scope) {
    setLocalSelection({ scope, mode: canUseRp ? "RP" : "ACCOUNT", token: state.identityToken,
      name: state.display?.nickname ?? state.account.username });
  }
  useEffect(() => {
    if (!onChange || !supported || !active || !state || selection?.scope === scope) return;
    onChange({ scope, mode: canUseRp ? "RP" : "ACCOUNT", token: state.identityToken,
      name: state.display?.nickname ?? state.account.username });
  }, [supported, active, state, selection?.scope, scope, canUseRp, onChange]);
  const mode = selection?.scope === scope ? selection.mode : canUseRp ? "RP" : "ACCOUNT";
  const choose = (next: PublicationIdentityMode) => {
    if (!state || (next === "RP" && !canUseRp)) return;
    setSelection({ scope, mode: next, token: state.identityToken, name: state.display?.nickname ?? state.account.username });
  };
  const prepare = async (): Promise<PublicationIdentity | null | undefined> => {
    if (!supported || !threadId) return undefined;
    if (!state) throw new Error("请等待发言身份加载完成后再发表");
    if (mode === "ACCOUNT") return { identityMode: "ACCOUNT" };
    const latest = await readThreadIdentity(threadId);
    const available = Boolean(latest.enabled && latest.eligible && latest.display && latest.identityToken);
    const nextMode = available ? "RP" : "ACCOUNT";
    const name = available ? latest.display!.nickname : latest.account.username;
    if (!available || selection?.token !== latest.identityToken || mustConfirm.current || selection?.requiresConfirmation) {
      if (!await confirm({
        title: "发言身份已变化",
        description: `本次将以「${name}」${available ? "的帖内身份" : "的站内身份"}发表。你的正文仍然保留。`,
        confirmLabel: "确认身份并发表", cancelLabel: "继续编辑",
      })) return null;
    }
    mustConfirm.current = false;
    setSelection({ scope, mode: nextMode, token: latest.identityToken, name });
    return available ? { identityMode: "RP", identityToken: latest.identityToken! } : { identityMode: "ACCOUNT" };
  };
  return {
    query, mode, choose, canUseRp, prepare,
    displayName: mode === "RP" ? selection?.name ?? state?.display?.nickname : state?.account.username,
    requireConfirmation: () => { mustConfirm.current = true; if (selection) setSelection({ ...selection, requiresConfirmation: true }); void query.refetch(); },
  };
}

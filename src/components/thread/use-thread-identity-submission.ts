"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRpIdentities, readRpIdentities, canPublishAsIdentity, type RpIdentityState } from "@/api/hooks/use-rp-identities";
import { useConfirm } from "@/components/ui/confirm-provider";

export type PublicationIdentityMode = "ACCOUNT" | "RP";
export interface PublicationIdentity {
  identityMode: PublicationIdentityMode;
  identityId?: string;
  identityToken?: string;
}
export interface PublicationIdentitySelection {
  scope: string; mode: PublicationIdentityMode; identityId?: string;
  token: string | null; name: string; requiresConfirmation?: boolean;
}

/** 新空稿始终使用站内身份；恢复稿和未知结果保留所选 ID，绝不回落到另一个角色。 */
export function useThreadIdentitySubmission(threadId: string | undefined, supported: boolean, active: boolean, scope = "", storage?: { value?: PublicationIdentitySelection; onChange: (value: PublicationIdentitySelection | undefined) => void }) {
  const query = useRpIdentities(threadId, supported && active);
  const confirm = useConfirm();
  const mustConfirm = useRef(false);
  const [localSelection, setLocalSelection] = useState<PublicationIdentitySelection>();
  const selection = storage ? storage.value : localSelection;
  const onChange = storage?.onChange;
  const setSelection = useCallback((next: PublicationIdentitySelection) => { if (onChange) onChange(next); else setLocalSelection(next); }, [onChange]);
  const state = query.data;
  const initial = useMemo<PublicationIdentitySelection>(() => ({ scope, mode: "ACCOUNT",
    token: null, name: state?.account.username ?? "站内账号" }), [scope, state?.account.username]);
  if (!storage && supported && active && state && selection?.scope !== scope) setLocalSelection(initial);
  useEffect(() => {
    if (!onChange || !supported || !active || !state || selection?.scope === scope) return;
    onChange(initial);
  }, [supported, active, state, selection?.scope, scope, onChange, initial]);
  const chosen = selection?.scope === scope ? selection : initial;
  const mode = chosen.mode;
  const identityId = mode === "RP" ? chosen.identityId ?? state?.compatibilityIdentityId ?? undefined : undefined;
  const selectedIdentity = state?.identities.find((role) => role.identityId === identityId);
  const chooseRole = (role: RpIdentityState) => {
    if (!canPublishAsIdentity(role)) return;
    setSelection({ scope, mode: "RP", identityId: role.identityId, token: role.identityToken, name: role.display!.nickname });
  };
  const choose = (next: PublicationIdentityMode, id?: string) => {
    if (!state) return;
    if (next === "ACCOUNT") setSelection({ scope, mode: next, token: null, name: state.account.username });
    else {
      const role = state.identities.find((item) => item.identityId === id);
      if (role) chooseRole(role);
    }
  };
  const prepare = async (): Promise<PublicationIdentity | null | undefined> => {
    if (!supported || !threadId) return undefined;
    if (!state) throw new Error("请等待发言身份加载完成后再发表");
    if (mode === "ACCOUNT") return { identityMode: "ACCOUNT" };
    const latest = await readRpIdentities(threadId);
    const targetId = chosen.identityId ?? latest.compatibilityIdentityId;
    const role = latest.identities.find((item) => item.identityId === targetId);
    const available = latest.enabled && latest.eligible && canPublishAsIdentity(role);
    const name = available ? role!.display!.nickname : latest.account.username;
    if (!available || chosen.token !== role?.identityToken || mustConfirm.current || chosen.requiresConfirmation) {
      if (!await confirm({
        title: "发言身份已变化",
        description: "本次将以「" + name + "」" + (available ? "的帖内身份" : "的站内身份") + "发表。你的正文仍然保留。",
        confirmLabel: "确认身份并发表", cancelLabel: "继续编辑",
      })) return null;
    }
    mustConfirm.current = false;
    if (available) {
      setSelection({ scope, mode: "RP", identityId: role!.identityId, token: role!.identityToken, name });
      return { identityMode: "RP", identityId: role!.identityId, identityToken: role!.identityToken! };
    }
    setSelection({ scope, mode: "ACCOUNT", token: null, name });
    return { identityMode: "ACCOUNT" };
  };
  return {
    query, mode, identityId, selectedIdentity, choose, chooseCreated: chooseRole, prepare,
    canUseRp: canPublishAsIdentity(selectedIdentity),
    displayName: mode === "RP" ? chosen.name : state?.account.username,
    requireConfirmation: () => { mustConfirm.current = true; if (selection) setSelection({ ...selection, requiresConfirmation: true }); void query.refetch(); },
  };
}

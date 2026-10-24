"use client";

import { getApiError } from "@/api/errors";
import { useState } from "react";
import { fontOrderRequest, useAdminFontOrder, useSaveAdminFontOrder, type FontOrderSnapshot } from "@/api/hooks/admin/use-admin-font-management";
import { useAdminSession } from "@/api/hooks/use-admin";
import { Button } from "@/components/ui/button";
import { TextFontOrderEditor } from "./text-font-order-editor";

export function TextFontOrderPanel({ onClose }: { onClose: () => void }) {
  const query = useAdminFontOrder();
  const save = useSaveAdminFontOrder();
  const session = useAdminSession();
  const [snapshot, setSnapshot] = useState<FontOrderSnapshot>();
  const [recovery, setRecovery] = useState<"conflict" | "unknown">();
  const [generation, setGeneration] = useState(0);
  if (!snapshot && query.data && !query.isError && !query.isFetching) setSnapshot(query.data);
  const reload = async () => {
    const result = await query.refetch();
    if (!result.isError && result.data) { setSnapshot(result.data); setRecovery(undefined); setGeneration((value) => value + 1); }
  };
  return <div className="space-y-3">
    <h2 className="text-base font-semibold">调整展示顺序</h2>
    {query.isError && <div role="alert" className="flex items-center gap-3 text-sm"><span>完整顺序读取失败</span><Button variant="outline" disabled={query.isFetching} onClick={() => void reload()}>重试</Button></div>}
    {!snapshot ? <>{!query.isError && <p role="status">正在读取完整顺序…</p>}<Button variant="outline" onClick={onClose}>返回列表</Button></>
      : <TextFontOrderEditor key={generation} items={snapshot.items.map((item) => ({ id: item.familyId, name: item.name, language: item.language }))}
        disabled={query.isFetching || query.isError || session.sessionStatus !== "authenticated"} conflict={recovery === "conflict"} unconfirmed={recovery === "unknown"} onCancel={onClose} onReload={() => void reload()}
        onSave={async (items) => {
          const body = fontOrderRequest(snapshot, items.map((item) => item.id));
          if (!body.groups.length) return;
          try { await save.mutateAsync(body); onClose(); }
          catch (error) {
            const info = getApiError(error);
            if (info.code === 40928 || info.status === 409) setRecovery("conflict");
            else if (info.status === undefined || info.status === 408 || info.status >= 500) setRecovery("unknown");
            throw error;
          }
        }} />}
  </div>;
}

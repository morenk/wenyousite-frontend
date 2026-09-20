"use client";

import { useCallback, useEffect, useState } from "react";

interface CursorState {
  scope: string;
  cursors: Array<string | undefined>;
}

const retained = new Map<string, CursorState>();

export function clearAdminListPagination() { retained.clear(); }

export function useCursorPagination(scope: string, retentionKey?: string) {
  const [state, setState] = useState<CursorState>(() =>
    (retentionKey ? retained.get(retentionKey) : undefined) ?? { scope, cursors: [undefined] });
  useEffect(() => {
    if (retentionKey) retained.set(retentionKey, state.scope === scope ? state : { scope, cursors: [undefined] });
  }, [retentionKey, scope, state]);
  if (state.scope !== scope) setState({ scope, cursors: [undefined] });
  const active = state.scope === scope ? state : { scope, cursors: [undefined] };
  const cursor = active.cursors.at(-1);

  const next = useCallback((nextCursor: string) => {
    setState((current) => {
      const cursors = current.scope === scope ? current.cursors : [undefined];
      return { scope, cursors: [...cursors, nextCursor] };
    });
  }, [scope]);

  const previous = useCallback(() => {
    setState((current) => {
      const cursors = current.scope === scope ? current.cursors : [undefined];
      return { scope, cursors: cursors.length > 1 ? cursors.slice(0, -1) : cursors };
    });
  }, [scope]);

  return {
    cursor,
    page: active.cursors.length,
    hasPrevious: active.cursors.length > 1,
    next,
    previous,
  };
}

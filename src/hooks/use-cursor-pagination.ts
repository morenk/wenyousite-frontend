"use client";

import { useCallback, useState } from "react";

interface CursorState {
  scope: string;
  cursors: Array<string | undefined>;
}

export function useCursorPagination(scope: string) {
  const [state, setState] = useState<CursorState>({ scope, cursors: [undefined] });
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

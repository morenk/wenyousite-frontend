"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

interface UnreadCountsValue {
  notificationCount: number;
  directMessageCount: number;
}

const UnreadCountsContext = createContext<UnreadCountsValue>({
  notificationCount: 0,
  directMessageCount: 0,
});

export function UnreadCountsProvider({
  notificationCount,
  directMessageCount,
  children,
}: UnreadCountsValue & { children: ReactNode }) {
  const value = useMemo(
    () => ({ notificationCount, directMessageCount }),
    [directMessageCount, notificationCount],
  );

  return (
    <UnreadCountsContext.Provider value={value}>
      {children}
    </UnreadCountsContext.Provider>
  );
}

export function useUnreadCounts() {
  return useContext(UnreadCountsContext);
}

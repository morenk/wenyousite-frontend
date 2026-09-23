"use client";

import { useLayoutEffect, useRef } from "react";
import { getAuthSnapshot, subscribeAuthStore } from "./auth-store";

/** 仅为关系操作等待确认的阶段绑定身份、目标与挂载生命周期。 */
export function useRelationshipActionScope(targetKey: string) {
  const generation = useRef(Symbol());
  useLayoutEffect(() => {
    generation.current = Symbol();
    return () => { generation.current = Symbol(); };
  }, [targetKey]);
  return () => {
    const opened = generation.current;
    const viewer = getAuthSnapshot().user?.id;
    let valid = !!viewer;
    const dispose = subscribeAuthStore(() => {
      if (getAuthSnapshot().user?.id !== viewer) valid = false;
    });
    return {
      isCurrent: () => valid && generation.current === opened && getAuthSnapshot().user?.id === viewer,
      dispose,
    };
  };
}

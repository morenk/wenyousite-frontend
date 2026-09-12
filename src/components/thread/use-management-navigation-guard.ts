"use client";

import { useEffect, useRef } from "react";

/** 管理界面的浏览器离开保护，与正文保存状态共享确认回调。 */
export function useManagementNavigationGuard({ hasUnsavedChanges, isNavigationLocked, confirmDiscardChanges }: {
  hasUnsavedChanges: boolean;
  isNavigationLocked: boolean;
  confirmDiscardChanges: () => Promise<boolean>;
}) {
  const allowWindowNavigationRef = useRef(false);
  useEffect(() => {
    if (!hasUnsavedChanges && !isNavigationLocked) return;
    allowWindowNavigationRef.current = false;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (allowWindowNavigationRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const handleDocumentClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) return;
      const target = event.target;
      const anchor = target instanceof Element
        ? target.closest<HTMLAnchorElement>("a[href]")
        : null;
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const destination = new URL(anchor.href, window.location.href);
      if (
        destination.origin !== window.location.origin ||
        destination.href === window.location.href ||
        (destination.pathname === window.location.pathname &&
          destination.search === window.location.search &&
          destination.hash)
      ) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (isNavigationLocked) return;
      void confirmDiscardChanges().then((confirmed) => {
        if (!confirmed) return;
        allowWindowNavigationRef.current = true;
        window.location.assign(destination.href);
      });
    };
    const handlePopState = () => {
      if (allowWindowNavigationRef.current) return;
      window.history.forward();
      if (isNavigationLocked) return;
      void confirmDiscardChanges().then((confirmed) => {
        if (!confirmed) return;
        allowWindowNavigationRef.current = true;
        window.history.back();
      });
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("popstate", handlePopState);
    document.addEventListener("click", handleDocumentClick, true);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("popstate", handlePopState);
      document.removeEventListener("click", handleDocumentClick, true);
    };
  }, [confirmDiscardChanges, hasUnsavedChanges, isNavigationLocked]);

}

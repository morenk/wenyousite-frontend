"use client";

import { useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";

import { buildLoginHref } from "@/lib/login-redirect";

export interface LoginRedirectOptions {
  next?: string;
  replace?: boolean;
}

/** 登录入口统一跳转：默认保留当前路径、查询参数与页内锚点。 */
export function useLoginRedirect() {
  const pathname = usePathname();
  const router = useRouter();

  return useCallback((options: LoginRedirectOptions = {}) => {
    const suffix = typeof window === "undefined"
      ? ""
      : `${window.location.search}${window.location.hash}`;
    const next = options.next ?? `${pathname || "/"}${suffix}`;
    const href = buildLoginHref(next);

    if (options.replace) {
      router.replace(href);
    } else {
      router.push(href);
    }
  }, [pathname, router]);
}

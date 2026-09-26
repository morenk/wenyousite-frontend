"use client";

import { useEffect, useState } from "react";
import { clearAuthSession } from "@/lib/auth-store";

/** 失效后卸载包含 QueryClient 的应用树；旧内存结果不能进入新批次。 */
export function PreviewBoundary({ children }: { children: React.ReactNode }) {
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    const stop = () => { clearAuthSession({ announce: false }); setExpired(true); };
    window.addEventListener("wenyou-preview-expired", stop);
    return () => window.removeEventListener("wenyou-preview-expired", stop);
  }, []);
  if (expired) return <main className="p-8 text-foreground"><p>开发预览已切换，请重新载入当前会话。</p><button className="underline" type="button" onClick={() => window.location.reload()}>重新载入</button></main>;
  return children;
}

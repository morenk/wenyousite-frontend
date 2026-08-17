"use client";

import { useEffect } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-4 px-4 text-center">
      <AlertCircle className="h-10 w-10 text-destructive" aria-hidden="true" />
      <h1 className="text-2xl font-semibold">页面暂时无法加载</h1>
      <p className="text-sm text-muted-foreground">请重试；如果问题持续存在，请稍后再访问。</p>
      <Button type="button" onClick={reset}>重新加载</Button>
    </div>
  );
}

/** 编辑器动态入口：页面只有真正挂载编辑器时才下载 Milkdown/Crepe。 */

"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import type { MilkdownEditorProps } from "@/components/editor/milkdown-editor-core";

const DynamicMilkdownEditor = dynamic(
  () => import("@/components/editor/milkdown-editor-core").then((module) => module.MilkdownEditor),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-40 items-center justify-center rounded-lg border border-border bg-background text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        编辑器加载中…
      </div>
    ),
  },
);

export function MilkdownEditor(props: MilkdownEditorProps) {
  return <DynamicMilkdownEditor {...props} />;
}

export type { MilkdownEditorProps };

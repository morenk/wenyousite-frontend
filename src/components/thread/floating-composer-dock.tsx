/** 回复串共享浮动输入坞：对齐内容列，并为底部内容预留实际高度。 */

"use client";

import type { ReactNode } from "react";
import { useThreadComposer } from "@/components/thread/thread-composer-context";
import { FloatingInputDock } from "@/components/shared/floating-input-dock";

interface FloatingComposerDockProps {
  sessionAnchorId: string;
  children: ReactNode;
}

export function FloatingComposerDock({
  sessionAnchorId,
  children,
}: FloatingComposerDockProps) {
  const { session } = useThreadComposer();
  const visible = session === null || session.anchorId === sessionAnchorId;
  return <FloatingInputDock visible={visible}>{children}</FloatingInputDock>;
}

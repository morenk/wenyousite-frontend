/** 创建主题帖草稿选择器：未发布草稿列表 + 「新建主题帖」入口 */

"use client";

import { Plus } from "lucide-react";
import { DraftList } from "@/components/user/draft-list";
import { Button } from "@/components/ui/button";

interface ThreadDraftPickerProps {
  /** 点击「新建主题帖」回调 */
  onCreateNew: () => void;
}

export function ThreadDraftPicker({ onCreateNew }: ThreadDraftPickerProps) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">创建主题帖</h1>
        <Button size="sm" onClick={onCreateNew}>
          <Plus className="mr-1.5 h-4 w-4" />
          新建主题帖
        </Button>
      </div>
      <DraftList />
    </div>
  );
}

/** 创建主题帖草稿选择器：未发布草稿列表 + 「新建主题帖」入口 */

"use client";

import { Plus } from "lucide-react";
import { DraftList } from "@/components/user/draft-list";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";

interface ThreadDraftPickerProps {
  /** 点击「新建主题帖」回调 */
  onCreateNew: () => void;
}

export function ThreadDraftPicker({ onCreateNew }: ThreadDraftPickerProps) {
  return (
    <PageShell width="content">
      <PageHeader
        title="创建主题帖"
        actions={<Button size="compact" onClick={onCreateNew}>
          <Plus className="mr-1.5 h-4 w-4" />
          新建主题帖
        </Button>}
      />
      <DraftList />
    </PageShell>
  );
}

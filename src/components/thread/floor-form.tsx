/** 楼层发布入口：点击后才按需挂载详情页唯一 Markdown 编辑器 */

import { ThreadComposerEntry } from "@/components/thread/thread-composer-entry";

interface FloorFormProps {
  subthreadId: string;
}

export function getFloorComposerAnchorId(subthreadId: string) {
  return `create-floor:${subthreadId}`;
}

export function FloorForm({ subthreadId }: FloorFormProps) {
  const anchorId = getFloorComposerAnchorId(subthreadId);

  return (
    <ThreadComposerEntry
      anchorId={anchorId}
      iconId="action.add-comment"
      composerSession={{
        key: anchorId,
        anchorId,
        type: "create-floor",
        subthreadId,
        label: "发表回复",
        initialContent: "",
      }}
    />
  );
}

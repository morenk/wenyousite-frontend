/** 楼中楼回复入口：登录后按需挂载统一 Markdown 编辑器 */

import { ThreadComposerEntry } from "@/components/thread/thread-composer-entry";

interface ReplyFormProps {
  subthreadId: string;
  parentPostId: string;
  replyToPostId: string;
  label: string;
}

export function getReplyComposerAnchorId(parentPostId: string) {
  return `create-reply:${parentPostId}`;
}

export function ReplyForm({
  subthreadId,
  parentPostId,
  replyToPostId,
  label,
}: ReplyFormProps) {
  const anchorId = getReplyComposerAnchorId(parentPostId);

  return (
    <ThreadComposerEntry
      anchorId={anchorId}
      iconId="action.reply"
      composerSession={{
        key: anchorId,
        anchorId,
        type: "reply",
        subthreadId,
        parentPostId,
        replyToPostId,
        label,
        initialContent: "",
      }}
    />
  );
}

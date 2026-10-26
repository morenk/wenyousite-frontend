import type { PublicationIdentitySelection } from "./use-thread-identity-submission";
import type { CreatePostArgs } from "@/api/hooks/use-create-post";
import type { MarkdownMediaAudio } from "@/lib/markdown-audio";
import type { MarkdownMediaDisplay } from "@/lib/media-display";
import type { InlineDiceRoll } from "@/lib/dice-inline";

interface BaseComposerSession {
  key: string;
  anchorId: string;
  subthreadId: string;
  label: string;
  initialContent: string;
  mediaDisplays?: readonly MarkdownMediaDisplay[];
  mediaAudios?: readonly MarkdownMediaAudio[];
  diceRolls?: InlineDiceRoll[];
}

export interface CreateFloorComposerSession extends BaseComposerSession {
  type: "create-floor";
}

export interface ReplyComposerSession extends BaseComposerSession {
  type: "reply";
  parentPostId: string;
  replyToPostId: string;
}

export interface EditComposerSession extends BaseComposerSession {
  type: "edit";
  postId: string;
  version: number;
  parentPostId?: string;
}

export type ThreadComposerSession =
  | CreateFloorComposerSession
  | ReplyComposerSession
  | EditComposerSession;

export interface ReplyDraft {
  session: CreateFloorComposerSession | ReplyComposerSession;
  content: string;
  identitySelection?: PublicationIdentitySelection;
  pendingCreate: CreatePostArgs | null;
  pendingIdentityHash?: string;
}

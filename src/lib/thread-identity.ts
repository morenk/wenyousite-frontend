import type { components } from "@/api/types";
import type { MediaDisplay } from "@/lib/media-display";

export type RpIdentity = components["schemas"]["RpIdentityResponseDto"];
export type MentionIdentity = components["schemas"]["MentionIdentityDisplayDto"];
export interface ThreadAccountAppearance {
  id: string;
  username: string;
  avatar?: string | null;
  avatarDisplay?: MediaDisplay | null;
  rpIdentity?: RpIdentity | null;
}

export function threadAppearance(account: ThreadAccountAppearance) {
  return account.rpIdentity
    ? { name: account.rpIdentity.nickname, avatar: account.rpIdentity.avatar, avatarDisplay: account.rpIdentity.avatarDisplay }
    : { name: account.username, avatar: account.avatar ?? null, avatarDisplay: account.avatarDisplay };
}

export function mentionDisplayName(userId: string, sourceLabel: string, identities?: readonly MentionIdentity[]) {
  return identities?.find((identity) => identity.userId === userId && identity.label === sourceLabel)?.displayName ?? sourceLabel;
}

import type { components } from "@/api/types";

type ContactState =
  components["schemas"]["DirectConversationLookupResponseDto"]["contactState"];

interface DirectConversationEntryCopyInput {
  contactState?: ContactState;
  canInitiate: boolean;
  isFollowing?: boolean;
  isFollowedBy?: boolean;
  isBlocked?: boolean;
  isBlockedBy?: boolean;
}

export type DirectConversationEntryCopy =
  | {
      canInitiate: false;
      title: string;
      description: string;
    }
  | {
      canInitiate: true;
      title: string;
      description: string;
      headerSubtitle: string;
      composerHint: string;
      submitLabel: string;
    };

export function getDirectConversationEntryCopy({
  contactState,
  canInitiate,
  isFollowing,
  isFollowedBy,
  isBlocked,
  isBlockedBy,
}: DirectConversationEntryCopyInput): DirectConversationEntryCopy {
  if (!canInitiate) {
    if (isBlocked) {
      return {
        canInitiate: false,
        title: "你已将对方拉黑",
        description: "请先在对方主页或黑名单中取消拉黑，再发起私聊。",
      };
    }
    if (isBlockedBy) {
      return {
        canInitiate: false,
        title: "你已被对方拉黑",
        description: "当前无法向对方发送私聊。",
      };
    }
    if (contactState === "DECLINED") {
      return {
        canInitiate: false,
        title: "消息请求已被拒绝",
        description: "对方拒绝了你此前的消息请求，你不能再次主动发起私聊。",
      };
    }
    return {
      canInitiate: false,
      title: "当前无法发起私聊",
      description: "对方账号不可用，或你们之间的联系已受限。",
    };
  }

  if (contactState === "DECLINED") {
    return {
      canInitiate: true,
      title: "你曾拒绝过对方的消息请求",
      description: "现在由你主动发送消息，会直接建立私聊。",
      headerSubtitle: "由你主动重新建立私聊",
      composerHint: "发送后会直接建立私聊，无需再次处理请求。",
      submitLabel: "建立私聊",
    };
  }

  if (isFollowing && isFollowedBy) {
    return {
      canInitiate: true,
      title: "你们已互相关注",
      description: "发送首条消息后会直接建立私聊，无需等待对方接受。",
      headerSubtitle: "互相关注，可直接建立会话",
      composerHint: "你们已互相关注，发送后会直接建立私聊。",
      submitLabel: "建立私聊",
    };
  }

  return {
    canInitiate: true,
    title: "这会先作为消息请求",
    description: "对方接受前只能发送这一条消息。",
    headerSubtitle: "发送首条消息请求",
    composerHint: "这是首条消息请求。对方接受前，你不能继续发送。",
    submitLabel: "发送消息请求",
  };
}

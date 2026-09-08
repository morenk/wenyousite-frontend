import { describe, expect, test } from "vitest";
import { getDirectConversationEntryCopy } from "@/components/message/direct-conversation-entry-copy";

describe("getDirectConversationEntryCopy", () => {
  test("互关用户明确提示会直接建立私聊", () => {
    const copy = getDirectConversationEntryCopy({
      contactState: "NEW",
      canInitiate: true,
      isFollowing: true,
      isFollowedBy: true,
    });

    expect(copy).toMatchObject({
      canInitiate: true,
      composerHint: "你们已互相关注，发送后直接建立私聊。",
      submitLabel: "建立私聊",
    });
  });

  test("非互关用户明确提示首条消息是请求", () => {
    const copy = getDirectConversationEntryCopy({
      contactState: "NEW",
      canInitiate: true,
      isFollowing: true,
      isFollowedBy: false,
    });

    expect(copy).toMatchObject({
      canInitiate: true,
      composerHint: "对方接受前，只能发送一条消息请求。",
      submitLabel: "发送消息请求",
    });
  });

  test("区分本人拉黑和被对方拉黑", () => {
    expect(getDirectConversationEntryCopy({
      contactState: "UNAVAILABLE",
      canInitiate: false,
      isBlocked: true,
    })).toMatchObject({ title: "你已将对方拉黑" });

    expect(getDirectConversationEntryCopy({
      contactState: "UNAVAILABLE",
      canInitiate: false,
      isBlockedBy: true,
    })).toMatchObject({ title: "你已被对方拉黑" });
  });

  test("区分对方拒绝和本人曾拒绝对方", () => {
    expect(getDirectConversationEntryCopy({
      contactState: "DECLINED",
      canInitiate: false,
    })).toMatchObject({
      title: "消息请求已被拒绝",
      description: expect.stringContaining("对方拒绝了你"),
    });

    expect(getDirectConversationEntryCopy({
      contactState: "DECLINED",
      canInitiate: true,
    })).toMatchObject({
      composerHint: "你曾拒绝对方的请求；此次主动发送将直接建立私聊。",
      submitLabel: "建立私聊",
    });
  });
});

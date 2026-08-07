import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { DirectMessageBubble } from "@/components/message/direct-message-bubble";
import type { DirectMessage } from "@/api/hooks/use-direct-messages";

vi.mock("@/components/thread/image-lightbox", () => ({
  ImageLightbox: ({ onClose }: { onClose: () => void }) => (
    <button type="button" onClick={onClose}>原图遮罩</button>
  ),
}));

function message(overrides: Partial<DirectMessage> = {}): DirectMessage {
  return {
    id: "m1",
    conversationId: "c1",
    senderId: "u1",
    recipientId: "u2",
    content: "访问 https://example.com 了解详情",
    media: null,
    recalledAt: null,
    createdAt: "2026-08-06T20:00:00.000Z",
    ...overrides,
  };
}

afterEach(() => cleanup());

describe("DirectMessageBubble", () => {
  test("按纯文本展示正文并将链接安全地变为可点击链接", () => {
    render(<DirectMessageBubble message={message()} mine={false} />);
    expect(screen.getByText(/访问/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "https://example.com" })).toHaveAttribute(
      "rel",
      "noopener noreferrer nofollow",
    );
  });

  test("陌生消息请求的图片默认不加载，点击后才展示", () => {
    render(
      <DirectMessageBubble
        message={message({ content: null, media: {
          id: "media1",
          url: "https://cdn.example.com/image.jpg",
          contentType: "image/jpeg",
          width: 100,
          height: 100,
        } })}
        mine={false}
        hideRequestImage
      />,
    );
    expect(screen.queryByRole("img", { name: "私聊图片" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "点击查看陌生人图片" }));
    expect(screen.getByRole("img", { name: "私聊图片" })).toBeInTheDocument();
  });

  test("撤回消息不再暴露原正文和图片", () => {
    render(<DirectMessageBubble message={message({ recalledAt: "2026-08-06T20:01:00Z" })} mine />);
    expect(screen.getByText("你撤回了一条消息")).toBeInTheDocument();
    expect(screen.queryByText(/example.com/)).not.toBeInTheDocument();
  });

  test("普通图片可打开和关闭原图，撤回按钮调用回调", () => {
    const onRecall = vi.fn();
    render(
      <DirectMessageBubble
        message={message({ media: {
          id: "media1",
          url: "https://cdn.example.com/image.jpg",
          contentType: "image/jpeg",
          width: null,
          height: null,
        } })}
        mine
        canRecall
        onRecall={onRecall}
      />,
    );
    fireEvent.click(screen.getByRole("img", { name: "私聊图片" }));
    fireEvent.click(screen.getByRole("button", { name: "原图遮罩" }));
    expect(screen.queryByRole("button", { name: "原图遮罩" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "撤回" }));
    expect(onRecall).toHaveBeenCalled();
  });

  test("GIF 动图直接使用原图 URL，避免被静态中图替代", () => {
    const gifUrl = "https://cdn.example.com/animated.GIF?version=1#preview";
    render(
      <DirectMessageBubble
        message={message({ media: {
          id: "media1",
          url: gifUrl,
          contentType: "image/gif",
          width: 320,
          height: 180,
        } })}
        mine={false}
      />,
    );

    expect(screen.getByRole("img", { name: "私聊图片" })).toHaveAttribute("src", gifUrl);
  });
});

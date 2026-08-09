"use client";

import { memo, useState } from "react";
import { ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImageLightbox } from "@/components/shared/image-lightbox";
import { normalizeDirectMessageContent } from "@/lib/direct-message-content";
import { cn } from "@/lib/utils";
import type { DirectMessage } from "@/api/hooks/use-direct-messages";
import { SaveStickerButton } from "@/components/sticker/save-sticker-button";
import { getStickerDisplayUrl, STICKER_DISPLAY_STYLE } from "@/lib/sticker-display";

function PlainTextWithLinks({ content }: { content: string }) {
  const parts = content.split(/(https?:\/\/[^\s]+)/g);
  return (
    <p className="whitespace-pre-wrap break-words text-base leading-7">
      {parts.map((part, index) =>
        /^https?:\/\//.test(part) ? (
          <a
            key={`${part}-${index}`}
            href={part}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="underline underline-offset-2"
          >
            {part}
          </a>
        ) : (
          part
        ),
      )}
    </p>
  );
}

interface DirectMessageBubbleProps {
  message: DirectMessage;
  mine: boolean;
  hideRequestImage?: boolean;
  canRecall?: boolean;
  onRecall?: (messageId: string) => void;
  recalling?: boolean;
}

export const DirectMessageBubble = memo(function DirectMessageBubble({
  message,
  mine,
  hideRequestImage = false,
  canRecall = false,
  onRecall,
  recalling = false,
}: DirectMessageBubbleProps) {
  const [imageRevealed, setImageRevealed] = useState(!hideRequestImage);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const recalled = !!message.recalledAt;
  const sending = message.deliveryState === "sending";
  const normalizedContent = message.content
    ? normalizeDirectMessageContent(message.content)
    : "";
  const pureSticker = !!message.sticker && !normalizedContent && !recalled;
  const imageUrl = message.sticker?.url ?? message.media?.url;
  const isAnimatedGif = message.media?.contentType?.toLowerCase() === "image/gif"
    || !!imageUrl && /\.gif(?:[?#]|$)/iu.test(imageUrl);
  const displayImageUrl = imageUrl
    ? message.sticker
      ? getStickerDisplayUrl(message.sticker)
      : isAnimatedGif ? imageUrl : message.media?.mediumUrl ?? imageUrl
    : undefined;


  return (
    <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
      <div className={cn(
        "group relative flex max-w-[72%] flex-col",
        mine ? "items-end" : "items-start",
      )}>
        <div
          className={cn(
            !pureSticker && "w-fit max-w-full rounded-2xl px-3 py-2",
            !pureSticker && (mine
              ? "rounded-br-md bg-primary text-primary-foreground"
              : "rounded-bl-md bg-muted text-foreground"),
            recalled && "text-muted-foreground",
          )}
        >
          {recalled ? (
            <p className="text-sm">{mine ? "你撤回了一条消息" : "对方撤回了一条消息"}</p>
          ) : (
            <>
              {normalizedContent && <PlainTextWithLinks content={normalizedContent} />}
              {imageUrl && (
                <div className={cn(normalizedContent && "mt-2")}>
                  {!imageRevealed ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setImageRevealed(true)}
                    >
                      <ImageIcon className="h-4 w-4" />
                      点击查看陌生人图片
                    </Button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setLightboxOpen(true)}
                      className="block overflow-hidden rounded-lg"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={displayImageUrl}
                        alt={message.sticker ? "私聊表情" : "私聊图片"}
                        loading="lazy"
                        decoding="async"
                        className={cn(
                          "max-w-full object-contain",
                          message.sticker ? "sticker-display" : "max-h-80",
                        )}
                        style={message.sticker ? STICKER_DISPLAY_STYLE : undefined}
                      />
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
        {!recalled && !sending && imageUrl && imageRevealed && (
          <SaveStickerButton
            source={{ directMessageId: message.id }}
            className={cn(
              "absolute -top-2 opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus-within:opacity-100",
              mine ? "-left-7" : "-right-7",
            )}
          />
        )}
        {(sending || canRecall && !recalled) && (
          <div
            className={cn(
              "mt-1 flex items-center gap-2 px-1 text-[11px] text-muted-foreground",
              mine && "justify-end",
            )}
          >
            {sending && <span role="status">发送中…</span>}
            {canRecall && !recalled && !sending && (
              <button
                type="button"
                onClick={() => onRecall?.(message.id)}
                disabled={recalling}
                className="hover:text-foreground disabled:opacity-50"
              >
                {recalling ? "撤回中…" : "撤回"}
              </button>
            )}
          </div>
        )}
      </div>
      {lightboxOpen && imageUrl && (
        <ImageLightbox
          src={imageUrl}
          alt={message.sticker ? "私聊表情" : "私聊图片原图"}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </div>
  );
});

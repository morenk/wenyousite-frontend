"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImageLightbox } from "@/components/shared/image-lightbox";
import { getImageUrlBySize } from "@/lib/upload-image";
import { cn } from "@/lib/utils";
import type { DirectMessage } from "@/api/hooks/use-direct-messages";

function PlainTextWithLinks({ content }: { content: string }) {
  const parts = content.split(/(https?:\/\/[^\s]+)/g);
  return (
    <p className="whitespace-pre-wrap break-words text-sm leading-6">
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
  onRecall?: () => void;
  recalling?: boolean;
}

export function DirectMessageBubble({
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
  const imageUrl = message.media?.url;
  const isAnimatedGif = message.media?.contentType?.toLowerCase() === "image/gif"
    || !!imageUrl && /\.gif(?:[?#]|$)/iu.test(imageUrl);
  const displayImageUrl = imageUrl
    ? isAnimatedGif ? imageUrl : getImageUrlBySize(imageUrl, "md")
    : undefined;

  return (
    <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
      <div className={cn("max-w-[72%]", mine ? "items-end" : "items-start")}>
        <div
          className={cn(
            "rounded-2xl px-3 py-2",
            mine
              ? "rounded-br-md bg-primary text-primary-foreground"
              : "rounded-bl-md bg-muted text-foreground",
            recalled && "italic text-muted-foreground",
          )}
        >
          {recalled ? (
            <p className="text-sm">{mine ? "你撤回了一条消息" : "对方撤回了一条消息"}</p>
          ) : (
            <>
              {message.content && <PlainTextWithLinks content={message.content} />}
              {message.media && (
                <div className={cn(message.content && "mt-2")}>
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
                        alt="私聊图片"
                        loading="lazy"
                        decoding="async"
                        className="max-h-80 max-w-full object-contain"
                      />
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
        <div
          className={cn(
            "mt-1 flex items-center gap-2 px-1 text-[11px] text-muted-foreground",
            mine && "justify-end",
          )}
        >
          <time dateTime={message.createdAt}>
            {format(new Date(message.createdAt), "MM-dd HH:mm")}
          </time>
          {canRecall && !recalled && (
            <button
              type="button"
              onClick={onRecall}
              disabled={recalling}
              className="hover:text-foreground disabled:opacity-50"
            >
              {recalling ? "撤回中…" : "撤回"}
            </button>
          )}
        </div>
      </div>
      {lightboxOpen && message.media && (
        <ImageLightbox
          src={message.media.url}
          alt="私聊图片原图"
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </div>
  );
}

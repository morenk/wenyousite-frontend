"use client";

import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/api/errors";
import { saveStickerSource, type StickerSource } from "@/api/hooks/use-stickers";
import { Button } from "@/components/ui/button";
import { getKnownUserId } from "@/lib/auth-store";

export function SaveStickerButton({
  source,
  className,
}: {
  source: StickerSource;
  className?: string;
}) {
  const [pending, setPending] = useState(false);
  if (!getKnownUserId()) return null;

  const save = async () => {
    setPending(true);
    try {
      const result = await saveStickerSource(source);
      toast.success(
        result.status === "PROCESSING"
          ? "图片正在处理，完成后会出现在收藏中"
          : result.alreadySaved
            ? "已经收藏过这个表情"
            : "已添加到表情收藏",
      );
      window.dispatchEvent(new Event("stickers:changed"));
    } catch (error) {
      toast.error(getApiErrorMessage(error, "收藏表情失败"));
    } finally {
      setPending(false);
    }
  };

  return (
    <Button
      type="button"
      variant="secondary"
      size="xs"
      title="添加到表情收藏"
      aria-label="添加到表情收藏"
      disabled={pending}
      onClick={(event) => {
        event.stopPropagation();
        void save();
      }}
      className={className}
    >
      {pending ? <Loader2 className="animate-spin" /> : <Plus />}
    </Button>
  );
}

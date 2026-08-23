import type { components } from "@/api/types";

type ApiDirectMessage = components["schemas"]["DirectMessageResponseDto"];

export type DirectMessage = ApiDirectMessage & {
  deliveryState?: "uploading" | "sending" | "failed";
  uploadProgress?: number | null;
};

export interface DirectMessageSendInput {
  content?: string;
  mediaId?: string;
  stickerAssetId?: string;
  clientRequestId: string;
  optimisticMedia?: components["schemas"]["DirectMessageMediaResponseDto"];
  optimisticSticker?: components["schemas"]["DirectMessageStickerResponseDto"];
  optimisticAlreadyStaged?: boolean;
}

export interface DirectMessagePendingDraft {
  content?: string;
  clientRequestId: string;
  optimisticMedia: components["schemas"]["DirectMessageMediaResponseDto"];
  deliveryState: "uploading" | "failed";
  uploadProgress?: number | null;
}

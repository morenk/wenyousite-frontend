import type { components } from "@/api/types";

type ApiDirectMessage = components["schemas"]["DirectMessageResponseDto"];

export type DirectMessage = ApiDirectMessage & {
  deliveryState?: "sending";
};

export interface DirectMessageSendInput {
  content?: string;
  mediaId?: string;
  stickerAssetId?: string;
  clientRequestId: string;
  optimisticMedia?: components["schemas"]["DirectMessageMediaResponseDto"];
  optimisticSticker?: components["schemas"]["DirectMessageStickerResponseDto"];
}

import type { operations } from "@/api/types";

type ReplyQuery = NonNullable<operations["postsFindReplies"]["parameters"]["query"]>;

export type ReplyOrder = Exclude<ReplyQuery["order"], undefined>;

export interface ReplyFilters {
  order: ReplyOrder;
  authorId?: string;
}

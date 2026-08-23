import type { operations } from "@/api/types";

type FloorQuery = NonNullable<operations["postsFindFloors"]["parameters"]["query"]>;

export type FloorOrder = Exclude<FloorQuery["order"], undefined>;

export interface FloorFilters {
  order: FloorOrder;
  authorId?: string;
}

export const FLOOR_ORDERS = ["OLDEST", "NEWEST"] as const satisfies readonly FloorOrder[];
export const DEFAULT_FLOOR_ORDER: FloorOrder = "OLDEST";
export const DEFAULT_FLOOR_FILTERS: FloorFilters = { order: DEFAULT_FLOOR_ORDER };

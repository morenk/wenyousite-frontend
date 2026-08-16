import type { operations } from "@/api/types";

type FloorQuery = NonNullable<operations["postsFindFloors"]["parameters"]["query"]>;

export type FloorOrder = Exclude<FloorQuery["order"], undefined>;

export const FLOOR_ORDERS = ["OLDEST", "NEWEST"] as const satisfies readonly FloorOrder[];
export const DEFAULT_FLOOR_ORDER: FloorOrder = "OLDEST";

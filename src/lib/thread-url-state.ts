import { parseAsStringLiteral } from "nuqs";
import { DEFAULT_FLOOR_ORDER, FLOOR_ORDERS } from "@/api/floor-query";

export const floorOrderParser = parseAsStringLiteral(FLOOR_ORDERS)
  .withDefault(DEFAULT_FLOOR_ORDER);

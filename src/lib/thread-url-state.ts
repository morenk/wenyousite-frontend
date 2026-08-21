import { parseAsString, parseAsStringLiteral } from "nuqs";
import { DEFAULT_FLOOR_ORDER, FLOOR_ORDERS } from "@/api/floor-query";

export const floorOrderParser = parseAsStringLiteral(FLOOR_ORDERS)
  .withDefault(DEFAULT_FLOOR_ORDER);

/** 主题阅读页的内容坐标；查询参数只改变客户端阅读状态，不触发 RSC 导航。 */
export const threadContentCoordinateParsers = {
  post: parseAsString,
  subthread: parseAsString,
};

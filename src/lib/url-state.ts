import { parseAsString, parseAsStringLiteral } from "nuqs";

export const homeFilterParsers = {
  category: parseAsString,
  sort: parseAsStringLiteral(["recommended", "newest", "active"] as const)
    .withDefault("recommended"),
  status: parseAsStringLiteral(["RECRUITING", "CLOSED", "FINISHED"] as const),
};

export const searchQueryParser = parseAsString.withDefault("");

export const notificationTypeParser = parseAsStringLiteral([
  "reply,mention",
  "new_post,thread_created",
  "follow,like",
  "tip,level_up",
  "system",
] as const);

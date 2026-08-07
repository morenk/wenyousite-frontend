import { parseAsString, parseAsStringLiteral } from "nuqs";

export const homeFilterParsers = {
  category: parseAsStringLiteral(["DEDUCTION", "NATION", "RPG"] as const),
  sort: parseAsStringLiteral(["recommended", "newest", "active"] as const)
    .withDefault("recommended"),
  status: parseAsStringLiteral(["RECRUITING", "CLOSED", "FINISHED"] as const),
};

export const searchQueryParser = parseAsString.withDefault("");

export const notificationTypeParser = parseAsStringLiteral([
  "reply,mention",
  "new_post,thread_created",
  "follow,like",
  "system",
] as const);

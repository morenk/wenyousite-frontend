import { createParser, parseAsString, parseAsStringLiteral } from "nuqs";
import { normalizeNotificationFilter } from "@/lib/notification-filters";

export const homeFilterParsers = {
  category: parseAsString,
  sort: parseAsStringLiteral(["recommended", "newest", "active"] as const)
    .withDefault("recommended"),
  status: parseAsStringLiteral(["RECRUITING", "CLOSED", "FINISHED"] as const),
};

export const searchQueryParser = parseAsString.withDefault("");

export const notificationTypeParser = createParser({
  parse: normalizeNotificationFilter,
  serialize: (value) => value,
});

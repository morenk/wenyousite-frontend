import { parseAsInteger, parseAsString, parseAsStringLiteral } from "nuqs";

export function boundedAdminPageIndex(page: number, itemCount: number, pageSize: number) {
  return Math.min(Math.max(page, 1) - 1, Math.max(Math.ceil(itemCount / pageSize) - 1, 0));
}

const targetTypes = [
  "USER",
  "THREAD",
  "POST",
  "MOMENT",
  "MOMENT_COMMENT",
  "DIRECT_MESSAGE",
] as const;

const decisionActions = ["HIDE_CONTENT", "SUSPEND_USER", "BAN_USER"] as const;

export const adminCaseFilterParsers = {
  status: parseAsStringLiteral(["OPEN", "RESOLVED", "DISMISSED"] as const)
    .withDefault("OPEN"),
  targetType: parseAsStringLiteral(targetTypes),
  reasonCode: parseAsStringLiteral([
    "SPAM",
    "HARASSMENT",
    "HATE_OR_THREATS",
    "SEXUAL_CONTENT",
    "VIOLENT_CONTENT",
    "PERSONAL_INFORMATION",
    "IMPERSONATION_OR_FRAUD",
    "INTELLECTUAL_PROPERTY",
    "ILLEGAL_CONTENT",
    "OTHER",
  ] as const),
  selectedCaseId: parseAsString,
};

export const adminCaseUrlKeys = {
  targetType: "target",
  reasonCode: "reason",
  selectedCaseId: "case",
} as const;

export const adminAppealFilterParsers = {
  status: parseAsStringLiteral(["ALL", "PENDING", "UPHELD", "OVERTURNED"] as const)
    .withDefault("PENDING"),
  targetType: parseAsStringLiteral(targetTypes),
  action: parseAsStringLiteral(decisionActions),
};

export const adminAppealUrlKeys = {
  targetType: "target",
} as const;

export const adminUserFilterParsers = {
  query: parseAsString.withDefault(""),
  role: parseAsStringLiteral(["USER", "ADMIN", "SUPER_ADMIN"] as const),
  status: parseAsStringLiteral(["ACTIVE", "SUSPENDED", "BANNED"] as const),
};

export const adminUserUrlKeys = {
  query: "q",
} as const;

export const adminAuditFilterParsers = {
  action: parseAsStringLiteral([
    "SUPER_ADMIN_BOOTSTRAPPED",
    "ADMIN_ROLE_GRANTED",
    "ADMIN_ROLE_REVOKED",
    "USER_SUSPENDED",
    "USER_BANNED",
    "USER_SANCTION_REVOKED",
    "CONTENT_HIDDEN",
    "CONTENT_RESTORED",
    "REPORT_RESOLVED",
    "REPORT_DISMISSED",
    "SYSTEM_NOTIFICATION_SENT",
    "THREAD_CATEGORY_CREATED",
    "THREAD_CATEGORY_UPDATED",
    "TAG_CREATED",
    "TAG_UPDATED",
    "ADMIN_INVITED",
    "ADMIN_INVITE_ACCEPTED",
    "ADMIN_INVITE_CANCELED",
    "SUPER_ADMIN_TRANSFERRED",
    "ADMIN_SESSION_REVOKED",
    "CASE_RESOLVED",
    "CASE_DISMISSED",
    "APPEAL_SUBMITTED",
    "APPEAL_UPHELD",
    "APPEAL_OVERTURNED",
    "USER_SESSIONS_REVOKED",
    "PASSWORD_RESET_REQUESTED_BY_ADMIN",
    "NOTIFICATION_CAMPAIGN_SCHEDULED",
    "NOTIFICATION_CAMPAIGN_CANCELED",
    "THREAD_CATEGORY_MERGED",
    "TAG_MERGED",
    "SITE_SETTINGS_UPDATED",
  ] as const),
  targetType: parseAsStringLiteral([
    "USER",
    "THREAD",
    "POST",
    "MOMENT",
    "MOMENT_COMMENT",
    "REPORT",
    "SYSTEM_NOTIFICATION",
    "THREAD_CATEGORY",
    "TAG",
    "MODERATION_CASE",
    "MODERATION_DECISION",
    "MODERATION_APPEAL",
    "ADMIN_INVITE",
    "ADMIN_SESSION",
    "NOTIFICATION_CAMPAIGN",
    "SITE_SETTINGS",
  ] as const),
  targetId: parseAsString.withDefault(""),
  dateFrom: parseAsString.withDefault(""),
  dateTo: parseAsString.withDefault(""),
};

export const adminAuditUrlKeys = {
  targetType: "target",
  targetId: "id",
  dateFrom: "from",
  dateTo: "to",
} as const;

export const adminHiddenContentFilterParsers = {
  targetType: parseAsStringLiteral(["THREAD", "POST", "MOMENT", "MOMENT_COMMENT"] as const),
};

export const adminHiddenContentUrlKeys = {
  targetType: "hiddenType",
} as const;

export const adminAnnouncementFilterParsers = {
  query: parseAsString.withDefault(""),
  status: parseAsStringLiteral(["SCHEDULED", "SENDING", "SENT", "CANCELED", "FAILED"] as const),
  destination: parseAsStringLiteral(["THREAD", "NONE"] as const),
};

export const adminAnnouncementUrlKeys = {
  query: "q",
} as const;

export const adminAccountFilterParsers = {
  accountQuery: parseAsString.withDefault(""),
  role: parseAsStringLiteral(["ADMIN", "SUPER_ADMIN"] as const),
  sessionState: parseAsStringLiteral(["ACTIVE", "OFFLINE"] as const),
  accountPage: parseAsInteger.withDefault(1),
  pendingQuery: parseAsString.withDefault(""),
  expiry: parseAsStringLiteral(["VALID", "EXPIRED"] as const),
  invitePage: parseAsInteger.withDefault(1),
};

export const adminAccountUrlKeys = {
  accountQuery: "q",
  sessionState: "session",
  accountPage: "page",
  pendingQuery: "inviteQ",
  expiry: "inviteExpiry",
  invitePage: "invitePage",
} as const;

export const adminTaxonomyFilterParsers = {
  categoryQuery: parseAsString.withDefault(""),
  categoryStatus: parseAsStringLiteral(["ACTIVE", "INACTIVE"] as const),
  categoryColor: parseAsStringLiteral(["SET", "EMPTY"] as const),
  categoryPage: parseAsInteger.withDefault(1),
  tagQuery: parseAsString.withDefault(""),
  tagStatus: parseAsStringLiteral(["ACTIVE", "INACTIVE"] as const),
  tagPage: parseAsInteger.withDefault(1),
};

export const adminTaxonomyUrlKeys = {
  categoryQuery: "categoryQ",
  categoryStatus: "categoryStatus",
  categoryColor: "categoryColor",
  categoryPage: "categoryPage",
  tagQuery: "tagQ",
  tagStatus: "tagStatus",
  tagPage: "tagPage",
} as const;

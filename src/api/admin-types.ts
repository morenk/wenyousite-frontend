export type AdminRole = "ADMIN" | "SUPER_ADMIN";
export type AdminContentType = "thread" | "post" | "moment" | "moment_comment";
export type CaseStatus = "OPEN" | "RESOLVED" | "DISMISSED";
export type TargetType =
  | "USER"
  | "THREAD"
  | "POST"
  | "MOMENT"
  | "MOMENT_COMMENT"
  | "DIRECT_MESSAGE";
export type ReasonCode =
  | "SPAM"
  | "HARASSMENT"
  | "HATE_OR_THREATS"
  | "SEXUAL_CONTENT"
  | "VIOLENT_CONTENT"
  | "PERSONAL_INFORMATION"
  | "IMPERSONATION_OR_FRAUD"
  | "INTELLECTUAL_PROPERTY"
  | "ILLEGAL_CONTENT"
  | "OTHER";
export type DecisionAction = "HIDE_CONTENT" | "SUSPEND_USER" | "BAN_USER";

export interface AdminSessionData {
  csrfToken: string;
  user: { id: string; username?: string; role: AdminRole };
  session: {
    id: string;
    createdAt: string;
    lastActiveAt: string;
    expiresAt: string;
    elevatedUntil: string | null;
  };
}

export interface CaseSummary {
  id: string;
  targetType: TargetType;
  targetId: string;
  status: CaseStatus;
  createdAt: string;
  updatedAt: string;
  _count: { reports: number };
  reports: Array<{
    reasonCode: ReasonCode;
    details: string | null;
    createdAt: string;
    targetSnapshot: Record<string, unknown> | null;
  }>;
  decisions: Array<{
    action: DecisionAction;
    publicExplanation: string;
    active: boolean;
    createdAt: string;
  }>;
}

export interface ModerationReport {
  id: string;
  reasonCode: ReasonCode;
  details: string | null;
  targetSnapshot: Record<string, unknown> | null;
  status: string;
  createdAt: string;
  reporter: { id: string; username: string; role: string } | null;
}

export interface ModerationDecision {
  id: string;
  action: DecisionAction;
  policyCode: ReasonCode;
  publicExplanation: string;
  internalNote: string | null;
  active: boolean;
  createdAt: string;
  actor: { id: string; username: string; role: string };
}

export interface ModerationCaseDetail {
  id: string;
  targetType: TargetType;
  targetId: string;
  status: CaseStatus;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  reports: ModerationReport[];
  decisions: ModerationDecision[];
}

export interface CursorMeta {
  cursor: string | null;
  hasMore: boolean;
}

export interface AdminAccount {
  id: string;
  email: string;
  username: string;
  role: AdminRole;
  createdAt: string;
  adminSessions: Array<{ id: string; lastActiveAt: string; expiresAt: string }>;
}

export interface AdminAccountsData {
  accounts: AdminAccount[];
  invites: Array<{
    id: string;
    status: string;
    expiresAt: string;
    createdAt: string;
    user: { id: string; email: string; username: string };
    invitedBy: { id: string; username: string };
  }>;
}

export interface OperationalSettings {
  id: string;
  registrationPausedUntil: string | null;
  contentWritesPausedUntil: string | null;
  maintenanceTitle: string | null;
  maintenanceContent: string | null;
  maintenanceStartsAt: string | null;
  maintenanceEndsAt: string | null;
  updatedAt: string;
}

export interface ModerationAppeal {
  id: string;
  statement: string;
  status: "PENDING" | "UPHELD" | "OVERTURNED";
  handledNote: string | null;
  createdAt: string;
  handledAt: string | null;
  appellant: { id: string; username: string; role: string };
  decision: ModerationDecision & { targetType: TargetType; targetId: string };
}

export interface NotificationCampaign {
  id: string;
  title: string;
  content: string;
  status: "SCHEDULED" | "SENDING" | "SENT" | "CANCELED" | "FAILED";
  scheduledAt: string;
  sentAt: string | null;
  estimatedCount: number;
  recipientCount: number;
  createdAt: string;
  createdBy: { id: string; username: string };
}

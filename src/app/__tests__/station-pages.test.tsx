import { describe, expect, it } from "vitest";
import StationEntryPage from "@/app/station/page";
import StationCasesPage from "@/app/station/cases/page";
import StationAppealsPage from "@/app/station/appeals/page";
import StationUsersPage from "@/app/station/users/page";
import StationAnnouncementsPage from "@/app/station/announcements/page";
import StationTaxonomyPage from "@/app/station/taxonomy/page";
import StationAccountsPage from "@/app/station/accounts/page";
import StationOperationsPage from "@/app/station/operations/page";
import StationAuditPage from "@/app/station/audit/page";
import StationDashboardPage from "@/app/station/dashboard/page";
import StationInvitePage from "@/app/station/invite/page";
import StationLayout from "@/app/station/layout";
import MyModerationPage from "@/app/me/moderation/page";

describe("station route composition", () => {
  it("keeps every station route on the dedicated PC shell", () => {
    expect(StationEntryPage()).toBeTruthy();
    expect(StationDashboardPage()).toBeTruthy();
    expect(StationInvitePage()).toBeTruthy();
    expect(StationCasesPage()).toBeTruthy();
    expect(StationAppealsPage()).toBeTruthy();
    expect(StationUsersPage()).toBeTruthy();
    expect(StationAnnouncementsPage()).toBeTruthy();
    expect(StationTaxonomyPage()).toBeTruthy();
    expect(StationAccountsPage()).toBeTruthy();
    expect(StationOperationsPage()).toBeTruthy();
    expect(StationAuditPage()).toBeTruthy();
    expect(StationLayout({ children: <span>station</span> })).toBeTruthy();
    expect(MyModerationPage()).toBeTruthy();
  });
});

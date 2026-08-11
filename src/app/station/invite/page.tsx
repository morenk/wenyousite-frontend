import { AdminInviteAcceptance } from "@/components/admin/admin-invite-acceptance";
import { RequireAuth } from "@/components/auth/require-auth";

export default function StationInvitePage() {
  return (
    <RequireAuth requireVerifiedEmail>
      <AdminInviteAcceptance />
    </RequireAuth>
  );
}

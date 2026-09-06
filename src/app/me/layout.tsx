import type { ReactNode } from "react";
import { RequireAuth } from "@/components/auth/require-auth";

import { SettingsShell } from "@/components/user/settings-shell";

export default function MeLayout({ children }: { children: ReactNode }) {
  return <RequireAuth><SettingsShell>{children}</SettingsShell></RequireAuth>;
}

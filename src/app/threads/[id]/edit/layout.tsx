import type { ReactNode } from "react";
import { RequireAuth } from "@/components/auth/require-auth";

export default function EditThreadLayout({ children }: { children: ReactNode }) {
  return <RequireAuth requireVerifiedEmail>{children}</RequireAuth>;
}

import type { ReactNode } from "react";
import { RequireAuth } from "@/components/auth/require-auth";

export default function CreateThreadLayout({ children }: { children: ReactNode }) {
  return <RequireAuth requireVerifiedEmail>{children}</RequireAuth>;
}

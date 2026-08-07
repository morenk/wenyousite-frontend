import { GuestRoute } from "@/components/auth/guest-route";

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return <GuestRoute>{children}</GuestRoute>;
}

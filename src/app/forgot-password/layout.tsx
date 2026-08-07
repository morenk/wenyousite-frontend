import { GuestRoute } from "@/components/auth/guest-route";

export default function ForgotPasswordLayout({ children }: { children: React.ReactNode }) {
  return <GuestRoute>{children}</GuestRoute>;
}

import { GuestRoute } from "@/components/auth/guest-route";

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return <GuestRoute>{children}</GuestRoute>;
}

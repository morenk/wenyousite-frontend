import { GuestRoute } from "@/components/auth/guest-route";

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <GuestRoute>{children}</GuestRoute>;
}

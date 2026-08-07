import { RequireAuth } from "@/components/auth/require-auth";
import { DirectMessagesFrame } from "@/components/message/direct-messages-frame";

export default function MessagesLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth requireVerifiedEmail>
      <DirectMessagesFrame>{children}</DirectMessagesFrame>
    </RequireAuth>
  );
}

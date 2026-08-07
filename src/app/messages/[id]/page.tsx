"use client";

import { useParams } from "next/navigation";
import { DirectConversationPanel } from "@/components/message/direct-conversation-panel";

export default function DirectConversationPage() {
  const params = useParams<{ id: string }>();
  return <DirectConversationPanel conversationId={params.id} />;
}

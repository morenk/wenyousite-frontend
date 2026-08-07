"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Loader2, MessageCircleOff } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useUserProfile } from "@/api/hooks/use-user-profile";
import { useDirectConversationLookup } from "@/api/hooks/use-direct-conversations";
import { useStartDirectConversation } from "@/api/hooks/use-direct-message-actions";
import { DirectMessageComposer } from "@/components/message/direct-message-composer";
import { getDirectConversationEntryCopy } from "@/components/message/direct-conversation-entry-copy";
import { UserAvatar } from "@/components/shared/user-avatar";

export default function NewDirectConversationPage() {
  const params = useParams<{ userId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const profileQuery = useUserProfile(params.userId);
  const lookup = useDirectConversationLookup(params.userId, user?.id);
  const start = useStartDirectConversation(user?.id);

  useEffect(() => {
    const existing = lookup.data?.conversation;
    const contactState = lookup.data?.contactState;
    if (!existing) return;
    if (contactState === "ACCEPTED" || contactState === "PENDING") {
      router.replace(`/messages/${existing.id}`);
    }
  }, [lookup.data, router]);

  if (profileQuery.isLoading || lookup.isLoading) {
    return (
      <div className="flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const profile = profileQuery.data;
  if (
    profileQuery.isError
    || lookup.isError
    || !profile
    || profile.isDeactivated
    || user?.id === params.userId
  ) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground">
        <MessageCircleOff className="h-9 w-9 opacity-50" />
        无法向该用户发起私聊
      </div>
    );
  }

  if (lookup.data?.conversation && ["ACCEPTED", "PENDING"].includes(lookup.data.contactState)) {
    return (
      <div className="flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const entryCopy = getDirectConversationEntryCopy({
    contactState: lookup.data?.contactState,
    canInitiate: lookup.data?.canInitiate ?? false,
    isFollowing: profile.isFollowing,
    isFollowedBy: profile.isFollowedBy,
    isBlocked: profile.isBlocked,
    isBlockedBy: profile.isBlockedBy,
  });

  if (!entryCopy.canInitiate) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 px-6 text-center text-sm text-muted-foreground">
        <MessageCircleOff className="h-9 w-9 opacity-50" />
        <div className="space-y-1">
          <p className="font-medium text-foreground">{entryCopy.title}</p>
          <p>{entryCopy.description}</p>
        </div>
        <Link href={`/users/${params.userId}`} className="text-primary hover:underline">
          返回用户主页
        </Link>
      </div>
    );
  }

  return (
    <section className="flex min-h-0 flex-col bg-background">
      <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border px-4">
        <UserAvatar name={profile.username} src={profile.avatar} className="h-9 w-9" />
        <div>
          <p className="text-sm font-semibold">给 {profile.username} 发私聊</p>
          <p className="text-xs text-muted-foreground">{entryCopy.headerSubtitle}</p>
        </div>
      </header>
      <div className="flex flex-1 items-center justify-center px-8">
        <div className="max-w-md text-center text-sm leading-6 text-muted-foreground">
          <p className="font-medium text-foreground">{entryCopy.title}</p>
          <p>{entryCopy.description}</p>
        </div>
      </div>
      <DirectMessageComposer
        requestHint={entryCopy.composerHint}
        submitLabel={entryCopy.submitLabel}
        placeholder="礼貌地介绍一下来意…"
        onSend={async (value) => {
          const result = await start.mutateAsync({ ...value, recipientId: params.userId });
          toast.success(result.conversation.status === "ACCEPTED" ? "私聊已建立" : "消息请求已发送");
          router.replace(`/messages/${result.conversation.id}`);
        }}
      />
    </section>
  );
}

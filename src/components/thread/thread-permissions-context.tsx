"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import {
  useThreadDetail,
  type CurrentThreadMembership,
} from "@/api/hooks/use-thread-detail";

interface ThreadPermissionsValue {
  visibility?: "PUBLIC" | "PRIVATE";
  currentMember?: CurrentThreadMembership;
  isOwner: boolean;
  isCollaborator: boolean;
  isParticipant: boolean;
  isAdmin: boolean;
  /** 帖内管理者：楼主或协作者。 */
  isManager: boolean;
  isThreadManager: boolean;
  isLoading: boolean;
  isProvided: boolean;
}

const emptyPermissions: ThreadPermissionsValue = {
  isOwner: false,
  isCollaborator: false,
  isParticipant: false,
  isAdmin: false,
  isManager: false,
  isThreadManager: false,
  isLoading: false,
  isProvided: false,
};

const ThreadPermissionsContext = createContext<ThreadPermissionsValue>(emptyPermissions);

export function ThreadPermissionsProvider({
  threadId,
  ownerId,
  children,
}: {
  threadId: string;
  ownerId?: string;
  children: ReactNode;
}) {
  const { user } = useAuth();
  const threadQuery = useThreadDetail(threadId);
  const currentMember = threadQuery.data?.currentMembership ?? undefined;
  const capabilities = threadQuery.data?.capabilities;
  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
  const isOwner = !!user && (
    capabilities?.isOwner ||
    ownerId === user.id ||
    threadQuery.data?.ownerId === user.id ||
    currentMember?.role === "OWNER"
  );
  const isCollaborator = currentMember?.role === "COLLABORATOR";
  const isParticipant = currentMember?.role === "PARTICIPANT";

  return (
    <ThreadPermissionsContext.Provider
      value={{
        visibility: threadQuery.data?.visibility,
        currentMember,
        isOwner,
        isCollaborator,
        isParticipant,
        isAdmin,
        isManager: isOwner || isCollaborator,
        isThreadManager: isOwner || isCollaborator,
        isLoading: !!user && threadQuery.isLoading,
        isProvided: true,
      }}
    >
      {children}
    </ThreadPermissionsContext.Provider>
  );
}

export function useThreadPermissions() {
  return useContext(ThreadPermissionsContext);
}

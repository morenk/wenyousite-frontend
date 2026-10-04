"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { useRefreshThreadIdentityProjection } from "@/api/hooks/use-thread-identity";
import { useAuth } from "@/lib/auth";
import {
  useThreadDetail,
  type CurrentThreadMembership,
} from "@/api/hooks/use-thread-detail";

export interface ThreadAuthorFilter {
  subthreadId: string;
  parentPostId?: string;
  authorId?: string;
}

interface ThreadPermissionsValue {
  authorFilter?: ThreadAuthorFilter;
  setAuthorFilter: (filter: ThreadAuthorFilter | undefined) => void;
  visibility?: "PUBLIC" | "PRIVATE";
  rpIdentitySupported?: boolean;
  rpIdentityEnabled?: boolean;
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
  setAuthorFilter: () => {},
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
  const [authorFilter, setAuthorFilter] = useState<ThreadAuthorFilter>();
  const threadQuery = useThreadDetail(threadId);
  useRefreshThreadIdentityProjection(threadId, threadQuery.data?.rpIdentityEnabled);
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
        authorFilter,
        setAuthorFilter,
        visibility: threadQuery.data?.visibility,
        rpIdentitySupported: threadQuery.data?.rpIdentityEnabled !== undefined,
        rpIdentityEnabled: threadQuery.data?.rpIdentityEnabled ?? false,
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

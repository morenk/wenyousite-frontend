"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { useMembers, type ThreadMember } from "@/api/hooks/use-members";

interface ThreadPermissionsValue {
  members: ThreadMember[];
  currentMember?: ThreadMember;
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
  members: [],
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
  const membersQuery = useMembers(user ? threadId : undefined);
  const members = membersQuery.data ?? [];
  const currentMember = members.find((member) => member.userId === user?.id);
  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
  const isOwner = !!user && (ownerId === user.id || currentMember?.role === "OWNER");
  const isCollaborator = currentMember?.role === "COLLABORATOR";
  const isParticipant = currentMember?.role === "PARTICIPANT";

  return (
    <ThreadPermissionsContext.Provider
      value={{
        members,
        currentMember,
        isOwner,
        isCollaborator,
        isParticipant,
        isAdmin,
        isManager: isOwner || isCollaborator,
        isThreadManager: isOwner || isCollaborator,
        isLoading: !!user && membersQuery.isLoading,
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

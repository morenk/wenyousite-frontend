/** 桌面成员权限表：搜索筛选、协作权限与玩家标记两条独立维度。 */

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  Loader2,
  Search,
  Shield,
  ShieldCheck,
  UserCheck,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { useMembers } from "@/api/hooks/use-members";
import { useUpdateMember } from "@/api/hooks/use-update-member";
import { getApiErrorMessage } from "@/api/errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useConfirm } from "@/components/ui/confirm-provider";
import { cn } from "@/lib/utils";
import type { ThreadMember } from "@/api/hooks/use-members";

interface MemberManagerProps {
  threadId: string;
  /** 楼主可任免协作者；楼主和协作者都可修改玩家标记。 */
  isOwner: boolean;
  isCollaborator: boolean;
}

type MemberFilter = "all" | "collaborators" | "players" | "others";

function getMemberRank(member: ThreadMember) {
  if (member.role === "OWNER") return 0;
  if (member.role === "COLLABORATOR") return 1;
  if (member.playerMarked) return 2;
  return 3;
}

function matchesFilter(member: ThreadMember, filter: MemberFilter) {
  if (filter === "collaborators") return member.role === "COLLABORATOR";
  if (filter === "players") return member.playerMarked && member.role !== "OWNER";
  if (filter === "others") {
    return member.role === "PARTICIPANT" && !member.playerMarked;
  }
  return true;
}

export function MemberManager({ threadId, isOwner, isCollaborator }: MemberManagerProps) {
  const { data: members, isLoading, error, refetch } = useMembers(threadId);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<MemberFilter>("all");

  const orderedMembers = useMemo(() => [...(members ?? [])].sort((a, b) => {
    const rankDifference = getMemberRank(a) - getMemberRank(b);
    if (rankDifference !== 0) return rankDifference;
    const joinedDifference = new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime();
    if (joinedDifference !== 0) return joinedDifference;
    return a.user.username.localeCompare(b.user.username, "zh-CN");
  }), [members]);

  const counts = useMemo(() => ({
    all: orderedMembers.length,
    collaborators: orderedMembers.filter((member) => matchesFilter(member, "collaborators")).length,
    players: orderedMembers.filter((member) => matchesFilter(member, "players")).length,
    others: orderedMembers.filter((member) => matchesFilter(member, "others")).length,
  }), [orderedMembers]);

  const visibleMembers = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase("zh-CN");
    return orderedMembers.filter((member) =>
      matchesFilter(member, filter) &&
      (!keyword || member.user.username.toLocaleLowerCase("zh-CN").includes(keyword)),
    );
  }, [filter, orderedMembers, query]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 py-20">
        <EmptyState title="成员列表加载失败" description="检查网络后重试，现有权限不会受到影响。" />
        <Button variant="outline" size="compact" onClick={() => void refetch()}>
          重试
        </Button>
      </div>
    );
  }

  if (!members || members.length === 0) {
    return (
      <div className="py-20">
        <EmptyState title="暂无参与人" description="用户回复帖子后会自动进入成员候选池。" />
      </div>
    );
  }

  const filters: Array<{ value: MemberFilter; label: string }> = [
    { value: "all", label: "全部" },
    { value: "collaborators", label: "协作者" },
    { value: "players", label: "玩家" },
    { value: "others", label: "其他参与人" },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-5">
      <div className="flex items-start justify-between gap-8">
        <div>
          <p className="font-utility text-xs font-bold uppercase tracking-[0.12em] text-brand-strong">
            成员权限
          </p>
          <h2 className="mt-1 font-display text-xl font-bold text-foreground">
            谁可以共同创作
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
            协作权限决定谁能管理内容，玩家标记决定谁属于当前游戏阵容；两者彼此独立。
          </p>
        </div>
        <Badge tone={isOwner ? "brand" : "info"}>
          {isOwner ? "楼主可管理全部权限" : "协作者可管理玩家标记"}
        </Badge>
      </div>

      <div className="flex items-center justify-between gap-5 rounded-2xl border border-border bg-muted/25 p-3">
        <div className="flex items-center gap-1" aria-label="筛选成员">
          {filters.map((item) => (
            <button
              key={item.value}
              type="button"
              aria-pressed={filter === item.value}
              onClick={() => setFilter(item.value)}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-muted-foreground outline-none transition-colors hover:bg-card hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/30",
                filter === item.value && "bg-card text-foreground shadow-sm",
              )}
            >
              {item.label}
              <span className="font-utility text-[0.6875rem] tabular-nums text-muted-foreground">
                {counts[item.value]}
              </span>
            </button>
          ))}
        </div>

        <div className="relative w-64">
          <label htmlFor="member-search" className="sr-only">搜索成员</label>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="member-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索成员"
            className="h-9 pl-9"
          />
        </div>
      </div>

      {visibleMembers.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <table className="w-full table-fixed border-collapse text-left">
            <thead className="bg-muted/35 font-utility text-xs text-muted-foreground">
              <tr>
                <th className="w-[34%] px-5 py-3 font-semibold">成员</th>
                <th className="w-[25%] px-4 py-3 font-semibold">协作权限</th>
                <th className="w-[25%] px-4 py-3 font-semibold">玩家身份</th>
                <th className="w-[16%] px-5 py-3 text-right font-semibold">加入时间</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visibleMembers.map((member) => (
                <MemberTableRow
                  key={member.id}
                  member={member}
                  threadId={threadId}
                  isOwner={isOwner}
                  canManagePlayers={isOwner || isCollaborator}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border py-16">
          <EmptyState
            title="没有符合条件的成员"
            description="调整筛选条件或尝试其他用户名。"
          />
        </div>
      )}
    </div>
  );
}

function MemberTableRow({
  member,
  threadId,
  isOwner,
  canManagePlayers,
}: {
  member: ThreadMember;
  threadId: string;
  isOwner: boolean;
  canManagePlayers: boolean;
}) {
  const updateMember = useUpdateMember();
  const confirmAction = useConfirm();
  const [pendingKind, setPendingKind] = useState<"role" | "player" | null>(null);
  const isRowPending = updateMember.isPending;

  const handleTogglePlayer = async () => {
    setPendingKind("player");
    try {
      await updateMember.mutateAsync({
        threadId,
        userId: member.userId,
        playerMarked: !member.playerMarked,
      });
      toast.success(member.playerMarked ? "已收回玩家标记" : "已标记为玩家");
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "玩家标记修改失败"));
    } finally {
      setPendingKind(null);
    }
  };

  const handleToggleCollaborator = async () => {
    const granting = member.role !== "COLLABORATOR";
    if (!(await confirmAction({
      title: granting ? `授予 ${member.user.username} 协作权限` : `移除 ${member.user.username} 的协作权限`,
      description: granting
        ? "对方将可以编辑帖子内容、子贴和玩家标记，但不能修改可见性、任免协作者或删除主题帖。"
        : "对方将失去帖子管理能力，参与记录和玩家标记仍会保留。",
      confirmLabel: granting ? "授予协作权限" : "移除协作权限",
      destructive: !granting,
    }))) return;
    setPendingKind("role");
    try {
      await updateMember.mutateAsync({
        threadId,
        userId: member.userId,
        role: granting ? "COLLABORATOR" : "PARTICIPANT",
      });
      toast.success(granting ? "协作权限已授予" : "协作权限已移除");
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "协作权限修改失败"));
    } finally {
      setPendingKind(null);
    }
  };

  return (
    <tr className="transition-colors hover:bg-accent/15 focus-within:bg-accent/20">
      <td className="px-5 py-3.5">
        <Link
          href={`/users/${member.userId}`}
          className="group flex min-w-0 items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
        >
          <UserAvatar
            name={member.user.username}
            src={member.user.avatar ?? null}
            className="size-9"
            textClassName="text-xs"
          />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-foreground group-hover:text-brand-strong">
              {member.user.username}
            </span>
            <span className="mt-0.5 block font-utility text-[0.6875rem] text-muted-foreground">
              {member.role === "OWNER" ? "帖子创建者" : "参与人"}
            </span>
          </span>
        </Link>
      </td>
      <td className="px-4 py-3.5">
        {member.role === "OWNER" ? (
          <Badge tone="brand"><ShieldCheck className="mr-1 size-3.5" />楼主 · 固定</Badge>
        ) : isOwner ? (
          <Button
            type="button"
            variant={member.role === "COLLABORATOR" ? "secondary" : "outline"}
            size="compact"
            disabled={isRowPending}
            onClick={() => void handleToggleCollaborator()}
          >
            {pendingKind === "role" ? (
              <Loader2 className="animate-spin" />
            ) : member.role === "COLLABORATOR" ? (
              <ShieldCheck />
            ) : (
              <Shield />
            )}
            {member.role === "COLLABORATOR" ? "已获协作权限" : "授予协作权限"}
          </Button>
        ) : member.role === "COLLABORATOR" ? (
          <Badge tone="info"><ShieldCheck className="mr-1 size-3.5" />协作者</Badge>
        ) : (
          <span className="text-sm text-muted-foreground">普通成员</span>
        )}
      </td>
      <td className="px-4 py-3.5">
        {member.role === "OWNER" ? (
          <Badge tone="success"><UserCheck className="mr-1 size-3.5" />默认拥有</Badge>
        ) : canManagePlayers ? (
          <Button
            type="button"
            variant={member.playerMarked ? "secondary" : "outline"}
            size="compact"
            disabled={isRowPending}
            onClick={() => void handleTogglePlayer()}
          >
            {pendingKind === "player" ? (
              <Loader2 className="animate-spin" />
            ) : member.playerMarked ? (
              <UserCheck />
            ) : (
              <UserRound />
            )}
            {member.playerMarked ? "已标记玩家" : "标记为玩家"}
          </Button>
        ) : member.playerMarked ? (
          <Badge tone="success">玩家</Badge>
        ) : (
          <span className="text-sm text-muted-foreground">未标记</span>
        )}
      </td>
      <td className="px-5 py-3.5 text-right font-utility text-xs tabular-nums text-muted-foreground">
        <time dateTime={member.joinedAt}>{format(new Date(member.joinedAt), "yyyy-MM-dd")}</time>
      </td>
    </tr>
  );
}

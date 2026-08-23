"use client";

import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Search, Send, ShieldCheck, UserMinus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useQueryStates } from "nuqs";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import type { AdminAccount, AdminAccountsData } from "@/api/admin-types";
import { getApiErrorMessage } from "@/api/errors";
import {
  useAdminAccountActions,
  useAdminAccounts,
  useAdminSession,
  useAdminUserSearch,
} from "@/api/hooks/use-admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-provider";
import {
  Dialog,
  DialogBackdrop,
  DialogCloseButton,
  DialogDescription,
  DialogPopup,
  DialogPortal,
  DialogTitle,
  DialogViewport,
} from "@/components/ui/dialog";
import { WenyouTime } from "@/components/shared/wenyou-time";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  adminAccountFilterParsers,
  adminAccountUrlKeys,
  boundedAdminPageIndex,
} from "@/lib/admin-url-state";
import { AdminFilterBar, AdminFilterField, AdminPagination } from "./admin-list-controls";
import {
  AdminTable,
  AdminTableActionCell,
  AdminTableActionHeader,
  AdminTableBody,
  AdminTableCell,
  AdminTableEmpty,
  AdminTableHead,
  AdminTableHeader,
  AdminTableRow,
} from "./admin-table";

export function AdminAccountsPanel() {
  const router = useRouter();
  const confirm = useConfirm();
  const session = useAdminSession();
  const accounts = useAdminAccounts(session.data?.user.role === "SUPER_ADMIN");
  const actions = useAdminAccountActions();
  const [inviteQuery, setInviteQuery] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<AdminAccount>();
  const [referenceTime] = useState(() => Date.now());
  const search = useAdminUserSearch(inviteQuery);
  const [{
    accountQuery,
    role,
    sessionState,
    accountPage,
    pendingQuery,
    expiry,
    invitePage,
  }, setFilters] = useQueryStates(adminAccountFilterParsers, {
    shallow: true,
    urlKeys: adminAccountUrlKeys,
  });

  const filteredAccounts = useMemo(() => {
    const keyword = accountQuery.trim().toLocaleLowerCase();
    return (accounts.data?.accounts ?? []).filter((account) => {
      if (keyword && !`${account.username} ${account.email}`.toLocaleLowerCase().includes(keyword)) return false;
      if (role && account.role !== role) return false;
      if (sessionState === "ACTIVE" && account.adminSessions.length === 0) return false;
      if (sessionState === "OFFLINE" && account.adminSessions.length > 0) return false;
      return true;
    });
  }, [accountQuery, accounts.data?.accounts, role, sessionState]);
  const filteredInvites = useMemo(() => {
    const keyword = pendingQuery.trim().toLocaleLowerCase();
    return (accounts.data?.invites ?? []).filter((invite) => {
      if (keyword && !`${invite.user.username} ${invite.user.email}`.toLocaleLowerCase().includes(keyword)) return false;
      const expired = new Date(invite.expiresAt).getTime() <= referenceTime;
      if (expiry === "VALID" && expired) return false;
      if (expiry === "EXPIRED" && !expired) return false;
      return true;
    });
  }, [accounts.data?.invites, expiry, pendingQuery, referenceTime]);
  const accountPageIndex = boundedAdminPageIndex(accountPage, filteredAccounts.length, 10);
  const invitePageIndex = boundedAdminPageIndex(invitePage, filteredInvites.length, 5);

  const columns = useMemo<ColumnDef<AdminAccount>[]>(
    () => [
      {
        header: "站务账号",
        cell: ({ row }) => (
          <div>
            <p className="font-bold">{row.original.username}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{row.original.email}</p>
          </div>
        ),
      },
      {
        header: "角色",
        cell: ({ row }) => (
          <Badge tone={row.original.role === "SUPER_ADMIN" ? "brand" : "info"}>
            {row.original.role === "SUPER_ADMIN" ? "超级管理员" : "管理员"}
          </Badge>
        ),
      },
      {
        header: "当前会话",
        cell: ({ row }) => (
          <span className="font-utility text-xs text-muted-foreground">
            {row.original.adminSessions.length > 0 ? (
              <>活跃至 <WenyouTime value={row.original.adminSessions[0].expiresAt} /></>
            ) : "未登录"}
          </span>
        ),
      },
      {
        id: "actions",
        header: "操作",
        cell: ({ row }) => {
          const account = row.original;
          if (account.role === "SUPER_ADMIN") return <span className="text-xs text-muted-foreground">唯一席位</span>;
          return (
            <Button type="button" size="compact" variant="ghost" onClick={() => setSelectedAccount(account)}>操作</Button>
          );
        },
      },
    ],
    [],
  );
  // TanStack Table intentionally exposes mutable table methods; React Compiler skips this component.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: filteredAccounts,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    state: { pagination: { pageIndex: accountPageIndex, pageSize: 10 } },
    onPaginationChange: (updater) => {
      const current = { pageIndex: accountPageIndex, pageSize: 10 };
      const next = typeof updater === "function" ? updater(current) : updater;
      void setFilters({ accountPage: next.pageIndex + 1 }, { history: "push" });
    },
    autoResetPageIndex: false,
  });
  const inviteTable = useReactTable<AdminAccountsData["invites"][number]>({
    data: filteredInvites,
    columns: [],
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    state: { pagination: { pageIndex: invitePageIndex, pageSize: 5 } },
    onPaginationChange: (updater) => {
      const current = { pageIndex: invitePageIndex, pageSize: 5 };
      const next = typeof updater === "function" ? updater(current) : updater;
      void setFilters({ invitePage: next.pageIndex + 1 }, { history: "push" });
    },
    autoResetPageIndex: false,
  });

  if (accounts.isLoading) return <p className="text-sm text-muted-foreground">正在读取站务账号…</p>;
  if (accounts.isError || !accounts.data) return <p className="text-sm text-destructive">站务账号加载失败</p>;

  return (
    <div data-slot="admin-accounts-workspace" data-layout="full-table" className="w-full space-y-6">
        <section className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <h2 className="font-display text-lg font-medium">现有站务</h2>
              <p className="mt-1 text-xs text-muted-foreground">一个账号同一时间只允许一个后台会话。</p>
            </div>
            <div className="flex items-center gap-3">
              <Badge tone="neutral">{filteredAccounts.length} / {accounts.data.accounts.length} 人</Badge>
              <Button type="button" onClick={() => setInviteOpen(true)}><Send />邀请站务</Button>
            </div>
          </div>
          <AdminFilterBar
            activeCount={(accountQuery.trim() ? 1 : 0) + (role ? 1 : 0) + (sessionState ? 1 : 0)}
            onReset={() => void setFilters({ accountQuery: null, role: null, sessionState: null, accountPage: null }, { history: "push" })}
          >
            <AdminFilterField label="关键词" className="w-52">
              <span className="relative block">
                <Search className="pointer-events-none absolute top-2.5 left-3.5 size-4 text-muted-foreground" />
                <Input value={accountQuery} onChange={(event) => void setFilters({ accountQuery: event.target.value, accountPage: null })} className="pl-10" placeholder="用户名或邮箱" />
              </span>
            </AdminFilterField>
            <AdminFilterField label="角色" className="w-36">
              <Select value={role ?? "ALL"} onValueChange={(value) => void setFilters({ role: value === "ALL" ? null : value as NonNullable<typeof role>, accountPage: null }, { history: "push" })}>
                <SelectTrigger className="w-full"><SelectValue>{!role ? "全部角色" : role === "ADMIN" ? "管理员" : "超级管理员"}</SelectValue></SelectTrigger>
                <SelectContent align="start">
                  <SelectItem value="ALL">全部角色</SelectItem>
                  <SelectItem value="ADMIN">管理员</SelectItem>
                  <SelectItem value="SUPER_ADMIN">超级管理员</SelectItem>
                </SelectContent>
              </Select>
            </AdminFilterField>
            <AdminFilterField label="会话" className="w-32">
              <Select value={sessionState ?? "ALL"} onValueChange={(value) => void setFilters({ sessionState: value === "ALL" ? null : value as NonNullable<typeof sessionState>, accountPage: null }, { history: "push" })}>
                <SelectTrigger className="w-full"><SelectValue>{!sessionState ? "全部会话" : sessionState === "ACTIVE" ? "当前活跃" : "当前离线"}</SelectValue></SelectTrigger>
                <SelectContent align="start">
                  <SelectItem value="ALL">全部会话</SelectItem>
                  <SelectItem value="ACTIVE">当前活跃</SelectItem>
                  <SelectItem value="OFFLINE">当前离线</SelectItem>
                </SelectContent>
              </Select>
            </AdminFilterField>
          </AdminFilterBar>
          <AdminTable aria-label="现有站务账号" className="min-w-[48rem]">
            <AdminTableHead>
              {table.getHeaderGroups().map((group) => (
                <tr key={group.id}>
                  {group.headers.map((header) => header.column.id === "actions" ? (
                    <AdminTableActionHeader key={header.id}>
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </AdminTableActionHeader>
                  ) : (
                    <AdminTableHeader key={header.id}>
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </AdminTableHeader>
                  ))}
                </tr>
              ))}
            </AdminTableHead>
            <AdminTableBody>
              {table.getRowModel().rows.map((row) => (
                <AdminTableRow key={row.id} data-selected={selectedAccount?.id === row.original.id}>
                  {row.getVisibleCells().map((cell) => cell.column.id === "actions" ? (
                    <AdminTableActionCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </AdminTableActionCell>
                  ) : (
                    <AdminTableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </AdminTableCell>
                  ))}
                </AdminTableRow>
              ))}
              {table.getRowModel().rows.length === 0 ? <AdminTableEmpty colSpan={4}>当前筛选下没有站务账号</AdminTableEmpty> : null}
            </AdminTableBody>
          </AdminTable>
          <AdminPagination
            page={table.getState().pagination.pageIndex + 1}
            pageSize={table.getState().pagination.pageSize}
            visibleCount={table.getRowModel().rows.length}
            hasPrevious={table.getCanPreviousPage()}
            hasNext={table.getCanNextPage()}
            onPrevious={() => table.previousPage()}
            onNext={() => table.nextPage()}
          />
        </section>

        <section className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="flex items-center gap-3 px-5 py-5">
            <ShieldCheck className="size-5 text-brand-strong" />
            <div>
              <h2 className="font-display text-lg font-medium">待接受邀请</h2>
              <p className="text-xs text-muted-foreground">邀请 24 小时后自动失效。</p>
            </div>
          </div>
          <AdminFilterBar
            activeCount={(pendingQuery.trim() ? 1 : 0) + (expiry ? 1 : 0)}
            onReset={() => void setFilters({ pendingQuery: null, expiry: null, invitePage: null }, { history: "push" })}
          >
            <AdminFilterField label="关键词" className="w-52">
              <Input value={pendingQuery} onChange={(event) => void setFilters({ pendingQuery: event.target.value, invitePage: null })} placeholder="用户名或邮箱" />
            </AdminFilterField>
            <AdminFilterField label="有效期" className="w-32">
              <Select value={expiry ?? "ALL"} onValueChange={(value) => void setFilters({ expiry: value === "ALL" ? null : value as NonNullable<typeof expiry>, invitePage: null }, { history: "push" })}>
                <SelectTrigger className="w-full"><SelectValue>{!expiry ? "全部邀请" : expiry === "VALID" ? "有效" : "已过期"}</SelectValue></SelectTrigger>
                <SelectContent align="start">
                  <SelectItem value="ALL">全部邀请</SelectItem>
                  <SelectItem value="VALID">有效</SelectItem>
                  <SelectItem value="EXPIRED">已过期</SelectItem>
                </SelectContent>
              </Select>
            </AdminFilterField>
          </AdminFilterBar>
          <AdminTable aria-label="待接受站务邀请" className="min-w-[56rem]">
            <AdminTableHead>
              <tr>
                <AdminTableHeader>受邀用户</AdminTableHeader>
                <AdminTableHeader>邮箱</AdminTableHeader>
                <AdminTableHeader>到期时间</AdminTableHeader>
                <AdminTableHeader>状态</AdminTableHeader>
                <AdminTableActionHeader>操作</AdminTableActionHeader>
              </tr>
            </AdminTableHead>
            <AdminTableBody>
              {inviteTable.getRowModel().rows.map(({ original: invite }) => (
                <AdminTableRow key={invite.id}>
                  <AdminTableCell className="font-bold">{invite.user.username}</AdminTableCell>
                  <AdminTableCell className="text-xs text-muted-foreground">{invite.user.email}</AdminTableCell>
                  <AdminTableCell className="text-xs whitespace-nowrap text-muted-foreground"><WenyouTime value={invite.expiresAt} /></AdminTableCell>
                  <AdminTableCell><Badge tone={new Date(invite.expiresAt).getTime() > referenceTime ? "info" : "neutral"}>{new Date(invite.expiresAt).getTime() > referenceTime ? "有效" : "已过期"}</Badge></AdminTableCell>
                  <AdminTableActionCell>
                    <Button
                      size="compact"
                      variant="ghost"
                      onClick={async () => {
                        try {
                          await actions.cancelInvite.mutateAsync({ id: invite.id, reason: "邀请不再需要" });
                          toast.success("邀请已取消");
                        } catch (error) {
                          toast.error(getApiErrorMessage(error, "取消失败"));
                        }
                      }}
                    >
                      取消邀请
                    </Button>
                  </AdminTableActionCell>
                </AdminTableRow>
              ))}
              {filteredInvites.length === 0 ? <AdminTableEmpty colSpan={5}>当前筛选下没有待处理邀请</AdminTableEmpty> : null}
            </AdminTableBody>
          </AdminTable>
          <AdminPagination
            page={inviteTable.getState().pagination.pageIndex + 1}
            pageSize={inviteTable.getState().pagination.pageSize}
            visibleCount={inviteTable.getRowModel().rows.length}
            hasPrevious={inviteTable.getCanPreviousPage()}
            hasNext={inviteTable.getCanNextPage()}
            onPrevious={() => inviteTable.previousPage()}
            onNext={() => inviteTable.nextPage()}
          />
        </section>

      <Dialog open={inviteOpen} onOpenChange={(open) => {
        if (!actions.invite.isPending) {
          setInviteOpen(open);
          if (!open) setInviteQuery("");
        }
      }}>
        <DialogPortal>
          <DialogBackdrop />
          <DialogViewport>
            <DialogPopup data-admin-action-dialog className="max-w-2xl">
              <div className="flex items-start justify-between gap-5 border-b border-border px-6 py-5">
                <div>
                  <DialogTitle>邀请现有用户</DialogTitle>
                  <DialogDescription className="mt-1">管理员继承现有温油账号，只有普通用户可以被邀请。</DialogDescription>
                </div>
                <DialogCloseButton type="button" label="关闭邀请站务" disabled={actions.invite.isPending} />
              </div>
              <div className="px-6 py-6">
                <div className="relative">
                  <Search className="pointer-events-none absolute top-3.5 left-3.5 size-4 text-muted-foreground" />
                  <Input value={inviteQuery} onChange={(event) => setInviteQuery(event.target.value)} placeholder="用户名或邮箱" className="pl-10" />
                </div>
                <div className="mt-3 space-y-2">
                  {search.data?.filter((user) => user.role === "USER").map((user) => (
                    <div key={user.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold">{user.username}</p>
                        <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                      </div>
                      <Button
                        size="compact"
                        disabled={actions.invite.isPending}
                        onClick={async () => {
                          try {
                            await actions.invite.mutateAsync(user.id);
                            toast.success("管理员邀请已发送");
                            setInviteQuery("");
                            setInviteOpen(false);
                          } catch (error) {
                            toast.error(getApiErrorMessage(error, "邀请失败"));
                          }
                        }}
                      >
                        <Send />发送邀请
                      </Button>
                    </div>
                  ))}
                  {inviteQuery.length >= 2 && !search.isLoading && search.data?.length === 0 ? <p className="py-4 text-center text-xs text-muted-foreground">没有匹配用户</p> : null}
                </div>
              </div>
            </DialogPopup>
          </DialogViewport>
        </DialogPortal>
      </Dialog>

      {selectedAccount ? (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open && !actions.transfer.isPending && !actions.revoke.isPending) setSelectedAccount(undefined);
          }}
        >
          <DialogPortal>
            <DialogBackdrop />
            <DialogViewport>
              <DialogPopup data-admin-action-dialog className="max-w-2xl">
                <div className="flex items-start justify-between gap-5 border-b border-border px-6 py-5">
                  <div>
                    <DialogTitle>管理 {selectedAccount.username}</DialogTitle>
                    <DialogDescription className="mt-1">{selectedAccount.email} · 高风险操作仍需二次确认。</DialogDescription>
                  </div>
                  <DialogCloseButton
                    type="button"
                    label="关闭站务账号操作"
                    disabled={actions.transfer.isPending || actions.revoke.isPending}
                  />
                </div>
                <div className="space-y-3 px-6 py-6">
                  <div className="flex items-center justify-between gap-5 rounded-xl border border-border p-4">
                    <div>
                      <p className="text-sm font-bold">移交超级管理员席位</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">移交后双方站务会话都会退出。</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={actions.transfer.isPending}
                      onClick={async () => {
                        const accepted = await confirm({
                          title: "移交超级管理员？",
                          description: `移交给 ${selectedAccount.username} 后，双方站务会话都会退出。`,
                          confirmLabel: "确认移交",
                        });
                        if (!accepted) return;
                        try {
                          await actions.transfer.mutateAsync({ userId: selectedAccount.id, reason: "超级管理员主动移交" });
                          toast.success("超级管理员已移交");
                          setSelectedAccount(undefined);
                          router.replace("/station");
                        } catch (error) {
                          toast.error(getApiErrorMessage(error, "移交失败"));
                        }
                      }}
                    >移交席位</Button>
                  </div>
                  <div className="flex items-center justify-between gap-5 rounded-xl border border-destructive/25 bg-destructive-soft/40 p-4">
                    <div>
                      <p className="text-sm font-bold">撤销管理员身份</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">普通登录和站务会话都会立即退出。</p>
                    </div>
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={actions.revoke.isPending}
                      onClick={async () => {
                        const accepted = await confirm({
                          title: "撤销管理员身份？",
                          description: `${selectedAccount.username} 的普通登录和站务会话都会立即退出。`,
                          confirmLabel: "撤销身份",
                          destructive: true,
                        });
                        if (!accepted) return;
                        try {
                          await actions.revoke.mutateAsync({ id: selectedAccount.id, reason: "超级管理员撤销站务权限" });
                          toast.success("管理员身份已撤销");
                          setSelectedAccount(undefined);
                        } catch (error) {
                          toast.error(getApiErrorMessage(error, "撤销失败"));
                        }
                      }}
                    ><UserMinus />撤权</Button>
                  </div>
                </div>
              </DialogPopup>
            </DialogViewport>
          </DialogPortal>
        </Dialog>
      ) : null}
    </div>
  );
}

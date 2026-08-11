"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { addMinutes, format } from "date-fns";
import { BellRing, CalendarClock, Search, Send } from "lucide-react";
import { useQueryStates } from "nuqs";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { useDebounce } from "use-debounce";
import { z } from "zod";
import { getApiErrorMessage } from "@/api/errors";
import {
  type NotificationCampaignFilters,
  useNotificationCampaignActions,
  useNotificationCampaigns,
} from "@/api/hooks/use-admin";
import { AdminFilterBar, AdminFilterField, AdminPagination } from "./admin-list-controls";
import {
  AdminTable,
  AdminTableBody,
  AdminTableCell,
  AdminTableEmpty,
  AdminTableHead,
  AdminTableHeader,
  AdminTableRow,
} from "./admin-table";
import { useCursorPagination } from "./use-cursor-pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { adminAnnouncementFilterParsers, adminAnnouncementUrlKeys } from "@/lib/admin-url-state";

const schema = z.object({
  title: z.string().trim().min(1).max(60),
  content: z.string().trim().min(1).max(1000),
  scheduledAt: z.string().min(1, "请选择发送时间"),
  audience: z.enum(["ALL", "USERS", "VERIFIED"]),
  destinationId: z.string(),
});
type Values = z.infer<typeof schema>;

const audienceItems = [
  { value: "ALL", label: "全站所有账号" },
  { value: "USERS", label: "仅普通用户" },
  { value: "VERIFIED", label: "已验证邮箱用户" },
];

const campaignStatusLabels: Record<string, string> = {
  SCHEDULED: "待发送",
  SENDING: "发送中",
  SENT: "已发送",
  CANCELED: "已取消",
  FAILED: "发送失败",
};

function audienceBody(value: Values["audience"]) {
  if (value === "USERS") return { roles: ["USER" as const] };
  if (value === "VERIFIED") return { emailVerified: true };
  return {};
}

function statusTone(status: string) {
  if (status === "SENT") return "success" as const;
  if (status === "SCHEDULED" || status === "SENDING") return "info" as const;
  if (status === "FAILED") return "danger" as const;
  return "neutral" as const;
}

export function AnnouncementsPanel() {
  const [{ query, status, destination }, setFilters] = useQueryStates(adminAnnouncementFilterParsers, {
    shallow: true,
    urlKeys: adminAnnouncementUrlKeys,
  });
  const [debounced] = useDebounce(query, 250);
  const pagination = useCursorPagination(`${debounced}:${status ?? "ALL"}:${destination ?? "ALL"}`);
  const campaigns = useNotificationCampaigns({
    q: debounced || undefined,
    status: status ?? undefined,
    destination: destination ?? undefined,
    cursor: pagination.cursor,
    limit: 20,
  });
  const actions = useNotificationCampaignActions();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      content: "",
      scheduledAt: format(addMinutes(new Date(), 5), "yyyy-MM-dd'T'HH:mm"),
      audience: "ALL",
      destinationId: "",
    },
  });
  const audience = useWatch({ control: form.control, name: "audience" });
  const activeCount = (query.trim() ? 1 : 0) + (status ? 1 : 0) + (destination ? 1 : 0);

  return (
    <div className="grid grid-cols-[24rem_minmax(0,1fr)] gap-6">
      <section className="self-start rounded-lg border border-border bg-card p-6">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground"><BellRing className="size-5" /></span>
          <div><h2 className="font-display text-xl font-bold">新建站内通知</h2><p className="text-xs text-muted-foreground">系统会分批投递，可立即或定时发送。</p></div>
        </div>
        <form
          className="mt-6 space-y-4"
          onSubmit={form.handleSubmit(async (values) => {
            try {
              await actions.create.mutateAsync({
                title: values.title,
                content: values.content,
                scheduledAt: new Date(values.scheduledAt).toISOString(),
                audience: audienceBody(values.audience),
                ...(values.destinationId ? { destinationType: "THREAD" as const, destinationId: values.destinationId } : {}),
              });
              toast.success("通知计划已创建");
              form.reset({ ...values, title: "", content: "", scheduledAt: format(addMinutes(new Date(), 5), "yyyy-MM-dd'T'HH:mm") });
            } catch (error) { toast.error(getApiErrorMessage(error, "通知计划创建失败")); }
          })}
        >
          <div className="space-y-2"><Label htmlFor="campaign-title">标题</Label><Input id="campaign-title" {...form.register("title")} /></div>
          <div className="space-y-2"><Label htmlFor="campaign-content">正文</Label><Textarea id="campaign-content" rows={5} {...form.register("content")} /></div>
          <div className="space-y-2">
            <Label>接收范围</Label>
            <Select items={audienceItems} value={audience} onValueChange={(value) => form.setValue("audience", value as Values["audience"])}>
              <SelectTrigger className="w-full"><SelectValue>{audienceItems.find((item) => item.value === audience)?.label}</SelectValue></SelectTrigger>
              <SelectContent align="start">{audienceItems.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label htmlFor="campaign-time">发送时间</Label><Input id="campaign-time" type="datetime-local" {...form.register("scheduledAt")} /></div>
          <div className="space-y-2"><Label htmlFor="campaign-thread">跳转到主题帖（填写主题帖编号，可选）</Label><Input id="campaign-thread" placeholder="粘贴主题帖编号" {...form.register("destinationId")} /></div>
          <div className="flex items-center justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={actions.preview.isPending}
              onClick={async () => {
                try {
                  const result = await actions.preview.mutateAsync(audienceBody(form.getValues("audience")));
                  toast.info(`预计送达 ${result.recipientCount} 个账号`);
                } catch (error) { toast.error(getApiErrorMessage(error, "人数预估失败")); }
              }}
            >预估人数</Button>
            <Button type="submit" disabled={actions.create.isPending}><Send />{actions.create.isPending ? "正在创建…" : "创建发送计划"}</Button>
          </div>
        </form>
      </section>

      <section className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="flex items-center gap-3 border-b border-border px-6 py-5">
          <CalendarClock className="size-5 text-brand-strong" />
          <div><h2 className="font-display text-lg font-bold">发送计划与历史</h2><p className="text-xs text-muted-foreground">进入发送队列后不允许取消，避免部分用户收到后回滚。</p></div>
        </div>
        <AdminFilterBar
          activeCount={activeCount}
          onReset={() => void setFilters(null, { history: "push" })}
          summary={campaigns.data ? `当前页 ${campaigns.data.items.length} 条` : undefined}
        >
          <AdminFilterField label="关键词" className="w-52">
            <span className="relative block">
              <Search className="pointer-events-none absolute top-2.5 left-3.5 size-4 text-muted-foreground" />
              <Input value={query} onChange={(event) => void setFilters({ query: event.target.value })} className="pl-10" placeholder="标题或正文" />
            </span>
          </AdminFilterField>
          <AdminFilterField label="发送状态" className="w-36">
            <Select value={status ?? "ALL"} onValueChange={(value) => void setFilters({ status: value === "ALL" ? null : value as NonNullable<NotificationCampaignFilters["status"]> }, { history: "push" })}>
              <SelectTrigger className="w-full"><SelectValue>{!status ? "全部状态" : status === "SCHEDULED" ? "待发送" : status === "SENDING" ? "发送中" : status === "SENT" ? "已发送" : status === "CANCELED" ? "已取消" : "失败"}</SelectValue></SelectTrigger>
              <SelectContent align="start">
                <SelectItem value="ALL">全部状态</SelectItem>
                <SelectItem value="SCHEDULED">待发送</SelectItem>
                <SelectItem value="SENDING">发送中</SelectItem>
                <SelectItem value="SENT">已发送</SelectItem>
                <SelectItem value="CANCELED">已取消</SelectItem>
                <SelectItem value="FAILED">失败</SelectItem>
              </SelectContent>
            </Select>
          </AdminFilterField>
          <AdminFilterField label="跳转目标" className="w-36">
            <Select value={destination ?? "ALL"} onValueChange={(value) => void setFilters({ destination: value === "ALL" ? null : value as NonNullable<NotificationCampaignFilters["destination"]> }, { history: "push" })}>
              <SelectTrigger className="w-full"><SelectValue>{!destination ? "全部计划" : destination === "THREAD" ? "主题帖" : "无跳转"}</SelectValue></SelectTrigger>
              <SelectContent align="start">
                <SelectItem value="ALL">全部计划</SelectItem>
                <SelectItem value="THREAD">主题帖</SelectItem>
                <SelectItem value="NONE">无跳转</SelectItem>
              </SelectContent>
            </Select>
          </AdminFilterField>
        </AdminFilterBar>
        <AdminTable aria-label="通知发送计划">
          <AdminTableHead>
            <tr>
              <AdminTableHeader>状态</AdminTableHeader>
              <AdminTableHeader>通知内容</AdminTableHeader>
              <AdminTableHeader>发送时间</AdminTableHeader>
              <AdminTableHeader className="text-right">送达人数</AdminTableHeader>
              <AdminTableHeader>创建人</AdminTableHeader>
              <AdminTableHeader className="text-right">操作</AdminTableHeader>
            </tr>
          </AdminTableHead>
          <AdminTableBody>
          {campaigns.isLoading ? <AdminTableEmpty colSpan={6}>正在读取通知计划…</AdminTableEmpty> : null}
          {campaigns.isError ? <AdminTableEmpty colSpan={6}><span className="text-destructive">通知计划加载失败</span></AdminTableEmpty> : null}
          {campaigns.data?.items.map((campaign) => (
            <AdminTableRow key={campaign.id}>
              <AdminTableCell><Badge tone={statusTone(campaign.status)}>{campaignStatusLabels[campaign.status]}</Badge></AdminTableCell>
              <AdminTableCell className="max-w-80">
                <p className="font-bold">{campaign.title}</p>
                <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-muted-foreground">{campaign.content}</p>
              </AdminTableCell>
              <AdminTableCell className="font-utility text-xs whitespace-nowrap text-muted-foreground">{format(new Date(campaign.scheduledAt), "yyyy-MM-dd HH:mm")}</AdminTableCell>
              <AdminTableCell className="text-right font-utility text-xs whitespace-nowrap"><span className="font-bold text-foreground">{campaign.recipientCount}</span><span className="text-muted-foreground"> / 预计 {campaign.estimatedCount}</span></AdminTableCell>
              <AdminTableCell className="whitespace-nowrap">{campaign.createdBy.username}</AdminTableCell>
              <AdminTableCell className="text-right">
                {campaign.status === "SCHEDULED" ? (
                  <Button
                    size="compact"
                    variant="ghost"
                    onClick={async () => {
                      try { await actions.cancel.mutateAsync(campaign.id); toast.success("通知计划已取消"); }
                      catch (error) { toast.error(getApiErrorMessage(error, "取消失败")); }
                    }}
                  >取消</Button>
                ) : <span className="text-xs text-muted-foreground">—</span>}
              </AdminTableCell>
            </AdminTableRow>
          ))}
          {!campaigns.isLoading && !campaigns.isError && campaigns.data?.items.length === 0 ? <AdminTableEmpty colSpan={6}>当前筛选下没有通知计划</AdminTableEmpty> : null}
          </AdminTableBody>
        </AdminTable>
        <AdminPagination
          page={pagination.page}
          pageSize={20}
          visibleCount={campaigns.data?.items.length ?? 0}
          hasPrevious={pagination.hasPrevious}
          hasNext={Boolean(campaigns.data?.meta?.hasMore && campaigns.data.meta.cursor)}
          onPrevious={pagination.previous}
          onNext={() => {
            if (campaigns.data?.meta?.cursor) pagination.next(campaigns.data.meta.cursor);
          }}
          busy={campaigns.isFetching}
        />
      </section>
    </div>
  );
}

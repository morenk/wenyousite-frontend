"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Dialog, DialogBackdrop, DialogCloseButton, DialogPopup, DialogPortal, DialogTitle, DialogViewport } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { getApiErrorMessage } from "@/api/errors";
import { type AdminUser, useAdminUserActions } from "@/api/hooks/use-admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
export const sanctionSchema = z.object({
  reason: z.string().trim().min(1, "请填写理由").refine((value) => Array.from(value).length <= 500, "最多 500 个字符"),
  endsAt: z.string(),
});
type SanctionValues = z.infer<typeof sanctionSchema>;

export function UserAccountState({ user: selected }: { user: AdminUser }) {
  const actions = useAdminUserActions();
  const [open, setOpen] = useState(false);
  const form = useForm<SanctionValues>({
    resolver: zodResolver(sanctionSchema),
    defaultValues: { reason: "", endsAt: "" },
  });
  const applySanction = (type: "SUSPENSION" | "BAN") => {
    void form.handleSubmit(async (values) => {
      if (!selected) return;
      if (type === "SUSPENSION" && !values.endsAt) {
        form.setError("endsAt", { message: "暂停账号需要结束时间" });
        return;
      }
      try {
        await actions.sanction.mutateAsync({
          id: selected.id,
          type,
          reason: values.reason,
          endsAt: type === "SUSPENSION" ? new Date(values.endsAt).toISOString() : undefined,
        });
        toast.success(type === "BAN" ? "账号已永久封禁" : "账号已暂停");
        form.reset();
        setOpen(false);

      } catch (error) {
        form.setError("root", { message: getApiErrorMessage(error, "修改失败") });
      }
    })();
  };


  return <section className="rounded-[var(--radius-card)] border border-border bg-card p-4">
    <h2 className="mb-3 text-base font-semibold">账号状态</h2>
    <div className="flex items-center gap-3 text-sm"><span>{selected.moderationStatus === "ACTIVE" ? "正常" : selected.moderationStatus === "SUSPENDED" ? "暂停" : "封禁"}</span><Button size="compact" variant="outline" onClick={() => setOpen(true)}>修改状态</Button></div>
    <Dialog open={open} onOpenChange={(next) => { if (!actions.sanction.isPending && !actions.revoke.isPending) setOpen(next); }}>
      <DialogPortal><DialogBackdrop /><DialogViewport><DialogPopup data-admin-action-dialog className="max-w-xl p-4">
        <div className="mb-4 flex items-center justify-between"><DialogTitle>账号状态</DialogTitle><DialogCloseButton label="关闭账号状态" disabled={actions.sanction.isPending || actions.revoke.isPending} /></div>
    {form.formState.errors.root ? <p role="alert" className="mb-3 text-sm text-destructive">{form.formState.errors.root.message}</p> : null}
                  {selected.currentSanction ? (
                    <div className="rounded-[var(--radius-compact)] bg-destructive-soft p-4 text-sm text-destructive">
                      <p className="font-bold">当前处罚 · {selected.currentSanction.type === "SUSPENSION" ? "暂停账号" : "永久封禁"}</p>
                      <p className="mt-1 text-xs leading-5">{selected.currentSanction.reason}</p>
                      <Button
                        size="compact"
                        variant="outline"
                        className="mt-3"
                        disabled={actions.revoke.isPending}
                        onClick={async () => {
                          try {
                            await actions.revoke.mutateAsync({ id: selected.id, reason: form.getValues("reason") || "管理员复核后解除处罚" });
                            toast.success("处罚已解除");
                            setOpen(false);

                          } catch (error) {
                            form.setError("root", { message: getApiErrorMessage(error, "解除失败") });
                          }
                        }}
                      >解除处罚</Button>
                    </div>
                  ) : selected.role !== "USER" ? (
                    <p className="rounded-[var(--radius-compact)] bg-muted p-4 text-sm text-muted-foreground">管理员账号需由超级管理员管理。</p>
                  ) : (
                    <form className="space-y-5" onSubmit={(event) => event.preventDefault()}>
                      <div className="space-y-2">
                        <Label htmlFor="sanction-reason">处罚理由</Label>
                        <Textarea id="sanction-reason" rows={4} {...form.register("reason")} />
                        {form.formState.errors.reason ? <p className="text-xs text-destructive">{form.formState.errors.reason.message}</p> : null}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="sanction-until">暂停至</Label>
                        <Input id="sanction-until" type="datetime-local" {...form.register("endsAt")} />
                        {form.formState.errors.endsAt ? <p className="text-xs text-destructive">{form.formState.errors.endsAt.message}</p> : null}
                      </div>
                      <div className="flex justify-end gap-2 border-t border-border pt-5">
                        <Button type="button" variant="outline" disabled={actions.sanction.isPending} onClick={() => applySanction("SUSPENSION")}>暂停账号</Button>
                        <Button type="button" variant="destructive" disabled={actions.sanction.isPending} onClick={() => applySanction("BAN")}>永久封禁</Button>
                      </div>
                    </form>
                  )}
  </DialogPopup></DialogViewport></DialogPortal></Dialog>
  </section>;
}

"use client";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAdminTextFontActions } from "@/api/hooks/admin/use-admin-text-fonts";
import { useAdminSession } from "@/api/hooks/use-admin";
import { getApiErrorMessage } from "@/api/errors";
import { textFontWithdrawSchema } from "@/lib/admin-text-font-form";
import { HighRiskGate } from "./high-risk-gate";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogPortal,
  DialogBackdrop,
  DialogViewport,
  DialogPopup,
  DialogTitle,
  DialogCloseButton,
} from "@/components/ui/dialog";
export function TextFontWithdrawDialog({
  versionId,
  revision,
  onClose,
}: {
  versionId: string;
  revision: number;
  onClose: () => void;
}) {
  const actions = useAdminTextFontActions(),
    lock = useRef(false),
    [busy, setBusy] = useState(false);
  const authenticated = useAdminSession().sessionStatus === "authenticated";
  const form = useForm<{ reason: string }>({
    resolver: zodResolver(textFontWithdrawSchema),
    defaultValues: { reason: "" },
  });
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogPortal>
        <DialogBackdrop />
        <DialogViewport>
          <DialogPopup data-admin-action-dialog className="max-w-lg">
            <div className="flex items-center justify-between border-b border-border p-4">
              <DialogTitle>撤回字体版本</DialogTitle>
              <DialogCloseButton
                label="关闭撤回"
                disabled={busy || !authenticated}
              />
            </div>
            <HighRiskGate>
              <form
                className="space-y-4 p-4"
                onSubmit={(event) =>
                  void form.handleSubmit(async (values) => {
                    if (lock.current || !authenticated) return;
                    lock.current = true;
                    setBusy(true);
                    try {
                      await actions.withdraw.mutateAsync({
                        versionId,
                        expectedCatalogRevision: revision,
                        reason: values.reason,
                      });
                      onClose();
                    } catch (error) {
                      form.setError("root", {
                        message: getApiErrorMessage(
                          error,
                          "撤回失败，请读取最新状态后重试",
                        ),
                      });
                    } finally {
                      lock.current = false;
                      setBusy(false);
                    }
                  })(event)
                }
              >
                <p className="text-sm">
                  撤回后新版客户端停止下载和呈现；旧版客户端可能不受影响。历史正文保留，撤回不可恢复。
                </p>
                <FormField
                  id="font-withdraw-reason"
                  label="撤回理由"
                  error={form.formState.errors.reason?.message}
                  errorRole="alert"
                >
                  {(props) => (
                    <Textarea
                      {...props}
                      {...form.register("reason")}
                      disabled={busy || !authenticated}
                    />
                  )}
                </FormField>
                {form.formState.errors.root && (
                  <p role="alert" className="text-sm text-destructive">
                    {form.formState.errors.root.message}
                  </p>
                )}
                <Button
                  type="submit"
                  disabled={busy || !authenticated}
                  variant="destructive"
                >
                  {busy ? "正在撤回…" : "确认撤回"}
                </Button>
              </form>
            </HighRiskGate>
          </DialogPopup>
        </DialogViewport>
      </DialogPortal>
    </Dialog>
  );
}

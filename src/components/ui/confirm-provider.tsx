/** 全局无障碍确认对话框，替代业务组件中的浏览器 confirm。 */

"use client";

import { AlertDialog } from "@base-ui/react/alert-dialog";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ConfirmOptions {
  title?: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

type Confirm = (options: ConfirmOptions) => Promise<boolean>;

const fallbackConfirm: Confirm = async ({ description }) =>
  typeof window !== "undefined" && window.confirm(description);

const ConfirmContext = createContext<Confirm>(fallbackConfirm);

export function useConfirm() {
  return useContext(ConfirmContext);
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<ConfirmOptions | null>(null);
  const resolveRef = useRef<((confirmed: boolean) => void) | null>(null);

  const finish = useCallback((confirmed: boolean) => {
    const resolve = resolveRef.current;
    resolveRef.current = null;
    setRequest(null);
    resolve?.(confirmed);
  }, []);

  const confirm = useCallback<Confirm>((options) => {
    resolveRef.current?.(false);
    setRequest(options);
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  useEffect(() => () => resolveRef.current?.(false), []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialog.Root
        open={request !== null}
        onOpenChange={(open) => {
          if (!open && request) finish(false);
        }}
      >
        <AlertDialog.Portal>
          <AlertDialog.Backdrop className="fixed inset-0 z-[80] bg-[rgb(53_39_44/40%)]" />
          <AlertDialog.Viewport className="fixed inset-0 z-[81] flex items-center justify-center p-6">
            <AlertDialog.Popup className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-dialog outline-none">
              <AlertDialog.Title className="text-base font-semibold">
                {request?.title ?? "请确认操作"}
              </AlertDialog.Title>
              <AlertDialog.Description className="mt-2 text-sm leading-6 text-muted-foreground">
                {request?.description}
              </AlertDialog.Description>
              <div className="mt-6 flex justify-end gap-2">
                <AlertDialog.Close className={buttonVariants({ variant: "outline" })}>
                  {request?.cancelLabel ?? "取消"}
                </AlertDialog.Close>
                <button
                  type="button"
                  className={cn(
                    buttonVariants({
                      variant: request?.destructive ? "destructive" : "default",
                    }),
                  )}
                  onClick={() => finish(true)}
                >
                  {request?.confirmLabel ?? "确认"}
                </button>
              </div>
            </AlertDialog.Popup>
          </AlertDialog.Viewport>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </ConfirmContext.Provider>
  );
}

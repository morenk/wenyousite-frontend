"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { DoorOpen } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBackdrop,
  DialogCloseButton,
  DialogDescription,
  DialogFooter,
  DialogPopup,
  DialogPortal,
  DialogTitle,
  DialogViewport,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  parseInternalReference,
  serializeInternalReference,
} from "@/lib/internal-reference";

const schema = z.object({
  label: z.string().trim().min(1, "请填写显示名称").max(40, "名称最多 40 个字"),
  href: z.string().trim().refine(
    (value) => !!parseInternalReference(value),
    "仅支持主题帖、子贴、楼层、回复或私密邀请链接",
  ),
});

type FormValues = z.infer<typeof schema>;

interface InternalReferenceInsertProps {
  onInsert: (markdown: string) => void;
  getSuggestedLabel?: () => string;
  disabled?: boolean;
  className?: string;
}

/** 动态与评论共用的传送门构造器；写回规范化后的相对站内链接。 */
export function InternalReferenceInsert({
  onInsert,
  getSuggestedLabel,
  disabled,
  className,
}: InternalReferenceInsertProps) {
  const [open, setOpen] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { label: "", href: "" },
  });

  const changeOpen = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      reset({ label: getSuggestedLabel?.().trim().slice(0, 40) ?? "", href: "" });
    }
  };

  const submit = ({ label, href }: FormValues) => {
    const markdown = serializeInternalReference(label, href);
    if (!markdown) return;
    onInsert(markdown);
    setOpen(false);
    reset();
  };

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={disabled}
        className={className}
        onClick={() => changeOpen(true)}
        aria-haspopup="dialog"
      >
        <DoorOpen className="size-4" />
        传送门
      </Button>
      <DialogPortal>
        <DialogBackdrop />
        <DialogViewport>
          <DialogPopup className="max-w-md p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <DialogTitle>插入站内传送门</DialogTitle>
                <DialogDescription className="mt-1">
                  为主题帖、子贴、楼层、回复或私密邀请设置一个简短名称。
                </DialogDescription>
              </div>
              <DialogCloseButton />
            </div>
            <form
              className="mt-5 space-y-4"
              onSubmit={(event) => {
                event.stopPropagation();
                void handleSubmit(submit)(event);
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="internal-reference-label">显示名称</Label>
                <Input
                  id="internal-reference-label"
                  placeholder="例如：角色设定、第三章线索"
                  maxLength={40}
                  aria-invalid={!!errors.label}
                  autoFocus
                  {...register("label")}
                />
                {errors.label?.message ? (
                  <p className="text-xs text-destructive">{errors.label.message}</p>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="internal-reference-href">站内链接</Label>
                <Input
                  id="internal-reference-href"
                  type="text"
                  inputMode="url"
                  placeholder="https://wenyou.site/threads/…"
                  aria-invalid={!!errors.href}
                  {...register("href")}
                />
                {errors.href?.message ? (
                  <p className="text-xs text-destructive">{errors.href.message}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">粘贴帖子或私密邀请链接。</p>
                )}
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                  取消
                </Button>
                <Button type="submit">插入</Button>
              </DialogFooter>
            </form>
          </DialogPopup>
        </DialogViewport>
      </DialogPortal>
    </Dialog>
  );
}

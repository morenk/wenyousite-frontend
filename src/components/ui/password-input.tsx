/** 密码输入框：显示/隐藏切换。 */

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WenyouIcon } from "@/components/ui/wenyou-icon";
import { cn } from "@/lib/utils";

export function PasswordInput({ className, disabled, ...props }: React.ComponentProps<"input">) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        {...props}
        type={show ? "text" : "password"}
        disabled={disabled}
        className={cn("pr-11", className)}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon-compact"
        onClick={() => setShow((v) => !v)}
        disabled={disabled}
        aria-pressed={show}
        aria-label={show ? "隐藏密码" : "显示密码"}
        className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded-lg text-muted-foreground hover:text-foreground"
      >
        <WenyouIcon id={show ? "action.hide" : "action.show"} className="size-4" />
      </Button>
    </div>
  );
}

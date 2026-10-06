"use client";

import { Menu } from "@base-ui/react/menu";
import { Check, ChevronDown, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThreadIdentitySummary, type ThreadIdentityAppearance } from "./thread-identity-summary";

/** 展示层选择键，不是 API 写入 DTO；空 ID 表示旧草稿暂不可用的 RP。 */
export type PublicationIdentityChoiceValue = { mode: "ACCOUNT" } | { mode: "RP"; id: string | null };
export interface PublicationIdentityChoiceOption { id: string; appearance: ThreadIdentityAppearance; selectable?: boolean; editable?: boolean }

const itemClassName = "flex min-h-11 min-w-0 flex-1 cursor-default items-center gap-3 rounded-[var(--radius-control)] px-3 py-2 text-sm outline-none data-highlighted:bg-accent data-disabled:text-muted-foreground";

/** 同一入口选择本次身份；行内编辑动作不改变选择，也不持有提交状态。 */
export function ThreadPublicationIdentityChoice({
  account, identities, value, disabled, activeCount = identities.length, limit = 10, onChange, onEdit, onCreate,
}: {
  account: ThreadIdentityAppearance;
  identities: readonly PublicationIdentityChoiceOption[];
  value: PublicationIdentityChoiceValue;
  disabled?: boolean;
  activeCount?: number;
  limit?: number;
  onChange: (value: PublicationIdentityChoiceValue) => void;
  onEdit?: (id: string) => void;
  onCreate?: () => void;
}) {
  const selectedRoleplay = value.mode === "RP" ? identities.find((identity) => identity.id === value.id && identity.selectable !== false) : undefined;
  const selected = selectedRoleplay?.appearance ?? account;
  const hasMenu = identities.length > 0 || value.mode === "RP" || Boolean(onCreate);
  const canCreate = Boolean(onCreate && activeCount < limit);
  const options = [
    { key: "ACCOUNT", appearance: account, label: "站内身份" },
    ...identities.map((identity) => ({ key: "RP:" + identity.id, id: identity.id, appearance: identity.appearance, selectable: identity.selectable !== false, editable: identity.editable !== false, label: "帖内身份" })),
  ];
  return <div className="min-w-0">
    {hasMenu ? <Menu.Root>
      <Menu.Trigger disabled={disabled} render={<Button type="button" variant="ghost" aria-label="发表身份"
        className="h-auto min-h-11 min-w-0 max-w-full justify-start gap-3 px-2 py-1 text-left font-normal" />}>
        <ThreadIdentitySummary appearance={selected}
          label={selectedRoleplay ? "帖内身份" : value.mode === "ACCOUNT" && identities.length > 0 ? "站内身份" : undefined}
          compact truncate />
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="bottom" align="start" sideOffset={4} className="z-[var(--layer-popup)]">
          <Menu.Popup aria-label="本次发表身份" className="w-[min(24rem,calc(100vw-2rem))] max-h-(--available-height) overflow-y-auto rounded-[var(--radius-panel)] border border-border bg-popover p-1 text-popover-foreground shadow-popover outline-none">
            <Menu.RadioGroup value={value.mode === "RP" ? "RP:" + value.id : "ACCOUNT"} onValueChange={(key) => {
              if (key === "ACCOUNT") onChange({ mode: "ACCOUNT" });
              else {
                const identity = identities.find((item) => "RP:" + item.id === key);
                if (identity && identity.selectable !== false) onChange({ mode: "RP", id: identity.id });
              }
            }}>
              {options.map((item) => <div key={item.key} className={"id" in item ? "flex min-w-0 items-center" : "sticky top-0 z-10 flex min-w-0 items-center bg-popover"}>
                {"selectable" in item && !item.selectable ? <Menu.Item disabled={disabled || !item.editable || !onEdit}
                  onClick={() => onEdit?.(item.id)} className={itemClassName} aria-label={"配置" + item.appearance.name}>
                  <ThreadIdentitySummary appearance={item.appearance} compact />
                </Menu.Item> : <Menu.RadioItem closeOnClick value={item.key} label={item.label + "：" + item.appearance.name}
                  aria-label={item.label + "：" + item.appearance.name} disabled={disabled} className={itemClassName}>
                  <ThreadIdentitySummary appearance={item.appearance} label={"id" in item ? undefined : "站内身份"} compact />
                  <Menu.RadioItemIndicator className="shrink-0"><Check className="size-4" aria-hidden="true" /></Menu.RadioItemIndicator>
                </Menu.RadioItem>}
                {"id" in item && item.editable && onEdit ? <Menu.Item nativeButton onClick={() => onEdit(item.id)} disabled={disabled}
                  aria-label={"编辑" + item.appearance.name + "的帖内资料"} title="编辑帖内资料" render={<Button type="button" variant="ghost" size="icon" />}
                  className="size-11 shrink-0 rounded-[var(--radius-control)] text-muted-foreground data-highlighted:bg-accent">
                  <Pencil className="size-4" aria-hidden="true" />
                </Menu.Item> : null}
              </div>)}
            </Menu.RadioGroup>
            {canCreate ? <Menu.Item onClick={onCreate} disabled={disabled} className={itemClassName}>
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-dashed border-border text-muted-foreground"><Plus className="size-4" aria-hidden="true" /></span>
              {identities.length ? "新增帖内身份" : "设置帖内身份"}
            </Menu.Item> : null}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root> : <ThreadIdentitySummary appearance={account} compact truncate />}
  </div>;
}

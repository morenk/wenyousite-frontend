"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { StackList } from "@/components/ui/stack-list";
import { WenyouIcon } from "@/components/ui/wenyou-icon";
import { cn } from "@/lib/utils";
import { TOOLS, toolHref, type ToolId } from "@/lib/tools/catalog";
import { VerticalToolPanel } from "./vertical-tool-panel";
import { TextToolPanel } from "./text-tool-panel";
import { NameToolPanel } from "./name-tool-panel";

export function Toolbox({ selected, embedded = false }: { selected?: ToolId; embedded?: boolean }) {
  const NavigationLink = embedded ? "a" : Link;
  const theme = useSearchParams().get("theme");
  const tool = TOOLS.find((item) => item.id === selected);
  return <div data-toolbox-surface className="min-h-screen bg-muted/40">
    <PageShell width="content" className="py-8">
      {tool && <NavigationLink href={toolHref(undefined, embedded, theme)} className="mb-3 inline-flex min-h-8 items-center gap-2 rounded-[var(--radius-control)] px-1 text-sm font-semibold text-muted-foreground transition-colors hover:text-brand-strong"><WenyouIcon id="navigation.back" className="size-4" />全部工具</NavigationLink>}
      <PageHeader purpose="functional" title={tool?.title ?? "工具箱"} />
      {tool ? (
        tool.id === "names" ? <NameToolPanel /> : tool.id === "vertical" ? <VerticalToolPanel embedded={embedded} /> : <TextToolPanel key={tool.id} tool={tool.id} />
      ) : <StackList className="grid divide-y-0 border-0 sm:grid-cols-2">
        {TOOLS.map((item, index) => <NavigationLink key={item.id} href={toolHref(item.id, embedded, theme)} data-toolbox-row className={cn(
          "relative flex min-h-15 items-center gap-3 px-5 py-3 transition-colors after:absolute after:inset-x-5 after:bottom-0 after:border-b after:border-border last:after:hidden hover:bg-muted/50",
          index >= Math.floor((TOOLS.length - 1) / 2) * 2 && "sm:after:hidden",
        )}>
          <WenyouIcon id={item.icon} className="size-5 shrink-0 text-brand-strong" />
          <h2 className="text-sm font-medium">{item.title}</h2>
          <WenyouIcon id="navigation.forward" className="ml-auto size-4 shrink-0 text-muted-foreground" />
        </NavigationLink>)}
      </StackList>}
    </PageShell>
  </div>;
}

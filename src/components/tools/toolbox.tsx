"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PageShell } from "@/components/layout/page-shell";
import { WenyouIcon } from "@/components/ui/wenyou-icon";
import { TOOLS, toolHref, type ToolId } from "@/lib/tools/catalog";
import { VerticalToolPanel } from "./vertical-tool-panel";
import { TextToolPanel } from "./text-tool-panel";
import { NameToolPanel } from "./name-tool-panel";

export function Toolbox({ selected, embedded = false }: { selected?: ToolId; embedded?: boolean }) {
  const NavigationLink = embedded ? "a" : Link;
  const theme = useSearchParams().get("theme");
  const tool = TOOLS.find((item) => item.id === selected);
  return <PageShell width="workspace" className="py-6 sm:py-8">
    <header className="mb-6 grid gap-3">
      {tool && <NavigationLink href={toolHref(undefined, embedded, theme)} className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><WenyouIcon id="navigation.back" className="size-4" />全部工具</NavigationLink>}
      <h1 className="font-display text-2xl font-semibold sm:text-3xl">{tool?.title ?? "工具箱"}</h1>
    </header>
    {tool ? <div className="rounded-[var(--radius-panel)] border border-border bg-card p-4 sm:p-6">
      {tool.id === "names" ? <NameToolPanel /> : tool.id === "vertical" ? <VerticalToolPanel embedded={embedded} /> : <TextToolPanel key={tool.id} tool={tool.id} />}
    </div> : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {TOOLS.map((item) => <NavigationLink key={item.id} href={toolHref(item.id, embedded, theme)} className="flex min-h-15 items-center gap-3 rounded-[var(--radius-panel)] border border-border bg-card px-4 py-3 transition-colors hover:border-brand-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <WenyouIcon id={item.icon} className="size-5 shrink-0 text-brand-strong" />
        <h2 className="text-sm font-semibold">{item.title}</h2>
        <WenyouIcon id="navigation.forward" className="ml-auto size-4 shrink-0 text-muted-foreground" />
      </NavigationLink>)}
    </div>}
  </PageShell>;
}

"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PageShell } from "@/components/layout/page-shell";
import { WenyouIcon } from "@/components/ui/wenyou-icon";
import { TOOLS, toolHref, type ToolId } from "@/lib/tools/catalog";
import { TextToolPanel } from "./text-tool-panel";
import { NameToolPanel } from "./name-tool-panel";

export function Toolbox({ selected, embedded = false }: { selected?: ToolId; embedded?: boolean }) {
  const NavigationLink = embedded ? "a" : Link;
  const theme = useSearchParams().get("theme");
  const tool = TOOLS.find((item) => item.id === selected);
  const compactList = !tool && !embedded;
  return <PageShell width="workspace" className="py-6 sm:py-8">
    <header className="mb-6 grid gap-3">
      {compactList ? <h1 className="font-display text-2xl font-semibold sm:text-3xl">工具箱</h1> : <>
      {tool && <NavigationLink href={toolHref(undefined, embedded, theme)} className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><WenyouIcon id="navigation.back" className="size-4" />全部工具</NavigationLink>}
      <p className="text-xs font-semibold tracking-widest text-brand-strong">温油工具箱 · 文字与灵感</p>
      <h1 className="font-display text-2xl font-semibold sm:text-3xl">{tool?.title ?? "让文字多一点可能"}</h1>
      <p className="text-sm leading-relaxed text-muted-foreground">{tool?.description ?? "排一段文字，换一种笔触，或为新的故事找到一个名字。"}</p>
      </>}
    </header>
    {tool ? <div className="rounded-[var(--radius-panel)] border border-border bg-card p-4 sm:p-6">
      {tool.id === "names" ? <NameToolPanel /> : <TextToolPanel key={tool.id} tool={tool.id} />}
    </div> : compactList ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {TOOLS.map((item) => <Link key={item.id} href={toolHref(item.id, false, theme)} className="flex min-h-15 items-center gap-3 rounded-[var(--radius-panel)] border border-border bg-card px-4 py-3 transition-colors hover:border-brand-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <WenyouIcon id={item.icon} className="size-5 shrink-0 text-brand-strong" />
        <h2 className="text-sm font-semibold">{item.title}</h2>
        <WenyouIcon id="navigation.forward" className="ml-auto size-4 shrink-0 text-muted-foreground" />
      </Link>)}
    </div> : <div className="grid gap-4 sm:grid-cols-2">
      {TOOLS.map((item) => <NavigationLink key={item.id} href={toolHref(item.id, embedded, theme)} className="group grid gap-4 rounded-[var(--radius-panel)] border border-border bg-card p-5 transition-colors hover:border-brand-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <div className="flex items-center justify-between"><WenyouIcon id={item.icon} className="size-5 text-brand-strong" /><WenyouIcon id="navigation.forward" className="size-4 text-muted-foreground" /></div>
        <div className="flex min-h-16 items-center whitespace-pre text-xl leading-relaxed text-brand-strong" aria-hidden="true">{item.sample}</div>
        <div><h2 className="text-lg font-semibold">{item.title}</h2><p className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.description}</p></div>
      </NavigationLink>)}
    </div>}
    {!compactList && <footer className="mt-6 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground"><WenyouIcon id="status.shield" className="mt-0.5 size-4 shrink-0" /><p>无需登录，文字在当前设备处理。刷新或离开页面后不保存输入与结果。</p></footer>}
  </PageShell>;
}

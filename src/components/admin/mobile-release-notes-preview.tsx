import { useId } from "react";

export type MobileReleasePreviewIdentity = {
  platform: string;
  version: string;
  build: number | string;
};

export function MobileReleaseNotesPreview({
  title = "草稿预览",
  identity,
  summary,
  items,
}: {
  title?: string;
  identity: MobileReleasePreviewIdentity;
  summary: string;
  items: readonly string[];
}) {
  const titleId = useId();

  return (
    <section aria-labelledby={titleId} className="min-w-0 space-y-3 rounded-[var(--radius-card)] border border-border bg-muted/40 p-4">
      <h3 id={titleId} className="text-sm font-semibold">{title}</h3>
      <div className="space-y-1 break-words">
        <p className="font-utility text-base font-semibold">{identity.version || "版本名待填写"}</p>
        <p className="text-xs text-muted-foreground">{identity.platform} · 构建 {identity.build || "待填写"}</p>
      </div>
      {summary.trim() ? (
        <p className="whitespace-pre-wrap break-words text-sm leading-6">{summary}</p>
      ) : (
        <p className="text-sm text-muted-foreground">尚未填写摘要</p>
      )}
      {items.length ? (
        <ul className="list-disc space-y-2 pl-5 text-sm leading-6">
          {items.map((item, index) => (
            <li key={index} className="whitespace-pre-wrap break-words">{item}</li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">尚未填写更新内容</p>
      )}
    </section>
  );
}

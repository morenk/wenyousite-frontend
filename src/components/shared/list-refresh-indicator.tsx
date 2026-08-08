export function ListRefreshIndicator() {
  return (
    <div
      data-slot="list-refresh-indicator"
      role="status"
      aria-label="正在更新列表"
      className="absolute inset-x-4 top-0 z-10 h-0.5 overflow-hidden rounded-full bg-primary"
    >
      <span className="block h-full w-2/5 animate-pulse rounded-full bg-brand-strong" />
    </div>
  );
}

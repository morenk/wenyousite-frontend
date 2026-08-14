/** 路由或首屏数据较慢时显示；CSS 延迟避免快速导航闪烁。 */
export function NavigationProgress() {
  return (
    <div
      data-slot="navigation-progress"
      aria-hidden="true"
      className="navigation-progress fixed inset-x-0 top-0 z-[var(--layer-global-progress)] h-0.5 overflow-hidden bg-primary"
    />
  );
}

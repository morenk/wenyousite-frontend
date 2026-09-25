interface DiscussionTargetRevealOptions {
  onStable?: () => void;
  stableMs?: number;
  holdUntilStable?: boolean;
}

/** 在用户接管前保持讨论目标开头可见；仅用于页面文档滚动。 */
export function startDiscussionTargetReveal(
  targetId: string,
  { onStable, stableMs = 180, holdUntilStable = false }: DiscussionTargetRevealOptions = {},
) {
  let released = false;
  let frame: number | undefined;
  let stableTimer: number | undefined;
  let stableReported = false;
  let userCanRelease = !holdUntilStable;
  let forced = false;
  const observed = new Set<Element>();

  const schedule = (force = false) => {
    if (released) return;
    if (stableTimer !== undefined) window.clearTimeout(stableTimer);
    forced ||= force;
    if (frame !== undefined) return;
    frame = window.requestAnimationFrame(reveal);
  };
  const resize = typeof ResizeObserver === "undefined"
    ? undefined : new ResizeObserver(() => schedule());
  const watch = (element: Element) => {
    if (!observed.has(element)) {
      observed.add(element);
      resize?.observe(element);
    }
  };

  function reveal() {
    frame = undefined;
    if (released) return;
    const target = document.getElementById(targetId);
    if (!target) return;
    // 前方图片或同高度的内容替换也可能移动目标，不能只观察目标自身高度。
    for (let node: Element | null = target; node; node = node.parentElement) {
      watch(node);
      for (let sibling = node.previousElementSibling; sibling; sibling = sibling.previousElementSibling) {
        watch(sibling);
      }
    }
    for (const node of observed) {
      if (!node.isConnected) {
        resize?.unobserve(node);
        observed.delete(node);
      }
    }
    const margin = Number.parseFloat(getComputedStyle(target).scrollMarginTop) || 0;
    let readingTop = margin;
    // 读取最终布局高度，避免阅读栏的入场 transform 造成逐帧追逐。
    const bar = document.querySelector<HTMLElement>('[data-slot="thread-reading-bar"]');
    const anchor = bar?.closest<HTMLElement>('[data-slot="thread-reading-bar-anchor"]');
    if (bar && anchor) {
      watch(bar);
      readingTop = Math.max(readingTop, (Number.parseFloat(getComputedStyle(anchor).top) || 0) + bar.offsetHeight + margin);
    }
    const dock = target.parentElement?.querySelector<HTMLElement>(':scope > [data-slot="moment-replies-collapse-dock"]');
    if (dock) {
      watch(dock);
      readingTop = Math.max(readingTop, (Number.parseFloat(getComputedStyle(dock).top) || 0) + dock.offsetHeight + margin);
    }
    const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    const destination = Math.max(0, Math.min(maxScroll, window.scrollY + target.getBoundingClientRect().top - readingTop));
    if (forced || Math.abs(window.scrollY - destination) > 0.5) {
      forced = false;
      target.scrollIntoView({ behavior: "auto", block: "start" });
      // 明确限制在自然底部；吸顶栏出现后会通过观察器再校准一次。
      window.scrollTo({ top: destination, behavior: "instant" });
    }
    if (!stableReported && onStable) {
      stableTimer = window.setTimeout(() => {
        stableTimer = undefined;
        if (released || stableReported || !document.getElementById(targetId)) return;
        stableReported = true;
        userCanRelease = true;
        onStable();
      }, stableMs);
    }
  }

  const release = () => {
    released = true;
    if (frame !== undefined) window.cancelAnimationFrame(frame);
    if (stableTimer !== undefined) window.clearTimeout(stableTimer);
    resize?.disconnect();
    observed.clear();
    mutation?.disconnect();
  };
  const releaseOnUserInput = () => {
    if (userCanRelease) release();
  };
  const mutation = typeof MutationObserver === "undefined"
    ? undefined : new MutationObserver(() => schedule());
  mutation?.observe(document.body, { childList: true, subtree: true });
  watch(document.body);
  window.addEventListener("wheel", releaseOnUserInput, { passive: true });
  window.addEventListener("pointerdown", releaseOnUserInput, { passive: true });
  window.addEventListener("touchstart", releaseOnUserInput, { passive: true });
  window.addEventListener("keydown", releaseOnUserInput);
  window.addEventListener("resize", scheduleResize);
  function scheduleResize() { schedule(); }
  schedule(true);

  return {
    schedule: () => schedule(true),
    dispose: () => {
      release();
      window.removeEventListener("wheel", releaseOnUserInput);
      window.removeEventListener("pointerdown", releaseOnUserInput);
      window.removeEventListener("touchstart", releaseOnUserInput);
      window.removeEventListener("keydown", releaseOnUserInput);
      window.removeEventListener("resize", scheduleResize);
    },
  };
}

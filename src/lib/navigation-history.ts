/** 统一记录本次文档的真实历史位置，不插入哨兵页。
 * 不使用 Navigation API 取消遍历：Chromium 取消前进后，重复前进可能不再派发事件。
 */
type Position = { session: string; index: number };
type Entry = { position: Position; url: string; state: unknown };
type Blocker = { isBlocked: () => boolean; request: (replay: () => void) => void };
const KEY = "__wenyouHistory";
let installed: { addBlocker: (blocker: Blocker) => () => void } | undefined;

export function trackNavigationHistory() {
  if (installed) return installed;
  const session = crypto.randomUUID();
  let current: Entry = { position: { session, index: 0 }, url: location.href, state: history.state };
  const blockers = new Set<Blocker>();
  let restoring: (() => void) | null = null;
  let replayIndex: number | null = null;
  const push = history.pushState.bind(history);
  const replace = history.replaceState.bind(history);
  const stateAt = (state: unknown, position: Position) => ({ ...(state && typeof state === "object" ? state : {}), [KEY]: position });
  replace(stateAt(history.state, current.position), "");
  history.pushState = (state, title, url) => {
    const position = { session, index: current.position.index + 1 };
    push(stateAt(state, position), title, url);
    current = { position, url: location.href, state: history.state };
  };
  history.replaceState = (state, title, url) => {
    replace(stateAt(state, current.position), title, url);
    current = { ...current, url: location.href, state: history.state };
  };
  window.addEventListener("popstate", (event) => {
    const position = event.state?.[KEY] as Position | undefined;
    // 原生 # 锚点产生真实历史项（没有 state），记录位置而不新增历史项。
    const previous = new URL(current.url);
    const destinationUrl = new URL(location.href);
    if (!position && previous.pathname === destinationUrl.pathname && previous.search === destinationUrl.search && previous.hash !== destinationUrl.hash) {
      const next = { session, index: current.position.index + 1 };
      replace(stateAt(current.state, next), "");
      current = { position: next, url: location.href, state: history.state };
      return;
    }
    // 别的文档由 beforeunload 保护；不猜测未知历史项的方向或距离。
    if (!position || position.session !== session) return;
    if (restoring) {
      event.stopImmediatePropagation();
      if (position.index === current.position.index) {
        const done = restoring;
        restoring = null;
        done();
      } else history.go(current.position.index - position.index);
      return;
    }
    const destination = { position, url: location.href, state: history.state };
    const previousUrl = new URL(current.url);
    const nextUrl = new URL(destination.url);
    const hashOnly = previousUrl.pathname === nextUrl.pathname && previousUrl.search === nextUrl.search;
    const delta = position.index - current.position.index;
    const blocker = [...blockers].reverse().find((candidate) => candidate.isBlocked());
    const isReplay = replayIndex === position.index;
    replayIndex = null;
    if (!blocker || isReplay || hashOnly || delta === 0) {
      current = destination;
      return;
    }
    event.stopImmediatePropagation();
    const request = blocker;
    restoring = () => {
      if (!blockers.has(request)) return;
      request.request(() => {
        replayIndex = position.index;
        history.go(position.index - current.position.index);
      });
    };
    history.go(-delta);
  }, true);
  installed = { addBlocker: (next) => { blockers.add(next); return () => { blockers.delete(next); }; } };
  return installed;
}

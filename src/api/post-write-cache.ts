import type { Query, QueryClient } from "@tanstack/react-query";
import type { components } from "@/api/types";
import { getAuthSnapshot, subscribeAuthStore } from "@/lib/auth-store";
import { queryKeys } from "@/api/query-keys";

type SavedPost = components["schemas"]["PostResponseDto"];

/** 保存期间换号（包括退出再登录同账号）后，旧响应不能回填新阅读会话。 */
export function watchPostWriteSession() {
  const viewer = getAuthSnapshot().user?.id ?? "anonymous";
  let current = true;
  const dispose = subscribeAuthStore(() => {
    if ((getAuthSnapshot().user?.id ?? "anonymous") !== viewer) current = false;
  });
  return { viewer, isCurrent: () => current, dispose };
}

export type PostWriteSession = ReturnType<typeof watchPostWriteSession>;

function belongsToViewer(query: Query, viewer: string) {
  const key = query.queryKey;
  if (key[2] === "window" || key[2] === "authors") return key[key[2] === "window" ? 4 : 3] === viewer;
  if (key[2] === "rp-profile") return key[5] === viewer;
  const position = key.indexOf("viewer");
  return position === -1 || key[position + 1] === viewer;
}

/** 只遍历讨论数据结构；不改变分页、排序、计数、回复目标或当前权限上下文。 */
function replacePost(value: unknown, saved: SavedPost): unknown {
  if (Array.isArray(value)) {
    const next = value.map((item) => replacePost(item, saved));
    return next.some((item, i) => item !== value[i]) ? next : value;
  }
  if (!value || typeof value !== "object") return value;
  const record = value as Record<string, unknown>;
  let next = record;
  if (saved.kind === "BODY" && record.id === saved.subthreadId && "bodyPost" in record) {
    const body = record.bodyPost as { version?: number } | null;
    if (!body || (body.version ?? 0) <= saved.version) next = { ...record, bodyPost: saved };
  }
  if (record.id === saved.id && typeof record.content === "string" && typeof record.version === "number"
    && record.version <= saved.version) {
    next = { ...record, ...saved,
      // 可选映射属于这份正文；缺省不能留下旧正文的媒体或提及。
      mediaDisplays: saved.mediaDisplays, mediaAudios: saved.mediaAudios,
      mentionIdentities: saved.mentionIdentities,
    };
  }
  for (const key of ["pages", "data", "replies", "window", "pinnedItems", "subthreads", "defaultSubthread"]) {
    if (!(key in record)) continue;
    const child = replacePost(record[key], saved);
    if (child !== record[key]) next = { ...next, [key]: child };
  }
  return next;
}

export async function applySavedPost(client: QueryClient, saved: SavedPost, session: PostWriteSession) {
  if (!session.isCurrent()) return;
  const predicate = (query: Query) => belongsToViewer(query, session.viewer) && (
    (query.queryKey[0] === queryKeys.posts.all[0] && query.queryKey[1] === saved.id)
    || (saved.kind === "BODY" && query.queryKey[0] === queryKeys.threads.details[0] && query.queryKey[1] === saved.threadId)
    || (query.queryKey[0] === queryKeys.floors.all[0] && query.queryKey[1] === saved.subthreadId)
    || (query.queryKey[0] === queryKeys.replies.all[0] && query.queryKey[1] === saved.parentPostId)
  );
  // TanStack 取消进行中的旧读取，即使 transport 未使用 signal 也不再提交其结果。
  await client.cancelQueries({ predicate });
  if (!session.isCurrent()) return;
  client.setQueriesData({ predicate }, (old) => replacePost(old, saved));
  // 编辑不改变窗口成员与统计；下次阅读再复核，不串行等待全站列表刷新。
  void client.invalidateQueries({ predicate, refetchType: "none" });
}

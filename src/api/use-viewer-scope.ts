import { useSyncExternalStore } from "react";
import {
  getAuthSnapshot,
  getServerAuthSnapshot,
  subscribeAuthStore,
} from "@/lib/auth-store";

/** OptionalAuth 查询使用的当前访问者缓存维度；认证恢复后会触发 query key 切换。 */
export function useViewerScope(): string {
  const snapshot = useSyncExternalStore(
    subscribeAuthStore,
    getAuthSnapshot,
    getServerAuthSnapshot,
  );
  return snapshot.user?.id ?? "anonymous";
}

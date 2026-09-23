/** 拉黑与关注共用同一查看者/目标的写入锁及结果核实。 */
import { useFollowActions } from "./use-follow-actions";

export function useBlockActions(userId: string) {
  const { block, unblock, reconcile, isPending, needsReconciliation } = useFollowActions(userId);
  return { block, unblock, reconcile, isPending, needsReconciliation };
}

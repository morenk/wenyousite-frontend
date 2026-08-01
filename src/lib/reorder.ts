/** 子贴排序工具：计算拖拽后的新顺序，主帖（默认子贴）必须保持在第一位 */

/**
 * 计算拖拽后的子贴 ID 顺序。
 * 主帖（defaultId）必须始终位于第一位：拖拽主帖或把其他子贴放到主帖位置都返回 null。
 * @param ids 当前顺序
 * @param activeId 被拖拽的子贴 ID
 * @param overId 落点子贴 ID
 * @param defaultId 主帖（默认子贴）ID
 * @returns 新顺序数组；若会导致主帖离开首位则返回 null
 */
export function computeReorderedIds(
  ids: string[],
  activeId: string,
  overId: string,
  defaultId: string,
): string[] | null {
  if (activeId === overId) return null;

  const oldIndex = ids.indexOf(activeId);
  const newIndex = ids.indexOf(overId);
  if (oldIndex === -1 || newIndex === -1) return null;

  // 主帖不可移动
  if (activeId === defaultId) return null;

  // 重排后主帖必须仍在第一位
  const reordered = [...ids];
  reordered.splice(oldIndex, 1);
  reordered.splice(newIndex, 0, activeId);
  if (reordered[0] !== defaultId) return null;

  return reordered;
}

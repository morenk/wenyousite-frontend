/** 子贴发帖权限的中文标签与选项（单一来源） */

export const POSTING_POLICY_LABEL: Record<string, string> = {
  PARTICIPANTS: "所有人",
  COLLABORATORS: "协作者",
  PLAYERS: "玩家",
};

export const POSTING_POLICY_OPTIONS = [
  { value: "PARTICIPANTS", label: "所有参与人" },
  { value: "COLLABORATORS", label: "仅协作者" },
  { value: "PLAYERS", label: "仅玩家" },
] as const;

/** 子贴发帖权限的中文标签与选项（单一来源） */

export const POSTING_POLICY_LABEL: Record<string, string> = {
  PARTICIPANTS: "所有人",
  COLLABORATORS: "协作者",
  PLAYERS: "玩家",
};

export const POSTING_POLICY_OPTIONS = [
  { value: "PARTICIPANTS", label: "所有人" },
  { value: "COLLABORATORS", label: "协作者" },
  { value: "PLAYERS", label: "玩家" },
] as const;

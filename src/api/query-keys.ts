/** TanStack Query key 工厂：业务代码不得自行拼接缓存键。 */

export const queryKeys = {
  threads: {
    all: ["threads"] as const,
    list: (params: object) => ["threads", params] as const,
    detail: (threadId: string) => ["thread", threadId] as const,
  },
  floors: {
    all: ["floors"] as const,
    list: (subthreadId: string) => ["floors", subthreadId] as const,
  },
  replies: {
    all: ["replies"] as const,
    list: (postId: string | undefined) => ["replies", postId] as const,
  },
  posts: {
    detail: (postId: string | undefined) => ["post", postId] as const,
  },
  members: {
    all: ["members"] as const,
    list: (threadId: string | undefined) => ["members", threadId] as const,
  },
  users: {
    all: ["user"] as const,
    detail: (userId: string | undefined) => ["user", userId] as const,
    bookmarks: (userId?: string) =>
      userId === undefined
        ? (["user", "bookmarks"] as const)
        : (["user", "bookmarks", userId] as const),
    createdThreads: (userId: string | undefined) =>
      ["user", "created-threads", userId] as const,
    playedThreads: (userId?: string, visibility: string = "ALL") =>
      userId === undefined
        ? (["user", "played-threads"] as const)
        : (["user", "played-threads", userId, visibility] as const),
    recentReplies: (userId: string | undefined) =>
      ["user", "recent-replies", userId] as const,
    followLists: (kind?: "following" | "followers", userId?: string) =>
      kind === undefined
        ? (["user"] as const)
        : userId === undefined
          ? (["user", kind] as const)
          : (["user", kind, userId] as const),
  },
  me: ["me"] as const,
  bookmarks: {
    all: ["bookmarks"] as const,
  },
  notifications: {
    all: ["notifications"] as const,
    list: (type: string | undefined, userId: string | undefined) =>
      ["notifications", type, userId] as const,
    unread: (userId: string | undefined) =>
      ["notifications", "unread", userId] as const,
  },
  subscriptions: ["subscriptions"] as const,
  topicTags: (query: string) => ["tags", query] as const,
  contentDrafts: ["content-drafts"] as const,
  draftSlots: ["draft-slots"] as const,
  threadDrafts: ["drafts"] as const,
  sessions: (userId?: string) => ["auth-sessions", userId] as const,
  blockedUsers: (userId?: string) => ["blocked-users", userId] as const,
  invitePreview: (token: string | undefined) =>
    ["invite-preview", token] as const,
  mentionCandidates: (threadId: string, query: string) =>
    ["mention-candidates", threadId, query] as const,
  search: {
    threads: (keyword: string) => ["search", "threads", keyword] as const,
    users: (keyword: string) => ["search", "users", keyword] as const,
  },
};

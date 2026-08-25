/** TanStack Query key 工厂：业务代码不得自行拼接缓存键。 */

export const queryKeys = {
  threads: {
    all: ["threads"] as const,
    details: ["thread"] as const,
    list: (params: object) => ["threads", params] as const,
    detail: (threadId: string) => ["thread", threadId] as const,
    detailForViewer: (threadId: string, viewerScope: string) =>
      ["thread", threadId, "viewer", viewerScope] as const,
  },
  moments: {
    all: ["moments"] as const,
    detailRoot: (momentId: string) => ["moments", "detail", momentId] as const,
    list: (feed: "DISCOVER" | "FOLLOWING", viewerScope: string) =>
      ["moments", "list", feed, viewerScope] as const,
    detail: (momentId: string | undefined, viewerScope: string) =>
      ["moments", "detail", momentId, viewerScope] as const,
    comments: (momentId: string | undefined, viewerScope: string, filters?: object) =>
      filters === undefined
        ? (["moments", "comments", momentId, viewerScope] as const)
        : (["moments", "comments", momentId, viewerScope, filters] as const),
    replies: (momentId: string, commentId: string, viewerScope: string, filters?: object) =>
      filters === undefined
        ? (["moments", "comments", momentId, commentId, "replies", viewerScope] as const)
        : (["moments", "comments", momentId, commentId, "replies", viewerScope, filters] as const),
    commentContexts: (momentId: string, viewerScope: string) =>
      ["moments", "comment-context", momentId, viewerScope] as const,
    commentContext: (momentId: string, commentId: string | undefined, viewerScope: string) =>
      ["moments", "comment-context", momentId, viewerScope, commentId] as const,
    commentAuthors: (momentId: string | undefined, viewerScope: string) =>
      ["moments", "comment-authors", momentId, viewerScope] as const,
    user: (userId: string | undefined, viewerScope: string, pageSize = 20) =>
      ["moments", "user", userId, viewerScope, pageSize] as const,
    bookmarksRoot: ["moments", "bookmarks"] as const,
    bookmarks: (viewerScope: string, folderId?: string) =>
      ["moments", "bookmarks", viewerScope, folderId ?? "all"] as const,
  },
  floors: {
    all: ["floors"] as const,
    list: (subthreadId: string, filters?: object) =>
      filters === undefined
        ? (["floors", subthreadId] as const)
        : (["floors", subthreadId, filters] as const),
    authors: (subthreadId: string | undefined, viewerScope: string) =>
      ["floors", subthreadId, "authors", viewerScope] as const,
  },
  replies: {
    all: ["replies"] as const,
    list: (postId: string | undefined, filters?: object) =>
      filters === undefined
        ? (["replies", postId] as const)
        : (["replies", postId, filters] as const),
    authors: (postId: string | undefined, viewerScope: string) =>
      ["replies", postId, "authors", viewerScope] as const,
  },
  posts: {
    all: ["post"] as const,
    detail: (postId: string | undefined) => ["post", postId] as const,
    detailForViewer: (postId: string | undefined, viewerScope: string) =>
      ["post", postId, "viewer", viewerScope] as const,
  },
  members: {
    all: ["members"] as const,
    list: (threadId: string | undefined) => ["members", threadId] as const,
  },
  users: {
    all: ["user"] as const,
    detail: (userId: string | undefined) => ["user", userId] as const,
    detailForViewer: (userId: string | undefined, viewerScope: string) =>
      ["user", userId, "viewer", viewerScope] as const,
    bookmarks: (userId?: string) =>
      userId === undefined
        ? (["user", "bookmarks"] as const)
        : (["user", "bookmarks", userId] as const),
    createdThreads: (userId: string | undefined) =>
      ["user", "created-threads", userId] as const,
    createdThreadsForViewer: (userId: string | undefined, viewerScope: string) =>
      ["user", "created-threads", userId, "viewer", viewerScope] as const,
    playedThreads: (userId?: string, visibility: string = "ALL") =>
      userId === undefined
        ? (["user", "played-threads"] as const)
          : (["user", "played-threads", userId, visibility] as const),
    playedThreadsForViewer: (
      userId: string | undefined,
      visibility: string,
      viewerScope: string,
    ) => ["user", "played-threads", userId, visibility, "viewer", viewerScope] as const,
    recentReplies: (userId: string | undefined) =>
      ["user", "recent-replies", userId] as const,
    recentRepliesForViewer: (userId: string | undefined, viewerScope: string) =>
      ["user", "recent-replies", userId, "viewer", viewerScope] as const,
    activitySummary: (userId: string | undefined) =>
      ["user", "activity-summary", userId] as const,
    activitySummaryForViewer: (userId: string | undefined, viewerScope: string) =>
      ["user", "activity-summary", userId, "viewer", viewerScope] as const,
    bookmarksForViewer: (userId: string | undefined, viewerScope: string) =>
      ["user", "bookmarks", userId, "viewer", viewerScope] as const,
    momentBookmarksForViewer: (userId: string | undefined, viewerScope: string) =>
      ["user", "moment-bookmarks", userId, "viewer", viewerScope] as const,
    followLists: (kind?: "following" | "followers", userId?: string) =>
      kind === undefined
        ? (["user"] as const)
        : userId === undefined
          ? (["user", kind] as const)
          : (["user", kind, userId] as const),
  },
  me: ["me"] as const,
  wallet: {
    detail: (userId: string | undefined) => ["wallet", userId] as const,
    transactions: (userId: string | undefined) =>
      ["wallet", userId, "transactions"] as const,
    transactionPage: (userId: string | undefined, cursor?: string) =>
      ["wallet", userId, "transactions", cursor ?? "first"] as const,
  },
  bookmarks: {
    all: ["bookmarks"] as const,
    list: (folderId?: string) => ["bookmarks", "list", folderId ?? "all"] as const,
    folders: ["bookmarks", "folders"] as const,
  },
  notifications: {
    all: ["notifications"] as const,
    list: (type: string | undefined, userId: string | undefined) =>
      ["notifications", type, userId] as const,
    unread: (userId: string | undefined) =>
      ["notifications", "unread", userId] as const,
  },
  directMessages: {
    all: ["direct-messages"] as const,
    lists: (userId: string | undefined) =>
      ["direct-messages", "lists", userId] as const,
    list: (userId: string | undefined, view: string) =>
      ["direct-messages", "lists", userId, view] as const,
    conversation: (
      userId: string | undefined,
      conversationId: string | undefined,
    ) => ["direct-messages", "conversation", userId, conversationId] as const,
    messages: (
      userId: string | undefined,
      conversationId: string | undefined,
    ) => ["direct-messages", "messages", userId, conversationId] as const,
    updates: (
      userId: string | undefined,
      conversationId: string | undefined,
      afterMessageId: string | undefined,
    ) => ["direct-messages", "updates", userId, conversationId, afterMessageId] as const,
    reconciliation: (
      userId: string | undefined,
      conversationId: string | undefined,
    ) => ["direct-messages", "reconciliation", userId, conversationId] as const,
    lookup: (userId: string | undefined, otherUserId: string | undefined) =>
      ["direct-messages", "lookup", userId, otherUserId] as const,
    unread: (userId: string | undefined) =>
      ["direct-messages", "unread", userId] as const,
  },
  stickers: (userId: string | undefined) => ["stickers", userId] as const,
  subscriptions: ["subscriptions"] as const,
  threadCategories: ["thread-categories"] as const,
  topicTags: (query: string) => ["tags", query] as const,
  topicTagsRoot: ["tags"] as const,
  topicTag: (tagId: string) => ["tag", tagId] as const,
  draftState: ["draft-state"] as const,
  threadDrafts: ["drafts"] as const,
  sessions: (userId?: string) => ["auth-sessions", userId] as const,
  blockedUsers: (userId?: string) => ["blocked-users", userId] as const,
  invitePreview: (token: string | undefined) =>
    ["invite-preview", token] as const,
  invitePreviews: ["invite-preview"] as const,
  moderationDecisions: (userId?: string) => ["moderation-decisions", userId] as const,
  mentionCandidates: (threadId: string, query: string) =>
    ["mention-candidates", threadId, query] as const,
  search: {
    all: ["search"] as const,
    threads: (keyword: string) => ["search", "threads", keyword] as const,
    users: (keyword: string) => ["search", "users", keyword] as const,
    moments: (keyword: string, viewerScope: string) =>
      ["search", "moments", keyword, viewerScope] as const,
  },
  admin: {
    root: ["admin"] as const,
    session: ["admin", "session"] as const,
    casesRoot: ["admin", "cases"] as const,
    cases: (params: object) => ["admin", "cases", params] as const,
    case: (id?: string) => ["admin", "case", id] as const,
    appealsRoot: ["admin", "appeals"] as const,
    appeals: (params: object) => ["admin", "appeals", params] as const,
    accounts: ["admin", "accounts"] as const,
    settings: ["admin", "settings"] as const,
    dashboard: ["admin", "dashboard"] as const,
    usersRoot: ["admin", "users"] as const,
    users: (params: object) => ["admin", "users", params] as const,
    userSearch: (query: string) => ["admin", "user-search", query] as const,
    hiddenContentRoot: ["admin", "hidden-content"] as const,
    hiddenContent: (params: object) => ["admin", "hidden-content", params] as const,
    auditsRoot: ["admin", "audits"] as const,
    audits: (params: object) => ["admin", "audits", params] as const,
    taxonomy: ["admin", "taxonomy"] as const,
    announcementsRoot: ["admin", "announcements"] as const,
    announcements: (params: object) => ["admin", "announcements", params] as const,
  },
};

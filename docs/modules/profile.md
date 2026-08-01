# 用户模块（资料 / 关注拉黑 / 草稿箱）

## 1. 目标与范围

实现用户主页、关注/拉黑、草稿箱三个子功能，补齐全站所有 `Link href="/users/{id}"` 的死链落点。

**本次迭代范围（Phase 6 MVP）：**
- `/users/[id]` 用户主页：资料卡（头像/用户名/Bio/注册时间/关注粉丝数）+ 关注/拉黑按钮 + 最近动态（recent-replies）+ 参与的帖子（played-threads）
- 关注/取消关注、拉黑/取消拉黑（仅登录，用户主页操作）
- `/drafts` 草稿箱：我的未发布帖列表，可跳转继续编辑或删除
- `/me` 我的资料：编辑用户名/Bio、隐私开关、退出后重登生效

**后续迭代：**
- 头像上传（需 media 上传组件，`PATCH /users/me/avatar`）
- 用户收藏页（`GET /users/:id/bookmarks`）与收藏功能
- 我的关注/粉丝/黑名单列表页

## 2. 页面与路由

| 路由 | 页面说明 | 权限 |
|------|----------|------|
| `/users/[id]` | 用户主页：资料卡 + 关注/拉黑 + 最近动态 + 参与的帖子 | 公开（OptionalAuth，登录态显示关系字段与操作） |
| `/drafts` | 我的草稿箱（未发布帖列表） | Auth（仅本人） |
| `/me` | 我的资料编辑（用户名/Bio/隐私开关） | Auth（仅本人） |

## 3. 涉及 API

| Method | Path | Guard | 用途 |
|--------|------|-------|------|
| GET | `/users/me` | AuthRead | 我的完整资料（含 email、隐私开关、_count） |
| PATCH | `/users/me` | Auth | 修改资料（username/bio/隐私开关），5次/分钟限流，需邮箱已验证 |
| GET | `/users/:id` | OptionalAuth | 用户公开资料；登录态额外返回 isFollowing/isFollowedBy/isBlocked/isBlockedBy |
| GET | `/users/:id/recent-replies` | OptionalAuth | 最近 10 条回复（仅 PUBLIC 帖），不分页，受 showRecentReplies 控制 |
| GET | `/users/:id/played-threads` | OptionalAuth | 参与的帖子（玩家标记），按加入时间倒序，Cursor 分页，受 showPlayerBadges 控制 |
| POST | `/users/follow/:id` | Auth | 关注（幂等，首次关注发通知） |
| DELETE | `/users/follow/:id` | Auth | 取消关注 |
| POST | `/users/me/block/:id` | Auth | 拉黑（幂等 upsert） |
| DELETE | `/users/me/block/:id` | Auth | 取消拉黑 |
| GET | `/threads/draft` | AuthRead | 我的未发布帖列表（草稿箱） |
| DELETE | `/threads/:id` | Auth | 删除草稿（草稿箱操作） |

> **无 body 写操作**：关注/拉黑等无 body 的 POST/DELETE，openapi-fetch 不发送 body 时不带 `Content-Type`，后端可正常解析；**不要**手动设 `Content-Type: application/json` + 空 body（后端 Fastify 返回 40001 "Body cannot be empty"）。

## 4. API 响应快照

真实响应见 `docs/snapshots/users.snapshot.json`（13 端点）与 `docs/snapshots/drafts.snapshot.json`。

### GET /users/me → UserMe

```json
{
  "code": 0, "message": "ok",
  "data": {
    "id": "cms7kpgnb00067q6lg4u0tyuu",
    "email": "test_thread2@example.com",
    "username": "testthread2",
    "avatar": null,
    "bio": null,
    "role": "USER",
    "showRecentReplies": true,
    "showPlayerBadges": true,
    "showBookmarks": true,
    "emailVerified": true,
    "deletedAt": null,
    "createdAt": "2026-07-30T13:52:39.048Z",
    "updatedAt": "2026-07-30T13:52:39.048Z",
    "_count": { "following": 0, "followers": 0 }
  }
}
```

### GET /users/:id（登录态）→ UserPublic

```json
{
  "code": 0, "message": "ok",
  "data": {
    "id": "cms5zycb900017q0azar1nag2",
    "username": "testuser",
    "avatar": null,
    "bio": null,
    "role": "USER",
    "showRecentReplies": true,
    "showPlayerBadges": true,
    "showBookmarks": true,
    "createdAt": "2026-07-29T11:23:55.222Z",
    "_count": { "following": 0, "followers": 0 },
    "isFollowing": false, "isFollowedBy": false, "isBlocked": false, "isBlockedBy": false
  }
}
```

> 已注销用户被屏蔽为 `{ id, username: "已注销用户", isDeactivated: true }`。

### GET /users/:id/recent-replies → RecentReply[]

```json
{
  "code": 0, "message": "ok",
  "data": [
    {
      "id": "cmsapbpui00577q31p0c1vfxx",
      "createdAt": "2026-08-01T18:25:14.395Z",
      "floorNumber": null,
      "parentPostId": "cmsapbowx00517q313y47bmtj",
      "content": "楼中楼回复内容",
      "threadId": "cmsapbna4004n7q31w8dvc0ln",
      "thread": { "title": "管理面板测试帖 1785608711288" },
      "subthreadId": "cmsapbna8004r7q319m86krin",
      "subthread": { "title": "管理面板测试帖 1785608711288" },
      "preview": "楼中楼回复内容"
    }
  ]
}
```

> `parentPostId` 为 null → 楼层回复，非 null → 楼中楼回复（楼层号 floorNumber=null）。`preview` 为 Markdown 剥离后的纯文本截断。

### GET /users/:id/played-threads?limit=3 → Thread[] + meta

```json
{
  "code": 0, "message": "ok",
  "data": [
    {
      "id": "cmsapbna4004n7q31w8dvc0ln",
      "title": "管理面板测试帖 1785608711288",
      "ownerId": "cms5zycb900017q0azar1nag2",
      "category": "DEDUCTION", "status": "RECRUITING", "visibility": "PUBLIC",
      "published": true, "publishedAt": "...", "pinned": false,
      "viewCount": 1, "version": 2, "likeCount": 0,
      "defaultSubthreadId": "...", "createdAt": "...", "updatedAt": "...", "deletedAt": null,
      "owner": { "id": "...", "username": "testuser", "avatar": null },
      "defaultSubthread": { "id": "...", "title": "...", "lastPostAt": "..." },
      "topicTags": [],
      "_count": { "members": 1, "posts": 2, "players": 1 }
    }
  ],
  "meta": { "cursor": "...", "hasMore": true }
}
```

### POST/DELETE 关注、拉黑

```json
// POST /users/follow/:id → 201
{ "code": 0, "message": "ok", "data": { "message": "已关注" } }
// DELETE /users/follow/:id → 200
{ "code": 0, "message": "ok", "data": { "message": "已取消关注" } }
// POST /users/me/block/:id → 201
{ "code": 0, "message": "ok", "data": { "message": "已拉黑" } }
// DELETE /users/me/block/:id → 200
{ "code": 0, "message": "ok", "data": { "message": "已取消拉黑" } }
```

### GET /threads/draft → Thread[]

```json
{ "code": 0, "message": "ok", "data": [ /* 我的未发布帖，含 defaultSubthread/topicTags/_count */ ] }
```

## 5. 状态管理

| 状态 | 来源 | 管理方式 |
|------|------|----------|
| 用户资料 | `GET /users/:id` | TanStack Query `useQuery`（queryKey `["user", id]`） |
| 最近动态 | `GET /users/:id/recent-replies` | TanStack Query `useQuery` |
| 参与的帖子 | `GET /users/:id/played-threads` | `useInfiniteQuery`（cursor 分页） |
| 我的资料 | `GET /users/me` | TanStack Query `useQuery` |
| 草稿列表 | `GET /threads/draft` | TanStack Query `useQuery`（queryKey `["drafts"]`） |
| 关注/拉黑状态 | 用户资料中的 isFollowing/isBlocked | `useMutation` + 失效 `["user", id]` |

## 6. 组件清单

| 组件 | 路径 | 说明 |
|------|------|------|
| UserProfileCard | `src/components/user/user-profile-card.tsx` | 用户资料卡：头像（无则首字母）/用户名/Bio/注册时间/关注粉丝数/操作按钮 |
| FollowButton | `src/components/user/follow-button.tsx` | 关注/取消关注切换（未登录跳 /login） |
| BlockButton | `src/components/user/block-button.tsx` | 拉黑/取消拉黑切换（confirm 二次确认） |
| UserRecentReplies | `src/components/user/user-recent-replies.tsx` | 最近动态列表（含楼层/楼中楼标识、帖子标题链接、preview） |
| UserPlayedThreads | `src/components/user/user-played-threads.tsx` | 参与的帖子列表（标题 + 分类/状态徽章 + 无限滚动） |
| DraftList | `src/components/user/draft-list.tsx` | 草稿箱列表（标题/分类/更新时间/继续编辑/删除） |
| useUserProfile | `src/api/hooks/use-user-profile.ts` | 用户公开资料 hook |
| useUserRecentReplies | `src/api/hooks/use-user-recent-replies.ts` | 最近动态 hook |
| useUserPlayedThreads | `src/api/hooks/use-user-played-threads.ts` | 参与帖子 hook（cursor 分页） |
| useFollowActions | `src/api/hooks/use-follow-actions.ts` | 关注/取消关注 mutation |
| useBlockActions | `src/api/hooks/use-block-actions.ts` | 拉黑/取消拉黑 mutation |
| useMe | `src/api/hooks/use-me.ts` | 我的资料 hook |
| useUpdateProfile | `src/api/hooks/use-update-profile.ts` | 修改资料 mutation |
| useDrafts | `src/api/hooks/use-drafts.ts` | 草稿列表 hook |
| UserProfilePage | `src/app/users/[id]/page.tsx` | 用户主页 |
| DraftsPage | `src/app/drafts/page.tsx` | 草稿箱 |
| MePage | `src/app/me/page.tsx` | 我的资料编辑 |

## 7. 表单与校验

### 资料编辑（/me）— PATCH /users/me

Zod schema 对齐后端 DTO：

```ts
username: 2-24 位，字母/数字/中文，禁标点符号与特殊字符
bio: 可选，max 200
showRecentReplies / showPlayerBadges / showBookmarks: boolean
```

> 用户名修改需间隔 7 天以上，不足时后端返回剩余天数提示；冲突返回 409。限流 5 次/分钟。

## 8. 错误处理

| 错误码 | 场景 | UI 行为 |
|--------|------|---------|
| 404 | 用户不存在 / 已注销 / 隐私开关关闭（recent-replies/played-threads） | 板块隐藏或显示"该用户未公开此信息" |
| 40100 | 未登录关注/拉黑 | apiClient 拦截器自动跳 /login |
| 40000 | PATCH /users/me 校验失败 | toast 后端 message |
| 40900 | 用户名冲突 | toast "用户名已被占用" |
| 42900 | 资料修改限流 | toast "操作太频繁，请稍后再试" |
| 网络错误 | fetch 失败 | 显示错误提示 + 重试按钮 |

## 9. 权限与访问控制

| 场景 | 处理 |
|------|------|
| 未登录查看用户主页 | 显示公开资料，不显示关注/拉黑按钮 |
| 查看自己主页 | 显示"编辑资料"入口（跳 /me），不显示关注/拉黑按钮 |
| 关注/拉黑他人 | 仅登录；isFollowing/isBlocked 为 true 时按钮切换为取消态 |
| 隐私开关关闭（showRecentReplies/showPlayerBadges） | 对应板块显示"未公开"占位；后端返回 404 时按 404 处理 |
| 草稿箱 | 仅本人（登录守卫，isInitialized 后再判断） |
| /me | 仅本人（未登录跳 /login） |

## 10. 验收标准

- [x] `/users/[id]` 展示资料卡（头像/用户名/Bio/时间/关注粉丝数）
- [x] 登录态显示关注/拉黑按钮，点击后状态即时更新（isFollowing/isBlocked + 计数）
- [x] 未登录不显示关注/拉黑按钮；点击其他需登录操作跳 /login
- [x] 关注/拉黑自己不显示按钮
- [x] 最近动态列表渲染（楼层/楼中楼标识 + 帖子链接 + preview），为空/未公开有占位
- [x] 参与的帖子列表渲染（标题 + 分类/状态徽章），cursor 分页加载
- [x] 已注销用户显示"已注销用户"占位
- [x] 全站 `/users/{id}` 链接可正常跳转
- [x] `/drafts` 草稿箱列出我的未发布帖，可跳转编辑、可删除
- [x] `/me` 修改用户名/Bio/隐私开关，错误码映射正确
- [x] `pnpm lint && pnpm typecheck && pnpm test && pnpm build` 通过

## 11. 子任务（切片）

- [x] 抓取 users 快照（scripts/api-verify.ts 增加 captureUsers）+ 更新 drafts 快照
- [x] 编写模块设计文档 `docs/modules/profile.md`
- [x] 切片1：用户类型 + `useUserProfile` hook（+ 测试）
- [x] 切片2：`useUserRecentReplies` / `useUserPlayedThreads` hooks（+ 测试）
- [x] 切片3：`useFollowActions` / `useBlockActions` hooks（+ 测试）
- [x] 切片4：`UserProfileCard` / `FollowButton` / `BlockButton` 组件（+ 测试）
- [x] 切片5：`UserRecentReplies` / `UserPlayedThreads` 组件（+ 测试）
- [x] 切片6：`/users/[id]` 用户主页
- [x] 切片7：`useDrafts` hook + `DraftList` 组件 + `/drafts` 草稿箱
- [x] 切片8：`useMe` / `useUpdateProfile` hooks + `/me` 我的资料
- [ ] 质量检查 + 文档同步 + 提交推送

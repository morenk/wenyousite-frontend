# 用户模块（资料 / 登录终端 / 关注拉黑 / 草稿箱）

## 1. 目标与范围

实现用户主页、关注/拉黑、草稿箱三个子功能，补齐全站所有 `Link href="/users/{id}"` 的死链落点。

**当前能力：**
- `/users/[id]` 用户资料使用路由分组共享 Layout 承载资料头部与吸顶 Tab；Tab 路由主动预取，切换时只替换内容区且资料头不卸载，慢速切换只显示局部骨架；概览展示创作活动汇总和允许公开的最近回复，动态列表只留在动态 Tab，未激活内容不挂载查询
- 关注/取消关注、拉黑/取消拉黑（仅登录，用户主页操作）
- 草稿箱：未发布帖列表（进入 `/threads/create` 草稿列表查看，可跳转继续编辑或删除）
- `/me` 我的资料：精确经验与等级进度、主页背景（同一原图分别裁剪 Web 3:1 与移动端 2:1 后一起上传/移除）、头像（1:1 裁剪上传/移除）、邮箱、Bio 与隐私开关（用户名需显式进入编辑，默认不修改）
- `/me/password` 修改密码页：当前密码/新密码/确认新密码（显示/隐藏切换 + 需求提示），成功后登出跳登录
- `/me/email` 更换邮箱页：当前密码二次认证 → 新邮箱 → 6 位验证码，成功后失效 me 缓存并跳转 `/me`
- `/me/security` 账号安全页：双端登录终端、黑名单、账号注销
- 登录终端的跨端安全约束见 `docs/modules/auth.md`
- 参与列表排除自建帖：只有被授予玩家身份（`playerMarked=true`）的帖子才计入，仅回复过而生成的候选成员关系不计入；本人可按“全部 / 公开帖 / 私密帖”分类，他人仅可见公开帖

## 2. 页面与路由

| 路由 | 页面说明 | 权限 |
|------|----------|------|
| `/users/[id]` | 概览 Tab：资料头部 + 创作活动汇总 + 可见的最近回复 | 公开（OptionalAuth，登录态显示关系字段与操作） |
| `/users/[id]/moments` | 动态 Tab：完整用户动态瀑布流 | 公开（OptionalAuth） |
| `/users/[id]/threads` | 帖子 Tab：创建/参与二级切换；只挂载当前列表 | 公开（参与列表受 showPlayerBadges 控制） |
| `/users/[id]/bookmarks` | 收藏 Tab：只读收藏列表 | 公开（受 showBookmarks 控制；无权限时不挂载查询） |
| `/users/[id]/following` | 该用户关注的人列表 | 公开（OptionalAuth） |
| `/users/[id]/followers` | 该用户的粉丝列表 | 公开（OptionalAuth） |
| `/me` | 我的资料编辑（Bio/隐私开关/账号安全入口） | Auth（仅本人） |
| `/me/password` | 修改密码（成功后登出跳登录） | Auth（仅本人） |
| `/me/email` | 更换邮箱（当前密码二次认证 + 验证码） | Auth（仅本人） |
| `/me/security` | Web / 移动端登录终端管理、黑名单管理、注销账号 | Auth（仅本人） |

> 草稿箱不占独立路由：未发布帖列表位于 `/threads/create` 的草稿选择器，入口规则见 `docs/modules/thread-create.md`。

## 3. 涉及 API

| Method | Path | Guard | 用途 |
|--------|------|-------|------|
| GET | `/users/me` | AuthRead | 我的完整资料（含 email、隐私开关、_count） |
| PATCH | `/users/me` | Auth | 修改资料（username/bio/隐私开关），5次/分钟限流 |
| PATCH | `/users/me/avatar` | Auth | 设置头像（传入 mediaId） |
| DELETE | `/users/me/avatar` | Auth | 移除头像（置空 avatar，回到首字母占位） |
| PATCH | `/users/me/profile-cover` | Auth | 原子设置双画幅主页背景（Web 3:1 `mediaId` + 移动端 2:1 `mobileMediaId`） |
| DELETE | `/users/me/profile-cover` | Auth | 同时移除两端主页背景并恢复无背景的紧凑资料卡 |
| POST | `/auth/change-password` | AuthRead | 修改密码（旧+新），成功后退出全部登录终端并强制重新登录 |
| POST | `/auth/change-email/request-code` | Auth | 更换邮箱第一步：校验当前密码后向新邮箱发送验证码 |
| POST | `/auth/change-email/verify` | Auth | 更换邮箱第二步：验证码确认并更新邮箱 |
| GET | `/users/:id` | OptionalAuth | 用户公开资料；登录态额外返回 isFollowing/isFollowedBy/isBlocked/isBlockedBy |
| GET | `/users/:id/recent-replies` | OptionalAuth | 最近 10 条回复（仅 PUBLIC 帖），不分页，受 showRecentReplies 控制 |
| GET | `/users/:id/moments` | OptionalAuth | 用户发布的未删除动态，Cursor 分页并过滤双向拉黑关系 |
| GET | `/users/:id/created-threads` | OptionalAuth | 创建的帖子（本人可见全部含私密帖，他人仅 PUBLIC），按创建时间倒序，Cursor 分页 |
| GET | `/users/:id/activity-summary` | OptionalAuth | 创作活动汇总：可见动态、自建主题、玩家身份参与主题、回复总数；隐私项无权时为 null |
| GET | `/users/:id/played-threads` | OptionalAuth | 已获授玩家身份的非自建帖子，支持 `visibility=PUBLIC\|PRIVATE`；本人可见公开/私密帖，他人仅可见公开帖，按加入时间倒序和 Cursor 分页 |
| POST | `/users/follow/:id` | Auth | 关注（幂等，首次关注发通知） |
| POST | `/users/:id/tips` | Auth | 向该用户投入不少于 2 升温油（UUID 幂等） |
| DELETE | `/users/follow/:id` | Auth | 取消关注 |
| GET | `/users/:id/following` | OptionalAuth | 该用户的关注列表（公开，用户不存在 404） |
| GET | `/users/:id/followers` | OptionalAuth | 该用户的粉丝列表（公开，用户不存在 404） |
| POST | `/users/me/block/:id` | Auth | 拉黑（幂等 upsert） |
| DELETE | `/users/me/block/:id` | Auth | 取消拉黑 |
| GET | `/users/me/blocks` | AuthRead | 我的黑名单 |
| GET | `/auth/sessions` | AuthRead | 当前用户活跃登录终端（Web / 移动端最多各一条） |
| DELETE | `/auth/sessions/:id` | AuthRead | 退出指定登录终端 |
| DELETE | `/users/me` | Auth | 注销账号并退出全部登录终端 |
| GET | `/threads/draft` | AuthRead | 我的未发布帖列表（草稿箱） |
| DELETE | `/threads/:id` | Auth | 删除草稿（草稿箱操作） |

> **无 body 写操作**：关注/拉黑等无 body 的 POST/DELETE，openapi-fetch 不发送 body 时不带 `Content-Type`，后端可正常解析；**不要**手动设 `Content-Type: application/json` + 空 body（后端 Fastify 返回 40001 "Body cannot be empty"）。

## 4. 响应结构

响应结构以固定 OpenAPI 和 `src/api/types.ts` 的生成类型为事实源。

### GET /users/me → UserMe

```json
{
  "code": 0, "message": "ok",
  "data": {
    "id": "<redacted-id>",
    "email": "<redacted-email>",
    "username": "testthread2",
    "avatar": null,
    "profileCover": null,
    "bio": null,
    "role": "USER",
    "showRecentReplies": true,
    "showPlayerBadges": true,
    "showBookmarks": true,
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
    "id": "<redacted-id>",
    "username": "testuser",
    "avatar": null,
    "profileCover": null,
    "bio": null,
    "role": "USER",
    "showRecentReplies": true,
    "showPlayerBadges": true,
    "showBookmarks": true,
    "accountStatus": "ACTIVE",
    "createdAt": "2026-07-29T11:23:55.222Z",
    "_count": { "following": 0, "followers": 0 },
    "isFollowing": false, "isFollowedBy": false, "isBlocked": false, "isBlockedBy": false
  }
}
```

> 已注销用户的公开主页被屏蔽为 `{ id, username: "已注销用户", isDeactivated: true }`；帖子作者、楼主、成员、关注列表、收藏、搜索和通知中的用户摘要也统一显示“已注销用户”与灰色用户图标，不显示内部墓碑用户名或旧头像。注销事务会解除头像与双画幅背景的结构化媒体引用；后端在引用账本对账和宽限期后统一执行孤儿回收。

公开资料的 `accountStatus` 为 `ACTIVE / SUSPENDED / BANNED`。资料卡只在后两种状态显示“该用户已被暂时封禁 / 永久封禁”，不显示处罚原因或具体截止时间。

邮箱是否验证不属于公开身份状态：用户列表、主题/动态详情和个人资料卡均不显示验证徽标；未验证用户仍从本人账号安全入口或受限操作上下文进入验证流程。

用户公开资料、最近动态、创建帖、收藏和参与帖使用 60 秒新鲜期，并在离开页面后保留 30 分钟，返回上一页面时优先复用缓存；关注列表继续使用默认缓存策略。其中会随身份变化的 OptionalAuth 数据在 query key 中加入查看者 ID，认证恢复或账号切换后不会复用匿名/其他账号的权限结果。关注、收藏、资料修改等写操作仍主动失效对应查询。

个人主页的创建帖、参与帖和公开收藏与首页、主题帖搜索统一消费完整 `ThreadListItemResponseDto` 基础卡片字段；页面只保留自己的查询 key、权限、排序和空态，不维护较窄的帖子传输模型。个人动态继续与动态首页、搜索和动态收藏共用 `MomentCardResponseDto`。

### GET /users/:id/recent-replies → RecentReply[]

```json
{
  "code": 0, "message": "ok",
  "data": [
    {
      "id": "<redacted-id>",
      "createdAt": "2026-08-01T18:25:14.395Z",
      "floorNumber": null,
      "parentPostId": "<redacted-id>",
      "content": "楼中楼回复内容",
      "threadId": "<redacted-id>",
      "thread": { "title": "管理面板测试帖 1785608711288" },
      "subthreadId": "<redacted-id>",
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
      "id": "<redacted-id>",
      "title": "管理面板测试帖 1785608711288",
      "ownerId": "<redacted-id>",
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

### GET /auth/sessions → 登录终端[]

```json
{
  "code": 0,
  "message": "ok",
  "data": [
    {
      "id": "<stable-terminal-id>",
      "platform": "web",
      "deviceInfo": "<deprecated-raw-user-agent>",
      "isCurrent": true,
      "signedInAt": "2026-08-05T09:00:00.000Z",
      "lastActiveAt": "2026-08-05T09:15:00.000Z",
      "expiresAt": "2026-08-12T09:15:00.000Z",
      "createdAt": "2026-08-05T09:00:00.000Z"
    }
  ]
}
```

界面只依据 `platform` 映射“Web 端登录”或“移动端登录”，不展示已废弃的 `deviceInfo` 原始 UA。`id` 在 refresh token 轮转期间稳定；`signedInAt` 是本次终端登录时间，`lastActiveAt` 是最近登录/刷新时间，`createdAt` 仅为旧客户端兼容别名。

### GET /threads/draft → Thread[]

```json
{ "code": 0, "message": "ok", "data": [ /* 我的未发布帖，含 defaultSubthread/topicTags/_count */ ] }
```

## 5. 状态管理

| 状态 | 来源 | 管理方式 |
|------|------|----------|
| 用户资料 | `GET /users/:id` | TanStack Query `useQuery`（`queryKeys.users.detailForViewer(id, viewerScope)`） |
| 创作活动汇总 | `GET /users/:id/activity-summary` | TanStack Query `useQuery`（按 viewerScope 隔离，60 秒新鲜期） |
| 最近动态 | `GET /users/:id/recent-replies` | TanStack Query `useQuery` |
| 创建的帖子 | `GET /users/:id/created-threads` | `useInfiniteQuery`（cursor 分页） |
| 参与的帖子 | `GET /users/:id/played-threads` | `useInfiniteQuery`（cursor 分页；query key 含 PUBLIC/PRIVATE/ALL 分类） |
| 我的资料 | `GET /users/me` | TanStack Query `useQuery` |
| 草稿列表 | `GET /threads/draft` | TanStack Query `useQuery`（`queryKeys.threadDrafts`） |
| 关注/拉黑状态 | 用户资料中的 isFollowing/isBlocked | 领域 mutation hook 统一更新/失效用户资料 |
| 登录终端 | `GET /auth/sessions` | `queryKeys.auth.sessions(userId)`；`staleTime=0`，退出成功后按稳定终端 ID 从缓存移除 |
| 黑名单 | `GET /users/me/blocks` | `queryKeys.users.blocks(userId)`，取消拉黑后失效缓存 |

登录终端与黑名单的 query key 包含当前用户 ID；AuthContext 中用户身份变化时，根 Provider 还会重新创建 QueryClient，从缓存容器层阻断其他私有数据在账号切换后串用。

## 6. 组件清单

| 组件 | 路径 | 说明 |
|------|------|------|
| UserProfileShell | `src/components/user/user-profile-shell.tsx` | 由 `(profile)/layout.tsx` 持久挂载的资料头部、权限 Context 与吸顶路由 Tab；切换 Tab 时不卸载 |
| UserProfileTabFallback | `src/components/user/user-profile-tab-fallback.tsx` | Tab 路由慢速切换的局部内容骨架，不重复资料头部、导航或 PageShell |
| UserActivitySummaryCard | `src/components/user/user-activity-summary.tsx` | 概览四项创作统计；精确数字、隐私占位及动态/帖子/最近回复入口 |
| UserProfileCard | `src/components/user/user-profile-card.tsx` | 用户主页头部：有背景图时显示 3:1 背景墙和明确置顶的半覆盖头像；无背景图时回退紧凑默认资料卡 |
| ProfileCover | `src/components/user/profile-cover.tsx` | 背景图展示：支持 Web 3:1 / 移动端 2:1 占位；当前 `PROFILE_COVER` 不生成通用派生图，直接使用接口母版，历史响应若含 `mediumUrl` 则通过 `srcset` 按视口/DPR 选择，并保留原图回退与加载失败状态 |
| UserAvatar | `src/components/shared/user-avatar.tsx` | 共享头像组件：直接使用接口返回的 512×512 WebP 头像母版，不猜测不存在的派生图 URL；无图或加载失败时显示首个可读字符；匿名、已注销或不可用身份忽略旧 URL 并使用中性用户图标；公开资料不显示邮箱验证状态 |
| FollowButton | `src/components/user/follow-button.tsx` | 关注/取消关注切换（未登录跳 /login） |
| BlockButton | `src/components/user/block-button.tsx` | 拉黑/取消拉黑切换（全局无障碍确认框二次确认） |
| UserFollowList | `src/components/user/user-follow-list.tsx` | 关注/粉丝列表（头像 + 用户名链接 + 三态，复用两种列表） |
| FollowListPage | `src/components/user/follow-list-page.tsx` | 关注/粉丝子页面主体（用户名标题 + 返回链接 + 列表） |
| UserRecentReplies | `src/components/user/user-recent-replies.tsx` | 最近回复列表（**仅展示最近 5 条**；整卡通过共享 `getPostHref` 精确定位到对应楼层/楼中楼/正文；正文/楼层/楼中楼三态标识 + preview） |
| UserCreatedThreads | `src/components/user/user-created-threads.tsx` | 创建的帖子列表，复用首页 `ThreadList`/`ThreadCard` |
| UserPlayedThreads | `src/components/user/user-played-threads.tsx` | 复用首页主题帖列表；本人显示“全部 / 公开帖 / 私密帖”，他人不显示私密分类入口 |
| UserThreadsPage | `src/components/user/user-threads-page.tsx` | 帖子 Tab：创建/参与使用二级切换，只挂载当前无限列表 |
| UserBookmarksPage | `src/components/user/user-bookmarks-page.tsx` | 收藏 Tab：尊重公开权限，无权限时不发起收藏请求 |
| DraftList | `src/components/user/draft-list.tsx` | 草稿箱列表（标题/分类/更新时间/继续编辑/删除） |
| UsernameEdit | `src/components/user/username-edit.tsx` | 独立用户名修改（默认只读，点「修改用户名」才进入编辑态，未改动不提交） |
| AvatarUploader | `src/components/user/avatar-uploader.tsx` | 头像上传器：预览（512×512 WebP 母版/首字母占位）→ 文件选择校验（仅 jpg/png/webp，排除 svg）→ 共享 Dialog 内用 react-easy-crop 1:1 裁剪 → canvas 优先导出 512×512 WebP，Safari 编码回退时按真实 PNG/JPEG 上传 → 预签名直传（真实字节进度、可取消、同 ID 恢复）→ `PATCH /me/avatar` 立即生效；绑定失败重试复用已上传 mediaId；「移除头像」调 `DELETE /me/avatar` |
| ProfileCoverUploader | `src/components/user/profile-cover-uploader.tsx` | 双画幅背景上传器：同一原图分别调整 Web 3:1 与移动端 2:1 取景框 → 并行生成 1920×640 / 1600×800 高质量图片（优先 WebP，按浏览器真实 PNG/JPEG 回退）→ 并行上传并聚合进度 → 原子绑定；支持失败续传、取消、更换和同时移除 |
| ChangePasswordForm | `src/components/user/change-password-form.tsx` | 修改密码表单（当前/新/确认密码，PasswordInput 显隐切换），成功后登出跳登录 |
| ChangeEmailForm | `src/components/user/change-email-form.tsx` | 更换邮箱表单（当前密码二次认证 → 新邮箱 → 验证码），成功后失效 me 缓存并跳转 `/me` |
| PasswordInput | `src/components/ui/password-input.tsx` | 密码输入框（Eye/EyeOff 显示/隐藏切换） |
| useSetAvatar | `src/api/hooks/use-set-avatar.ts` | 设置/移除头像 hook（PATCH/DELETE `/users/me/avatar`，成功后失效 me/user 缓存） |
| useSetProfileCover | `src/api/hooks/use-set-profile-cover.ts` | 设置/移除双画幅主页背景 hook（PATCH 同时发送 `mediaId` 与 `mobileMediaId`，DELETE 清除两端；成功后失效 me/user 缓存） |
| getCroppedBlob | `src/lib/avatar-crop.ts` | react-easy-crop 裁剪区域 → 512×512 Canvas Blob（优先 WebP，浏览器可回退 PNG） |
| useUserProfile | `src/api/hooks/use-user-profile.ts` | 用户公开资料 hook |
| useUserActivitySummary | `src/api/hooks/use-user-activity-summary.ts` | 按查看者隔离的主页创作汇总 hook |
| useUserFollowList | `src/api/hooks/use-user-follow-list.ts` | 关注/粉丝列表 hook（kind 复用） |
| useUserRecentReplies | `src/api/hooks/use-user-recent-replies.ts` | 最近动态 hook |
| useUserCreatedThreads | `src/api/hooks/use-user-created-threads.ts` | 创建的帖子 hook（cursor 分页） |
| useUserPlayedThreads | `src/api/hooks/use-user-played-threads.ts` | 参与帖子 hook（服务端 visibility 分类 + cursor 分页） |
| useFollowActions | `src/api/hooks/use-follow-actions.ts` | 关注/取消关注 mutation |
| useBlockActions | `src/api/hooks/use-block-actions.ts` | 拉黑/取消拉黑 mutation |
| useMe | `src/api/hooks/use-me.ts` | 我的资料 hook |
| useUpdateProfile | `src/api/hooks/use-update-profile.ts` | 修改资料 mutation |
| useDrafts | `src/api/hooks/use-drafts.ts` | 草稿列表 hook |
| UserProfilePage | `src/app/users/[id]/(profile)/page.tsx` | 用户资料概览：创作汇总与最近回复；URL 仍为 `/users/[id]` |
| MePage | `src/app/me/page.tsx` | 我的资料编辑 |
| AccountSecurityPanel | `src/components/user/account-security-panel.tsx` | 双端登录终端、黑名单和账号注销三块安全操作；当前终端不可远程退出 |
| useAccountSecurity | `src/api/hooks/use-account-security.ts` | 登录终端列表/退出、黑名单/取消拉黑、注销账号 hooks |

## 7. 表单与校验

### 资料编辑（/me）— PATCH /users/me

主表单与用户名修改**解耦**（用户名改动需谨慎 + 7 天冷却，默认不修改）：

**主表单**（bio + 隐私开关）— `profileSchema`，不含 username：

```ts
bio: 可选，max 255
showRecentReplies / showPlayerBadges / showBookmarks: boolean
```

**独立用户名修改**（`UsernameEdit`，`usernameSchema`）：
- 默认只读展示当前用户名，点「修改用户名」才进入编辑态
- 输入值 trim 后与当前用户名相同 → 不发请求直接收起
- 不同则校验后 `PATCH /users/me { username }`，成功后用 `setAuth` 同步导航栏用户名
- `username`: 2-24 位，字母/数字/中文，禁标点符号与特殊字符

> 用户名修改需间隔 7 天以上，不足时后端返回剩余天数提示；冲突返回 409（code 40900）。限流 5 次/分钟。

## 8. 错误处理

| 错误码 | 场景 | UI 行为 |
|--------|------|---------|
| 404 | 用户不存在 / 已注销 / 隐私开关关闭 | 资料不存在时显示页面空态；查看他人资料时依据公开资料中的隐私开关隐藏对应 Tab/二级入口，不发起收藏、参与帖或最近回复请求 |
| 40100 | 未登录关注/拉黑 | apiClient 拦截器自动跳 /login |
| 40000 | PATCH /users/me 校验失败 | toast 后端 message（全部中文化，无英文默认提示） |
| 40900 | 用户名冲突（后端 ConflictException 409） | "用户名已被占用" |
| 42900 | 资料修改限流 | toast "操作太频繁，请稍后再试" |
| 网络错误 | fetch 失败 | 显示错误提示 + 重试按钮 |

## 9. 权限与访问控制

| 场景 | 处理 |
|------|------|
| 未登录查看用户主页 | 显示公开资料，不显示关注/拉黑按钮 |
| 查看自己主页 | 显示"编辑资料"入口（跳 /me），不显示关注/拉黑按钮 |
| 查看自己的参与列表 | 只返回已获授玩家身份的非自建帖子（可含私密帖），可按全部/公开帖/私密帖分类 |
| 查看他人的参与列表 | 不显示分类控件；后端仅返回 PUBLIC 且 playerMarked=true 的帖子，绝不返回私密帖 |
| 关注/拉黑他人 | 仅登录；isFollowing/isBlocked 为 true 时按钮切换为取消态；成功仅更新按钮或黑名单状态，失败显示错误 Toast |
| 隐私开关关闭（showRecentReplies/showPlayerBadges/showBookmarks） | 概览不挂载最近回复；帖子页隐藏参与入口；收藏 Tab 隐藏，直达时显示未公开且不发请求 |
| 草稿箱 | 仅本人（登录守卫，isInitialized 后再判断） |
| /me | 仅本人（未登录跳 /login） |
| 注销账号 | 必须输入“注销账号”二次确认；成功后清空本地登录态并跳首页 |

## 10. 验收标准

- `/users/[id]` 展示资料卡（头像/用户名/Bio/时间/关注粉丝数）
- 资料头部下方提供概览/动态/帖子/收藏路由 Tab，滚动时保持可达；隐私 Tab 按权限隐藏
- 概览仅请求活动汇总和允许公开的最近回复，不挂载动态瀑布流、帖子、收藏或参与列表
- `/users/[id]/moments` 展示完整动态瀑布流，继续使用 cursor 分页与虚拟化
- `/users/[id]/threads` 在创建/参与之间二级切换，只挂载当前列表；两类列表复用首页主题帖卡片与加载状态
- `/users/[id]/bookmarks` 复用首页主题帖卡片只读展示允许访问的收藏；本人显示新建收藏夹入口，无权限时不发起收藏请求
- 「关注 N」「粉丝 N」可点击进入 `/users/[id]/following` / `/users/[id]/followers` 列表页
- 关注/粉丝列表展示用户名 + 头像，空态/错误态有占位
- 登录态显示关注/拉黑按钮，点击后状态即时更新（isFollowing/isBlocked + 计数）
- 未登录不显示关注/拉黑按钮；点击其他需登录操作跳 /login
- 关注/拉黑自己不显示按钮
- 最近回复列表渲染（正文/楼层/楼中楼三态标识 + 帖子链接 + preview），**仅展示最近 5 条**，为空/未公开有占位；点击通过共享 `getPostHref` 精确定位到对应楼层/楼中楼/正文
- 创建的帖子列表使用首页信息层级渲染作者、更新时间、分类/状态、标题、预览、标签与统计，cursor 分页加载
- 参与的帖子列表复用首页信息层级并显示私密徽章，cursor 分页加载，不含自建帖；本人可按全部/公开帖/私密帖分类，他人仅见公开玩家帖
- 已注销用户在全站用户摘要中统一显示“已注销用户”与灰色用户图标
- 全站 `/users/{id}` 链接可正常跳转
- 草稿箱（`/threads/create` 草稿列表）列出我的未发布帖，可跳转编辑、可删除
- `/me` 修改用户名/Bio/隐私开关，错误码映射正确
- `/me/security` 以“Web 端登录/移动端登录”展示双端登录终端，不显示原始 UA
- `/me/security` 正确标记当前终端，并可退出另一登录终端
- 登录终端登录时间在 token 轮转后保持不变，账号切换不复用旧账号缓存
- `/me/security` 可查看黑名单并取消拉黑
- 输入确认文字后可注销账号并清空登录态

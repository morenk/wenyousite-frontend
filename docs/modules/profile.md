# 用户模块（资料 / 登录终端 / 关注拉黑 / 草稿箱）

> 本轮跨端发布批次：`private-thread-access-2026-08-05`。

## 1. 目标与范围

实现用户主页、关注/拉黑、草稿箱三个子功能，补齐全站所有 `Link href="/users/{id}"` 的死链落点。

**本次迭代范围（Phase 6 MVP）：**
- `/users/[id]` 用户主页：资料卡（头像/用户名/等级/Bio/注册时间/关注粉丝数/累计被投入温油总额与次数）+ 温油投入/私聊/关注/拉黑按钮 + 最近动态（recent-replies）+ 创建的帖子（created-threads）+ 参与的帖子（played-threads）
- 关注/取消关注、拉黑/取消拉黑（仅登录，用户主页操作）
- 草稿箱：未发布帖列表（进入 `/threads/create` 草稿列表查看，可跳转继续编辑或删除）
- `/me` 我的资料：精确经验与等级进度、累计收到温油统计、邮箱（并入基本信息，脱敏显示 + 邮箱验证状态，未验证可跳转 `/verify-email`）、头像（裁剪上传/移除）、Bio（textarea + 255 字数统计）、隐私开关（用户名需显式进入编辑，默认不修改）
- `/me/password` 修改密码页：当前密码/新密码/确认新密码（显示/隐藏切换 + 需求提示），成功后登出跳登录
- `/me/email` 更换邮箱页：当前密码二次认证 → 新邮箱 → 6 位验证码，成功后失效 me 缓存并跳转 `/me`
- `/me/security` 账号安全页：双端登录终端、黑名单、账号注销
- 登录终端改动属于发布批次 `auth-login-terminal-2026-08-05`；跨端契约、数据库迁移、发布顺序与回滚要求见 `docs/modules/auth.md`
- 参与列表排除自建帖：只有被授予玩家身份（`playerMarked=true`）的帖子才计入，仅回复过而生成的候选成员关系不计入；本人可按“全部 / 公开帖 / 私密帖”分类，他人仅可见公开帖

**后续迭代：**
- 无（举报与管理后台不属于本模块）

## 2. 页面与路由

| 路由 | 页面说明 | 权限 |
|------|----------|------|
| `/users/[id]` | 用户主页：资料卡 + 最近动态 + 创建的帖子 + 参与的帖子 | 公开（OptionalAuth，登录态显示关系字段与操作） |
| `/users/[id]/following` | 该用户关注的人列表 | 公开（OptionalAuth） |
| `/users/[id]/followers` | 该用户的粉丝列表 | 公开（OptionalAuth） |
| `/me` | 我的资料编辑（Bio/隐私开关/账号安全入口） | Auth（仅本人） |
| `/me/password` | 修改密码（成功后登出跳登录） | Auth（仅本人） |
| `/me/email` | 更换邮箱（当前密码二次认证 + 验证码） | Auth（仅本人） |
| `/me/security` | Web / 移动端登录终端管理、黑名单管理、注销账号 | Auth（仅本人） |

> 草稿箱不占独立路由：未发布帖列表收进 `/threads/create` 的草稿选择器（原 `/drafts` 路由已删除，入口迁移见 `docs/modules/thread-create.md`）。

## 3. 涉及 API

| Method | Path | Guard | 用途 |
|--------|------|-------|------|
| GET | `/users/me` | AuthRead | 我的完整资料（含 email、隐私开关、_count） |
| PATCH | `/users/me` | Auth | 修改资料（username/bio/隐私开关），5次/分钟限流，需邮箱已验证 |
| PATCH | `/users/me/avatar` | Auth | 设置头像（传入 mediaId），需邮箱已验证 |
| DELETE | `/users/me/avatar` | Auth | 移除头像（置空 avatar，回到首字母占位），需邮箱已验证 |
| POST | `/auth/change-password` | AuthRead | 修改密码（旧+新），成功后退出全部登录终端并强制重新登录 |
| POST | `/auth/change-email/request-code` | Auth | 更换邮箱第一步：校验当前密码后向新邮箱发送验证码 |
| POST | `/auth/change-email/verify` | Auth | 更换邮箱第二步：验证码确认并更新邮箱 |
| GET | `/users/:id` | OptionalAuth | 用户公开资料；登录态额外返回 isFollowing/isFollowedBy/isBlocked/isBlockedBy |
| GET | `/users/:id/recent-replies` | OptionalAuth | 最近 10 条回复（仅 PUBLIC 帖），不分页，受 showRecentReplies 控制 |
| GET | `/users/:id/created-threads` | OptionalAuth | 创建的帖子（本人可见全部含私密帖，他人仅 PUBLIC），按创建时间倒序，Cursor 分页 |
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

## 4. API 响应快照

真实响应见 `docs/snapshots/users.snapshot.json`（13 端点）与 `docs/snapshots/drafts.snapshot.json`。

### GET /users/me → UserMe

```json
{
  "code": 0, "message": "ok",
  "data": {
    "id": "<redacted-id>",
    "email": "<redacted-email>",
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
    "id": "<redacted-id>",
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

> 已注销用户的公开主页被屏蔽为 `{ id, username: "已注销用户", isDeactivated: true }`；帖子作者、楼主、成员、关注列表、收藏、搜索和通知中的用户摘要也统一显示“已注销用户”与灰色用户图标，不显示内部墓碑用户名或旧头像。注销事务清空头像引用后，后端确认该 URL 未被正文、草稿或其他头像引用时立即删除原图和派生图；失败由每日孤儿回收兜底。

用户公开资料、最近动态、创建帖、收藏和参与帖使用 60 秒新鲜期，并在离开页面后保留 30 分钟，返回上一页面时优先复用缓存；关注列表继续使用默认缓存策略。其中会随身份变化的 OptionalAuth 数据在 query key 中加入查看者 ID，认证恢复或账号切换后不会复用匿名/其他账号的权限结果。关注、收藏、资料修改等写操作仍主动失效对应查询。

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
| UserProfileCard | `src/components/user/user-profile-card.tsx` | 用户资料卡：头像（无则首字母）/用户名/Bio/注册时间/关注粉丝数（可点击）/操作按钮 |
| UserAvatar | `src/components/shared/user-avatar.tsx` | 共享头像组件：有 URL 用 `_thumb.webp` 缩略图，无则首字母占位；“已注销用户”始终忽略 URL 并使用统一灰色用户图标；尺寸通过 className 控制（资料卡/关注列表/通知/主题帖列表/楼层/楼中楼复用） |
| FollowButton | `src/components/user/follow-button.tsx` | 关注/取消关注切换（未登录跳 /login） |
| BlockButton | `src/components/user/block-button.tsx` | 拉黑/取消拉黑切换（全局无障碍确认框二次确认） |
| UserFollowList | `src/components/user/user-follow-list.tsx` | 关注/粉丝列表（头像 + 用户名链接 + 三态，复用两种列表） |
| FollowListPage | `src/components/user/follow-list-page.tsx` | 关注/粉丝子页面主体（用户名标题 + 返回链接 + 列表） |
| UserRecentReplies | `src/components/user/user-recent-replies.tsx` | 最近动态列表（**仅展示最近 5 条**；整卡通过共享 `getPostHref` 精确定位到对应楼层/楼中楼/正文；正文/楼层/楼中楼三态标识 + preview） |
| UserThreadList | `src/components/user/user-thread-list.tsx` | 用户帖子列表通用展示组件（徽章/标题/无限滚动，empty/error 文案 props） |
| UserCreatedThreads | `src/components/user/user-created-threads.tsx` | 创建的帖子列表（薄包装：useUserCreatedThreads + UserThreadList） |
| UserPlayedThreads | `src/components/user/user-played-threads.tsx` | 参与的帖子列表；本人显示“全部 / 公开帖 / 私密帖”，他人不显示私密分类入口 |
| DraftList | `src/components/user/draft-list.tsx` | 草稿箱列表（标题/分类/更新时间/继续编辑/删除） |
| UsernameEdit | `src/components/user/username-edit.tsx` | 独立用户名修改（默认只读，点「修改用户名」才进入编辑态，未改动不提交） |
| AvatarUploader | `src/components/user/avatar-uploader.tsx` | 头像上传器：预览（`_thumb.webp` 缩略图/首字母占位）→ 文件选择校验（仅 jpg/png/webp，排除 svg）→ react-easy-crop 1:1 裁剪 → canvas 导出 512×512 webp → 上传（预签名+直传+轮询）→ `PATCH /me/avatar` 立即生效；「移除头像」调 `DELETE /me/avatar` |
| ChangePasswordForm | `src/components/user/change-password-form.tsx` | 修改密码表单（当前/新/确认密码，PasswordInput 显隐切换），成功后登出跳登录 |
| ChangeEmailForm | `src/components/user/change-email-form.tsx` | 更换邮箱表单（当前密码二次认证 → 新邮箱 → 验证码），成功后失效 me 缓存并跳转 `/me` |
| PasswordInput | `src/components/ui/password-input.tsx` | 密码输入框（Eye/EyeOff 显示/隐藏切换） |
| useSetAvatar | `src/api/hooks/use-set-avatar.ts` | 设置/移除头像 hook（PATCH/DELETE `/users/me/avatar`，成功后失效 me/user 缓存） |
| getCroppedBlob | `src/lib/avatar-crop.ts` | react-easy-crop 裁剪区域 → 512×512 webp Blob（canvas） |
| useUserProfile | `src/api/hooks/use-user-profile.ts` | 用户公开资料 hook |
| useUserFollowList | `src/api/hooks/use-user-follow-list.ts` | 关注/粉丝列表 hook（kind 复用） |
| useUserRecentReplies | `src/api/hooks/use-user-recent-replies.ts` | 最近动态 hook |
| useUserCreatedThreads | `src/api/hooks/use-user-created-threads.ts` | 创建的帖子 hook（cursor 分页） |
| useUserPlayedThreads | `src/api/hooks/use-user-played-threads.ts` | 参与帖子 hook（服务端 visibility 分类 + cursor 分页） |
| useFollowActions | `src/api/hooks/use-follow-actions.ts` | 关注/取消关注 mutation |
| useBlockActions | `src/api/hooks/use-block-actions.ts` | 拉黑/取消拉黑 mutation |
| useMe | `src/api/hooks/use-me.ts` | 我的资料 hook |
| useUpdateProfile | `src/api/hooks/use-update-profile.ts` | 修改资料 mutation |
| useDrafts | `src/api/hooks/use-drafts.ts` | 草稿列表 hook |
| UserProfilePage | `src/app/users/[id]/page.tsx` | 用户主页 |
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

> **后端修复记录**：`update-user.dto.ts` 用户名曾误用 `@Transform(sanitizeContent)`（class-transformer 传入参数对象而非字符串，导致用户名恒为空、任何合法名都被拒）。已改为 `@Transform(({ value }) => sanitizeContent(value))`；并为 MinLength/MaxLength 补充中文消息（不再出现英文默认提示）。随后 content 字段已彻底移除 sanitize 转换，markdown 原样存储、XSS 由各端渲染层净化（详见 `docs/modules/drafts.md` 内容安全一节）。

## 8. 错误处理

| 错误码 | 场景 | UI 行为 |
|--------|------|---------|
| 404 | 用户不存在 / 已注销 / 隐私开关关闭（recent-replies/played-threads） | 板块隐藏或显示"该用户未公开此信息" |
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
| 关注/拉黑他人 | 仅登录；isFollowing/isBlocked 为 true 时按钮切换为取消态 |
| 隐私开关关闭（showRecentReplies/showPlayerBadges） | 对应板块显示"未公开"占位；后端返回 404 时按 404 处理 |
| 草稿箱 | 仅本人（登录守卫，isInitialized 后再判断） |
| /me | 仅本人（未登录跳 /login） |
| 注销账号 | 必须输入“注销账号”二次确认；成功后清空本地登录态并跳首页 |

## 10. 验收标准

- [x] `/users/[id]` 展示资料卡（头像/用户名/Bio/时间/关注粉丝数）
- [x] 「关注 N」「粉丝 N」可点击进入 `/users/[id]/following` / `/users/[id]/followers` 列表页
- [x] 关注/粉丝列表展示用户名 + 头像，空态/错误态有占位
- [x] 登录态显示关注/拉黑按钮，点击后状态即时更新（isFollowing/isBlocked + 计数）
- [x] 未登录不显示关注/拉黑按钮；点击其他需登录操作跳 /login
- [x] 关注/拉黑自己不显示按钮
- [x] 最近动态列表渲染（正文/楼层/楼中楼三态标识 + 帖子链接 + preview），**仅展示最近 5 条**，为空/未公开有占位；点击通过共享 `getPostHref` 精确定位到对应楼层/楼中楼/正文
- [x] 创建的帖子列表渲染（标题 + 分类/状态徽章），cursor 分页加载
- [x] 参与的帖子列表渲染（标题 + 分类/状态/私密徽章），cursor 分页加载，不含自建帖；本人可按全部/公开帖/私密帖分类，他人仅见公开玩家帖
- [x] 已注销用户在全站用户摘要中统一显示“已注销用户”与灰色用户图标
- [x] 全站 `/users/{id}` 链接可正常跳转
- [x] 草稿箱（`/threads/create` 草稿列表）列出我的未发布帖，可跳转编辑、可删除
- [x] `/me` 修改用户名/Bio/隐私开关，错误码映射正确
- [x] `/me/security` 以“Web 端登录/移动端登录”展示双端登录终端，不显示原始 UA
- [x] `/me/security` 正确标记当前终端，并可退出另一登录终端
- [x] 登录终端登录时间在 token 轮转后保持不变，账号切换不复用旧账号缓存
- [x] `/me/security` 可查看黑名单并取消拉黑
- [x] 输入确认文字后可注销账号并清空登录态
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
- [x] 切片7：`useDrafts` hook + `DraftList` 组件 + 草稿箱（原 `/drafts` 路由，已迁入 `/threads/create` 草稿选择器）
- [x] 切片8：`useMe` / `useUpdateProfile` hooks + `/me` 我的资料
- [x] 同步后端 `created-threads`：useUserCreatedThreads hook + UserThreadList 共享组件 + /users/[id] 创建列表
- [x] 关注/粉丝列表：后端公开端点（/users/:id/following + /followers）+ useUserFollowList + UserFollowList + 子页面
- [x] 登录终端高风险切片：友好平台文案、当前终端识别、稳定 ID 退出、加载/错误/空态、按用户隔离缓存；组件/hook 单测 + 后端真实 PostgreSQL 双端 E2E
- [ ] 质量检查 + 文档同步 + 提交推送

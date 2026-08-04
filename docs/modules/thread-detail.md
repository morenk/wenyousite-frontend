# 主题帖详情与楼层模块

## 1. 目标与范围

实现主题帖详情页，展示帖子头部信息、子贴 Tab 切换、楼层列表（分页）、Markdown 渲染，以及发布新楼层。

**2026-08 单编辑器重构：** 浏览态不预先挂载 Milkdown，仅展示轻量的「发表回复」入口；用户点击发表、回复或编辑后，页面按目标位置挂载全局唯一的上下文编辑器。同一时刻详情页最多存在一个 Milkdown 实例。

**本次迭代范围（Phase 5 MVP）：**
- 主题帖详情页 `/threads/[id]`
- 详情头部（标题/分类/状态/作者/时间/操作按钮）
- 子贴 Tab 切换
- 楼层列表（cursor 分页 + 滚动加载）
- 楼层 Markdown 渲染（react-markdown + remark-gfm）
- 发布新楼层（简易 textarea）
- 点赞/取消点赞主题帖
- 当前用户点赞状态 `isLiked`，不得使用全站 `likeCount` 推断
- Loading / Error / Empty / 404 状态

**后续迭代：**
- ~~楼中楼回复（parentPostId / replyToPostId）~~ → 已实现
- ~~楼层编辑与删除~~ → 已实现（FloorCard 作者可编辑/删除；楼层均可删，子贴正文由后端拦截）
- ~~玩家管理（楼主在候选池中授予/收回玩家身份）~~ → 已实现（管理面板「成员」tab）
- ~~订阅通知~~ → 已实现（ThreadDetailHeader 订阅/取消订阅）
- ~~阅读进度~~ → 已实现（详情页记录进度 + 子贴 Tab 新回复徽标）

## 2. 页面与路由

| 路由 | 页面说明 | 权限 |
|------|----------|------|
| `/threads/[id]` | 主题帖详情页（含子贴、楼层） | 公开（PRIVATE 帖非成员返回 404） |
| `/threads/[id]?post={postId}` | 从通知进入并精确定位楼层/楼中楼 | 继承主题帖访问权限 |
| `/threads/[id]/posts/[postId]/replies?post={replyId}` | 独立楼中楼阅读页：原楼层作为讨论正文，楼中楼回复作为连续楼层 | 继承主题帖访问权限 |
| `/threads/[id]/edit` | 状态感知编辑页：草稿使用 ThreadCreateForm（可发布），已发布帖使用 ThreadEditForm（保存修改） | OWNER only |

## 3. 涉及 API

| Method | Path | Guard | 用途 |
|--------|------|-------|------|
| GET | `/threads/:id` | OptionalAuth | 主题帖详情（含子贴列表、owner、_count；登录时附加 isBookmarked/isLiked） |
| DELETE | `/threads/:id` | Auth | 删除主题帖：未发布帖硬删除，已发布帖软删除，仅 OWNER |
| GET | `/subthreads/:subthreadId/posts` | Public | 楼层列表（cursor 分页，含最多 5 条内联 replies） |
| POST | `/subthreads/:subthreadId/posts` | Auth | 发布新楼层/楼中楼回复（kind=FLOOR，发帖自动成为参与人=玩家候选池；楼中楼带 parentPostId/replyToPostId） |
| GET | `/posts/:id/replies` | Public | 楼中楼回复列表（cursor 分页） |
| GET | `/posts/:id` | Public | 查询通知目标帖的主题、子贴与父楼上下文 |
| PUT | `/subthreads/:subthreadId/body` | Auth | upsert 子贴正文（管理面板保存正文：无正文创建 kind=BODY，有正文乐观锁更新） |
| POST | `/threads/:id/like` | Auth | 点赞主题帖（幂等） |
| DELETE | `/threads/:id/like` | Auth | 取消点赞 |
| GET | `/threads/:threadId/members` | Public | 参与人列表（管理面板成员 tab） |
| PATCH | `/threads/:threadId/members/:userId` | Auth | 授予/移除协作者身份，授予/收回玩家标记 |
| GET | `/subscriptions` | Auth | 我的订阅列表 |
| POST | `/subscriptions` | Auth | 创建订阅（THREAD/USER） |
| DELETE | `/subscriptions/:id` | Auth | 取消订阅 |
| POST | `/reading-progress` | Auth | 记录阅读进度（subthreadId + postId） |
| GET | `/reading-progress/new-replies` | Auth | 子贴新增回复数 |

> **「参与」语义**：用户**无需手动加入**，在帖子内回复后由后端自动写入参与人记录（玩家候选池），对用户无感。前端不再提供加入/退出按钮。元数据显示的 `_count.players` 为被楼主授予玩家身份（`playerMarked=true`）的人数。

> **候选池管理**：参与人记录只表示用户曾回复过主题帖，用于楼主选定玩家；管理操作不会删除参与人记录，仅通过角色字段管理协作者身份、通过 `playerMarked` 管理玩家标记。

> **ID 校验说明**：后端所有 ID 为 Prisma `cuid()` 生成的 CUID（非 UUID），DTO 校验统一使用 `@IsCuid`（替代 `@IsUUID`，后者会因 CUID 不含连字符而拒绝请求）。

> **通知精确定位**：主楼层仍使用详情页 `?post=` 注入并立即定位；楼中楼通知直接进入 `/threads/{threadId}/posts/{parentPostId}/replies?post={replyId}`，在独立阅读页立即定位并高亮目标回复。定位不使用平滑移动动画；高亮只作用于目标楼层/回复卡片本身，父楼层和列表容器不高亮。兼容旧链接：详情页发现目标是楼中楼时立即重定向到独立阅读页，重定向期间不高亮父楼层。

> **站内链接契约（第一切片）**：楼中楼回复可通过 `/threads/{threadId}/posts/{parentPostId}/replies?post={replyId}` 精确定位；回复卡片提供复制链接入口。该 URL 仅依赖现有 Post 字段，不新增 API。

> **站内链接契约（第二切片）**：主楼层可通过 `/threads/{threadId}?post={postId}` 精确定位；楼层卡片提供复制链接入口。该 URL 仅依赖现有 Post 字段，不新增 API。

> **站内链接契约（第三切片）**：主题帖可通过 `/threads/{threadId}` 访问根页面；主题帖头部提供复制主题帖链接入口。复制链接按钮统一使用链条语义文案，避免与复制正文混淆。

## 4. API 响应快照

### GET /threads/:id → ThreadDetail

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "id": "cms7rnyij000z7qdyg6zbge8e",
    "title": "快照测试帖",
    "ownerId": "cms7kpgnb00067q6lg4u0tyuu",
    "category": "RPG",
    "status": "RECRUITING",
    "visibility": "PUBLIC",
    "published": false,
    "publishedAt": null,
    "pinned": false,
    "pinnedAt": null,
    "viewCount": 0,
    "version": 1,
    "likeCount": 0,
    "isLiked": false,
    "defaultSubthreadId": "cms7rnyin00137qdyzq0v3mw1",
    "createdAt": "2026-07-30T17:07:26.204Z",
    "updatedAt": "2026-07-30T17:07:26.215Z",
    "deletedAt": null,
    "owner": { "id": "cms7kpgnb00067q6lg4u0tyuu", "username": "testthread2", "avatar": null },
    "subthreads": [
      {
        "id": "cms7rnyin00137qdyzq0v3mw1",
        "threadId": "cms7rnyij000z7qdyg6zbge8e",
        "title": "快照测试帖",
        "sortOrder": 0,
        "postingPolicy": "PARTICIPANTS",
        "version": 1,
        "lastPostAt": null,
        "deletedAt": null,
        "createdAt": "2026-07-30T17:07:26.207Z",
        "_count": { "posts": 0 },
        "tags": [],
        "bodyPost": { "id": "cms7rnyip00157qdyxd17ozbg", "content": "这是一段正文内容（快照验证）", "version": 1 }
      }
    ],
    "topicTags": [
      { "id": "...", "threadId": "...", "tagId": "...", "tag": { "id": "...", "name": "测试", "color": null, "createdAt": "..." } }
    ],
    "_count": { "members": 1, "players": 1, "posts": 0 }
  }
}
```

### GET /subthreads/:subthreadId/posts?limit=5 → FloorList

```json
{
  "code": 0,
  "message": "ok",
  "data": [
    {
      "id": "cms7pq32u00cy7q6l84j84hjj",
      "threadId": "cms7plneh00cq7q6lrmlwwpad",
      "subthreadId": "cms7plnem00cu7q6lpbmq2b1o",
      "authorId": "cms7gly7n00017q6lbkla7ojh",
      "floorNumber": 1,
      "parentPostId": null,
      "replyToPostId": null,
      "content": "正文内容...",
      "version": 1,
      "createdAt": "2026-07-30T16:13:06.198Z",
      "updatedAt": "2026-07-30T16:13:06.198Z",
      "deletedAt": null,
      "author": { "id": "cms7gly7n00017q6lbkla7ojh", "username": "morenk", "avatar": null },
      "_count": { "replies": 0 },
      "replies": []
    }
  ],
  "meta": { "cursor": "cms7pq32u00cy7q6l84j84hjj", "hasMore": false }
}
```

### POST /subthreads/:subthreadId/posts → Created Post

```json
{
  "id": "cms7rnyld001a7qdyojgawj99",
  "threadId": "cms7rnyhi000t7qdy4m53nt03",
  "subthreadId": "cms7rnyho000x7qdyqsooa5lc",
  "authorId": "cms7kpgnb00067q6lg4u0tyuu",
  "floorNumber": 1,
  "parentPostId": null,
  "replyToPostId": null,
  "content": "后来补的首楼",
  "version": 1,
  "createdAt": "2026-07-30T17:07:26.306Z",
  "updatedAt": "2026-07-30T17:07:26.306Z",
  "deletedAt": null,
  "author": { "id": "cms7kpgnb00067q6lg4u0tyuu", "username": "testthread2", "avatar": null }
}
```

### GET /posts/:id/replies?limit=5 → ReplyList

```json
{
  "code": 0,
  "message": "ok",
  "data": [
    {
      "id": "cms7rnyld001a7qdyojgawj99",
      "threadId": "cms7rnyhi000t7qdy4m53nt03",
      "subthreadId": "cms7rnyho000x7qdyqsooa5lc",
      "authorId": "cms7kpgnb00067q6lg4u0tyuu",
      "floorNumber": null,
      "parentPostId": "cms7pq32u00cy7q6l84j84hjj",
      "replyToPostId": "cms7rnyld001a7qdyojgawj98",
      "replyTo": {
        "id": "cms7rnyld001a7qdyojgawj98",
        "authorId": "cms7gly7n00017q6lbkla7ojh",
        "author": { "id": "cms7gly7n00017q6lbkla7ojh", "username": "morenk", "avatar": null }
      },
      "content": "回复 @morenk 的内容",
      "version": 1,
      "createdAt": "2026-07-30T17:07:26.306Z",
      "updatedAt": "2026-07-30T17:07:26.306Z",
      "deletedAt": null,
      "author": { "id": "cms7kpgnb00067q6lg4u0tyuu", "username": "testthread2", "avatar": null }
    }
  ],
  "meta": { "cursor": "cms7rnyld001a7qdyojgawj99", "hasMore": false }
}
```

> **replyTo 字段**：后端 `GET /posts/:id/replies` 与 `GET /subthreads/:id/posts` 内嵌回复均带 `replyToPost` 关联（含目标回复 `author`），前端 `PostData.replyToPost` 据此渲染「回复 @xxx」上下文。旧快照（无 replyToPost）已过时，需重新抓取。

### POST /threads/:id/like → ThreadDetail (partial)

```json
{
  "id": "cms7rnyij000z7qdyg6zbge8e",
  "title": "快照测试帖",
  "likeCount": 1,
  ...
}
```

## 5. 状态管理

| 状态 | 来源 | 管理方式 |
|------|------|----------|
| 主题帖详情 | `GET /threads/:id` | TanStack Query `useQuery` |
| 楼层列表 | `GET /subthreads/:subthreadId/posts` | TanStack Query `useInfiniteQuery` |
| 当前选中子贴 | 用户点击 Tab | useState（默认 defaultSubthreadId） |
| 当前编辑会话 | 用户点击发表/回复/编辑 | `ThreadComposerProvider`（全页唯一 session + content + pending） |
| 点赞状态 | `GET /threads/:id` 的 `isLiked` + `POST/DELETE /threads/:id/like` | useMutation + query invalidation；`likeCount` 仅用于展示总数 |

## 6. 组件清单

| 组件 | 路径 | 说明 |
|------|------|------|
| ThreadDetailPage | `src/app/threads/[id]/page.tsx` | 详情页主逻辑（含管理面板切换） |
| ThreadDetailHeader | `src/components/thread/thread-detail-header.tsx` | 页面顶层独立标题区（非卡片）：徽章/主题帖标题/作者/标签/操作按钮；OWNER 可删除主题帖 |
| SubthreadTabs | `src/components/thread/subthread-tabs.tsx` | 子贴 Tab 切换导航 |
| SubthreadBody | `src/components/thread/subthread-body.tsx` | 子贴卡（唯一卡片）：子贴标题 + 默认徽章 + 正文（kind=BODY）同容器（正文不进入楼层列表） |
| FloorCard | `src/components/thread/floor-card.tsx` | 单条楼层卡片（Markdown 渲染；作者头像；作者本人可编辑/删除；回复数与回复入口跳转独立楼中楼页） |
| FloorList | `src/components/thread/floor-list.tsx` | 楼层列表（仅 kind=FLOOR，无限滚动，cursor 分页） |
| ThreadComposerProvider | `src/components/thread/thread-composer-context.tsx` | 全页唯一编辑会话；统一处理目标切换、脏内容确认和提交锁 |
| ThreadComposer | `src/components/thread/thread-composer.tsx` | 按当前会话创建楼层、回复或编辑帖子；唯一挂载 MilkdownEditor |
| ThreadComposerOutlet | `src/components/thread/thread-composer.tsx` | 放置在楼层/回复上下文中的轻量插槽，仅活动目标渲染编辑器 |
| FloorForm | `src/components/thread/floor-form.tsx` | 新楼层轻量入口；点击后才在底部展开唯一编辑器 |
| ReplyDiscussion | `src/components/thread/reply-discussion.tsx` | 独立楼中楼阅读主体：原楼层作为讨论正文、导航回原楼层、回复列表与底部回复输入框 |
| ReplyForm | `src/components/thread/reply-form.tsx` | 楼中楼底部回复入口：登录用户按需打开统一编辑器，未登录显示登录提示 |
| ReplyList | `src/components/thread/reply-list.tsx` | 楼中楼连续楼层列表（无限加载；作者本人可编辑/删除；每条回复可对用户回复，显示「回复 @xxx」上下文） |
| MemberManager | `src/components/thread/member-manager.tsx` | 成员候选池管理：授予/收回玩家、授予/移除协作者身份 |
| ManagementPanel | `src/components/thread/management-panel.tsx` | 帖主管理面板：左子贴目录树 + 右单例编辑器 |
| SubthreadTree | `src/components/thread/subthread-tree.tsx` | 管理面板左栏子贴目录树（@dnd-kit 拖拽排序） |
| SubthreadForm | `src/components/forms/subthread-form.tsx` | 子贴创建/编辑弹窗（title + postingPolicy + Zod 校验） |
| useFloors | `src/api/hooks/use-floors.ts` | 楼层列表 hook |
| useLikeThread | `src/api/hooks/use-like-thread.ts` | 点赞/取消点赞 hook |
| useCreateSubthread | `src/api/hooks/use-create-subthread.ts` | 管理面板：添加子贴 |
| useUpdateSubthread | `src/api/hooks/use-update-subthread.ts` | 管理面板：编辑子贴 |
| useDeleteSubthread | `src/api/hooks/use-delete-subthread.ts` | 管理面板：删除子贴 |
| useReorderSubthreads | `src/api/hooks/use-reorder-subthreads.ts` | 管理面板：拖拽排序 |
| useUpsertBody | `src/api/hooks/use-upsert-body.ts` | 管理面板：写入子贴正文（upsert：无正文创建、有正文乐观锁更新） |
| useCreatePost | `src/api/hooks/use-create-post.ts` | 楼层回复发布（FloorForm） |
| useUpdatePost | `src/api/hooks/use-update-post.ts` | 编辑楼层正文（乐观锁 version） |
| useDeletePost | `src/api/hooks/use-delete-post.ts` | 删除楼层（作者本人；楼层均可删，子贴正文 kind=BODY 由后端拦截） |
| useSyncThreadTags | `src/api/hooks/use-sync-thread-tags.ts` | 编辑帖时同步主题帖标签（diff 后添加/移除） |
| useReplies | `src/api/hooks/use-replies.ts` | 楼中楼回复列表（cursor 分页） |
| useMembers | `src/api/hooks/use-members.ts` | 参与人列表 |
| useUpdateMember | `src/api/hooks/use-update-member.ts` | 改参与人角色/玩家标记 |
| useSubscriptions | `src/api/hooks/use-subscriptions.ts` | 我的订阅列表 |

> 楼层卡片会直接展示 API 返回的前 5 条楼中楼回复；这些回复正文合计超过 500 个字符时，内联区域截断并使用渐变遮罩，点击「展开回复」进入独立楼中楼页面。超过 5 条时仍只展示前 5 条，并通过回复数链接查看完整串。
| useSubscriptionMutations | `src/api/hooks/use-subscription-mutations.ts` | 创建/取消订阅 |
| useReadingProgress | `src/api/hooks/use-reading-progress.ts` | 记录阅读进度 + 新回复数 |
| ThreadEditForm | `src/components/forms/thread-edit-form.tsx` | 已发布帖编辑表单（标题/分区/可见性/标签/正文） |
| EditThreadPage | `src/app/threads/[id]/edit/page.tsx` | 加载详情 + OWNER 守卫；按 `published` 分流草稿发布表单与已发布帖修改表单 |

## 6.1 帖主管理面板

帖主/协作者在头部看到「管理」按钮，点击进入**全页覆盖式管理面板**（左子贴目录树 + 右单例编辑器，VSCode 风格），「返回浏览」切回正常浏览。

```
┌─ 管理帖子 ──────────────────────────────────────────┐
│ [← 返回浏览]  管理：{帖子标题}                       │
├─ 子贴目录 (260px) ─┬─ 编辑区 ──────────────────────┤
│ ☰ 主帖 ···  │ 正在编辑：主帖                 │
│ ☰ 设定区     ···  │ [MilkdownEditor]               │
│ ☰ 剧情区     ···  │                                │
│ [+ 添加子贴]       │ 字数: 0/10000                  │
│                   │            [取消] [保存修改]     │
└───────────────────┴────────────────────────────────┘
```

- 左栏：子贴目录树，节点可**拖拽排序**（`@dnd-kit`，触发 `useReorderSubthreads`）；「编辑」「删除」通过 `SubthreadForm` 弹窗 / confirm
- 右栏：单例 MilkdownEditor，点击左栏子贴切换编辑目标（`key` 重挂载回填正文），保存调用 `PUT /subthreads/:id/body`（`useUpsertBody`，upsert：无正文创建、有正文乐观锁更新，不再区分 createPost/updatePost）。每个子贴（含剧情区/设定区/管理面板新建的非默认子贴）均有独立的 kind=BODY 正文，重进面板或切换子贴时均能通过 `bodyPost` 正确回填已有正文
- 只做**子贴级管理**（增删改排 + 正文），不做楼层级管理（参与者回帖后难以管理单个楼层）
- 默认子贴（**主帖**）不可删除、必须保持 sortOrder=0（排序时始终第一位）：前端在**操作层拦截**——主帖节点禁用拖拽，且自定义碰撞检测（`excludeDroppable`）把主帖从落点候选中剔除，拖其他子贴到主帖区域会吸附到主帖下方首个槽位，不会出现"不能交换"提示；后端仍兜底校验（`ids[0]` 必须为主帖）
- 子贴较多时：`SubthreadTabs` 为横向滚动条 + 溢出左右箭头 + 选中 Tab 自动滚入视野，支持几十个子贴

## 7. 发布楼层流程

创建楼层和楼中楼请求携带 UUID `clientRequestId`。Composer 以子贴、正文和回复目标生成请求指纹：相同指纹在网络失败后的人工重试复用同一 UUID；正文或目标变化时生成新 UUID。后端按用户和请求 ID 唯一，确保 Web/Flutter 的超时重试不会生成重复楼层。

> **一楼渲染规则：** 每个子贴的正文（`subthread.bodyPost`，kind=BODY）为该子贴的「正文」，由 `SubthreadBody` 与子贴标题放在同一卡片容器中渲染（Markdown），**不进入楼层列表**，`floorNumber = null` **不占楼层号**。`FloorList` 展示的为楼层（kind=FLOOR），楼层号从 #1 开始显示。楼层接口已只返回楼层（不含正文），前端无需再按 `bodyPostId` 过滤。`bodyPost` 对任意子贴均可用：每个子贴（含非默认子贴）的正文通过 `PUT /subthreads/:id/body` upsert。

> **子贴正文 vs 回复串：** 子贴正文（kind=BODY）与楼层/回复串（kind=FLOOR）定位不同——正文由子贴生命周期管理（管理面板 upsert，删除帖子接口对 BODY 返回 403 拦截），**楼层列表中的楼层（含 #1）作者均可删除/编辑**，不存在「首楼禁删」。

**页面布局：** 主题帖标题区为页面顶层独立标题区（非卡片，`ThreadDetailHeader`，含徽章/标题/作者/标签/操作按钮）→ 子贴 Tab → 子贴卡（`SubthreadBody`：子贴标题 + 正文同卡）→ 楼层列表 → 轻量发布入口。

```
用户点击 FloorForm 的「发表回复」入口
  → 按需挂载全页唯一 MilkdownEditor（支持 Markdown + 图片上传）
  → 未登录：跳转 /login
  → 已登录：调用 POST /subthreads/:id/posts { content }（发帖自动成为参与人=候选池）
    → 成功：关闭编辑会话 + invalidation 刷新楼层列表
    → 失败：按错误码提示（40302 协作者 / 40303 玩家，或后端 message）
```

> **唯一编辑会话：** `create-floor`、`reply`、`edit` 使用同一份判别联合状态。点击新目标时，当前内容为空或未修改则直接切换；存在未提交修改时先确认是否放弃；提交或图片上传期间禁止切换。保存成功后关闭会话。浏览态和未登录态均不挂载 Milkdown。

> **楼层编辑**：作者点击 FloorCard 的编辑按钮后，唯一编辑器在正文位置回填 `floor.content`，保存调用 `useUpdatePost`（乐观锁 version）。原正文仅在该楼层为当前编辑目标时隐藏。

> **楼中楼独立阅读**：详情页不再原地展开长回复串。点击回复数或“回复”进入独立页面；页面顶部保留主题帖/子贴/原楼层上下文，原楼层在视觉上作为讨论正文，回复按普通楼层密度连续排列。存储语义不变，创建仍传 `parentPostId=主楼层 id`、`replyToPostId=目标 id`；编辑、删除和无限分页复用原有 hooks。

> **编辑器图片上传状态**：楼层/楼中楼按需编辑器上传图片时仅锁定提交和取消按钮，编辑器本身保持可编辑，避免 Crepe 在只读切换中重建并丢失顶栏。E2E 分别覆盖创建页和独立楼中楼编辑器上传完成后的工具栏可见性。

## 8. 错误处理

| 错误码 | 场景 | UI 行为 |
|--------|------|---------|
| 404 | 主题帖不存在 / 未发布 / PRIVATE 帖非成员 | 显示 "主题帖不存在或已被删除" |
| 40100 | 未登录发帖/点赞 | 自动跳转 /login（apiClient 拦截器） |
| 40302 | 该子贴仅限协作者发帖 | toast "该子贴仅限协作者发帖" |
| 40303 | 该子贴仅限玩家发帖 | toast "该子贴仅限玩家发帖" |
| 40301 | 非 OWNER 删除主题帖 | toast 后端 message |
| 40000 | 字段校验失败 | toast 后端 message |
| 42900 | 限流 | toast "操作太频繁，请稍后再试" |
| 网络错误 | fetch 失败 | 显示错误提示 + 重试按钮 |
| 40900 | clientRequestId 被不同载荷复用 | toast 后端冲突提示，不清空编辑器 |

## 9. 权限与访问控制

| 场景 | 处理 |
|------|------|
| 公开帖 | 所有用户可查看 |
| 私密帖 + 非成员 | 后端返回 404（设计决策：避免枚举私密帖） |
| 未登录发帖 | apiClient 拦截器自动跳转 /login |
| 发帖 | 登录即可发帖，发帖自动入候选池；子贴发帖策略（协作者/玩家）由后端拦截并映射错误码 |
| 已发布帖 OWNER | 显示 "编辑" 按钮（跳 `/threads/[id]/edit`，编辑表单 ThreadEditForm） |
| 未发布草稿 OWNER | 从草稿列表进入 `/threads/[id]/edit` 后显示 ThreadCreateForm，可保存草稿或最终发布 |
| OWNER 删除 | 显示 "删除" 按钮；确认后调用 `DELETE /threads/:id`，成功返回首页 |

## 10. 验收标准

- [x] 详情页正确展示帖子头部信息
- [x] 头部分类/状态/标签徽章正确映射为中文
- [x] 子贴 Tab 可切换，选中 Tab 高亮
- [x] 子贴标题与正文（kind=BODY）同容器渲染（SubthreadBody），正文不进入楼层列表
- [x] 主题帖标题区独立置顶（非卡片，ThreadDetailHeader），子贴标题取代原卡片内标题位置
- [x] OWNER 可删除主题帖：已发布帖软删除，草稿硬删除，成功后返回首页
- [x] 楼层列表按 floorNumber 排序，分页加载（楼层从 #1 开始）
- [x] 楼层卡片正确渲染 Markdown 内容
- [x] 未登录用户可浏览公开帖，不能发帖
- [x] 登录即可发帖（无加入/退出按钮，发帖自动入玩家候选池）
- [x] 发布新楼层
- [x] 浏览态不挂载 Milkdown，点击发表/回复/编辑后才出现编辑器
- [x] 详情页任意时刻最多存在一个 MilkdownEditor
- [x] 楼层与楼中楼的创建、回复、编辑统一使用 MilkdownEditor
- [x] 切换目标时保护未提交内容，提交期间禁止切换
- [x] 点赞/取消点赞实时更新 likeCount
- [x] 不同用户分别按 `isLiked` 正确展示和切换点赞状态
- [x] thread 不存在时显示 404
- [x] 所有错误状态有 toast 或内联提示
- [x] 帖主看到「管理」按钮（非帖主不显示）
- [x] 管理面板：左子贴目录树 + 右单例编辑器（返回浏览可切回）
- [x] 管理面板：添加/编辑/删除子贴（SubthreadForm 弹窗）
- [x] 管理面板：子贴拖拽排序（@dnd-kit + useReorderSubthreads）
- [x] 管理面板：编辑子贴正文（保存调用 PUT /subthreads/:id/body upsert，不再区分 createPost/updatePost）
- [x] 默认子贴不可删除、排序保持首位
- [x] 主帖徽章文案「主帖」；主帖节点不可拖拽，拖到主帖位置时前端拦截并 toast 友好提示
- [x] SubthreadTabs 支持几十个子贴：横向滚动 + 溢出箭头 + 选中自动滚入视野
- [x] 消息/站内链接定位取消移动动画，仅高亮目标楼层或楼中楼回复卡片
- [x] 移除加入/退出按钮，登录即可发帖（发帖自动入玩家候选池，无感参与）
- [x] 元数据人数显示 `_count.players`（被授予玩家身份者），非候选池总数
- [x] `pnpm lint && pnpm typecheck && pnpm build` 通过
- [x] 创建楼层/楼中楼提交稳定 clientRequestId
- [x] 相同内容网络重试复用 UUID，修改内容后使用新 UUID

## 11. 子任务

- [x] 编写模块设计文档 `docs/modules/thread-detail.md`
- [x] 补齐 ThreadDetail / SubthreadDetail / PostData 类型
- [x] 实现 `useFloors` hook（楼层列表 cursor 分页）
- [x] 实现 `useLikeThread` hook（点赞/取消点赞）
- [x] 实现 `useCreateSubthread` / `useUpdateSubthread` / `useDeleteSubthread` / `useReorderSubthreads` hooks
- [x] 实现 `ThreadDetailHeader` 组件（含「管理」按钮）
- [x] 实现 `SubthreadTabs` 组件
- [x] 实现 `FloorCard` / `FloorList` / `FloorForm` 组件
- [x] 实现 `SubthreadBody`（子贴标题 + 正文同容器），正文不进入楼层列表、楼层从 #1 开始
- [x] 移除 `useMemberActions` hook（加入/退出），FloorForm 登录即可发帖并映射 40302/40303 错误码
- [x] 元数据玩家数改用 `_count.players`（ThreadDetailHeader / ThreadCard）
- [x] 主帖排序拦截：`computeReorderedIds` 纯函数 + 主帖禁用拖拽 + 友好 toast
- [x] 实现 `SubthreadTree`（@dnd-kit 拖拽排序）与 `ManagementPanel`（左树右编辑）
- [x] 实现 `/threads/[id]` 页面（含管理面板切换）
- [x] 创建页移除沙盒多子贴/楼层管理，子贴管理移至详情页管理面板
- [x] 后端读端点 `@Public()` → `@OptionalAuth()` 修复（草稿帖楼层/子贴可查询）
- [x] lint / typecheck / build 通过
- [x] E2E：管理面板全流程（进入→增删改→正文编辑→排序→返回）+ 拖拽排序验证
- [x] 主题帖删除：详情头部 OWNER 入口、确认/取消、成功跳转与错误提示
- [x] 编辑页按发布状态分流：未发布草稿保留发布入口，已发布帖仅保存修改
- [x] 单编辑器切片 1：会话控制器测试、实现与文档
- [x] 单编辑器切片 2：统一 Composer、详情页集成、组件测试与文档
- [x] 单编辑器切片 3：创建请求幂等 UUID 与重试指纹

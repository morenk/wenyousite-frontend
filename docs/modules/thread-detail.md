# 主题帖详情与楼层模块

## 1. 目标与范围

实现主题帖详情页，展示帖子头部信息、子贴 Tab 切换、楼层列表（分页）、Markdown 渲染，以及发布新楼层。

**本次迭代范围（Phase 5 MVP）：**
- 主题帖详情页 `/threads/[id]`
- 详情头部（标题/分类/状态/作者/时间/操作按钮）
- 子贴 Tab 切换
- 楼层列表（cursor 分页 + 滚动加载）
- 楼层 Markdown 渲染（react-markdown + remark-gfm）
- 发布新楼层（简易 textarea）
- 点赞/取消点赞主题帖
- Loading / Error / Empty / 404 状态

**后续迭代：**
- 楼中楼回复（parentPostId / replyToPostId）
- 楼层编辑与删除
- 玩家管理（楼主在候选池中授予/收回玩家身份）
- 阅读进度
- 订阅通知

## 2. 页面与路由

| 路由 | 页面说明 | 权限 |
|------|----------|------|
| `/threads/[id]` | 主题帖详情页（含子贴、楼层） | 公开（PRIVATE 帖非成员返回 404） |

## 3. 涉及 API

| Method | Path | Guard | 用途 |
|--------|------|-------|------|
| GET | `/threads/:id` | Public | 主题帖详情（含子贴列表、owner、_count） |
| GET | `/subthreads/:subthreadId/posts` | Public | 楼层列表（cursor 分页，含内联 replies） |
| POST | `/subthreads/:subthreadId/posts` | Auth | 发布新楼层（发帖自动成为参与人=玩家候选池） |
| POST | `/threads/:id/like` | Auth | 点赞主题帖（幂等） |
| DELETE | `/threads/:id/like` | Auth | 取消点赞 |

> **「参与」语义**：用户**无需手动加入**，在帖子内回复后由后端自动写入参与人记录（玩家候选池），对用户无感。前端不再提供加入/退出按钮。元数据显示的 `_count.players` 为被楼主授予玩家身份（`playerMarked=true`）的人数。

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
        "bodyPostId": "cms7rnyip00157qdyxd17ozbg",
        "deletedAt": null,
        "createdAt": "2026-07-30T17:07:26.207Z",
        "_count": { "posts": 1 },
        "tags": [],
        "bodyPost": { "id": "cms7rnyip00157qdyxd17ozbg", "content": "这是一段正文内容（快照验证）", "version": 1 }
      }
    ],
    "topicTags": [
      { "id": "...", "threadId": "...", "tagId": "...", "tag": { "id": "...", "name": "测试", "color": null, "createdAt": "..." } }
    ],
    "_count": { "members": 1, "players": 1, "posts": 1 }
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
| 新楼层内容 | 用户输入 | useState |
| 点赞状态 | `POST/DELETE /threads/:id/like` | useMutation + query invalidation |

## 6. 组件清单

| 组件 | 路径 | 说明 |
|------|------|------|
| ThreadDetailPage | `src/app/threads/[id]/page.tsx` | 详情页主逻辑（含管理面板切换） |
| ThreadDetailHeader | `src/components/thread/thread-detail-header.tsx` | 页面顶层独立标题区（非卡片）：徽章/主题帖标题/作者/标签/操作按钮 |
| SubthreadTabs | `src/components/thread/subthread-tabs.tsx` | 子贴 Tab 切换导航 |
| SubthreadBody | `src/components/thread/subthread-body.tsx` | 子贴卡（唯一卡片）：子贴标题 + 默认徽章 + 一楼正文同容器（首楼不进入回复楼层列表） |
| FloorCard | `src/components/thread/floor-card.tsx` | 单条楼层卡片（Markdown 渲染） |
| FloorList | `src/components/thread/floor-list.tsx` | 回复楼层列表（无限滚动，cursor 分页） |
| FloorForm | `src/components/thread/floor-form.tsx` | 新楼层发布表单 |
| ManagementPanel | `src/components/thread/management-panel.tsx` | 帖主管理面板：左子贴目录树 + 右单例编辑器 |
| SubthreadTree | `src/components/thread/subthread-tree.tsx` | 管理面板左栏子贴目录树（@dnd-kit 拖拽排序） |
| SubthreadForm | `src/components/forms/subthread-form.tsx` | 子贴创建/编辑弹窗（title + postingPolicy + Zod 校验） |
| useFloors | `src/api/hooks/use-floors.ts` | 楼层列表 hook |
| useLikeThread | `src/api/hooks/use-like-thread.ts` | 点赞/取消点赞 hook |
| useCreateSubthread | `src/api/hooks/use-create-subthread.ts` | 管理面板：添加子贴 |
| useUpdateSubthread | `src/api/hooks/use-update-subthread.ts` | 管理面板：编辑子贴 |
| useDeleteSubthread | `src/api/hooks/use-delete-subthread.ts` | 管理面板：删除子贴 |
| useReorderSubthreads | `src/api/hooks/use-reorder-subthreads.ts` | 管理面板：拖拽排序 |
| useCreatePost / useUpdatePost | `src/api/hooks/use-create-post.ts` 等 | 管理面板：编辑子贴正文 |

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
- 右栏：单例 MilkdownEditor，点击左栏子贴切换编辑目标（`key` 重挂载回填正文），保存调用 `createPost`（无首楼）或 `updatePost`（有首楼）
- 只做**子贴级管理**（增删改排 + 正文），不做楼层级管理（参与者回帖后难以管理单个楼层）
- 默认子贴（**主帖**）不可删除、必须保持 sortOrder=0（排序时始终第一位）：前端在**操作层拦截**——主帖节点禁用拖拽，且自定义碰撞检测（`excludeDroppable`）把主帖从落点候选中剔除，拖其他子贴到主帖区域会吸附到主帖下方首个槽位，不会出现"不能交换"提示；后端仍兜底校验（`ids[0]` 必须为主帖）
- 子贴较多时：`SubthreadTabs` 为横向滚动条 + 溢出左右箭头 + 选中 Tab 自动滚入视野，支持几十个子贴

## 7. 发布楼层流程

> **一楼渲染规则：** 每个子贴的一楼（`subthread.bodyPost`）为该子贴的「正文」，由 `SubthreadBody` 与子贴标题放在同一卡片容器中渲染（Markdown），**不进入回复楼层列表**。`FloorList` 展示的为回复楼层（通过 `bodyPostId` 过滤首楼），楼层号保留真实编号（回复从 #2 开始显示）。

**页面布局：** 主题帖标题区为页面顶层独立标题区（非卡片，`ThreadDetailHeader`，含徽章/标题/作者/标签/操作按钮）→ 子贴 Tab → 子贴卡（`SubthreadBody`：子贴标题 + 一楼正文同卡）→ 回复楼层列表 → 发布表单。

```
用户在 FloorForm 输入内容
  → 未登录：跳转 /login
  → 已登录：调用 POST /subthreads/:id/posts { content }（发帖自动成为参与人=候选池）
    → 成功：清空输入框 + invalidation 刷新楼层列表
    → 失败：按错误码提示（40302 协作者 / 40303 玩家，或后端 message）
```

## 8. 错误处理

| 错误码 | 场景 | UI 行为 |
|--------|------|---------|
| 404 | 主题帖不存在 / 未发布 / PRIVATE 帖非成员 | 显示 "主题帖不存在或已被删除" |
| 40100 | 未登录发帖/点赞 | 自动跳转 /login（apiClient 拦截器） |
| 40302 | 该子贴仅限协作者发帖 | toast "该子贴仅限协作者发帖" |
| 40303 | 该子贴仅限玩家发帖 | toast "该子贴仅限玩家发帖" |
| 40000 | 字段校验失败 | toast 后端 message |
| 42900 | 限流 | toast "操作太频繁，请稍后再试" |
| 网络错误 | fetch 失败 | 显示错误提示 + 重试按钮 |

## 9. 权限与访问控制

| 场景 | 处理 |
|------|------|
| 公开帖 | 所有用户可查看 |
| 私密帖 + 非成员 | 后端返回 404（设计决策：避免枚举私密帖） |
| 未登录发帖 | apiClient 拦截器自动跳转 /login |
| 发帖 | 登录即可发帖，发帖自动入候选池；子贴发帖策略（协作者/玩家）由后端拦截并映射错误码 |
| 已发布帖 OWNER | 显示 "编辑" 按钮（跳 /threads/[id]/edit，后续实现） |

## 10. 验收标准

- [x] 详情页正确展示帖子头部信息
- [x] 头部分类/状态/标签徽章正确映射为中文
- [x] 子贴 Tab 可切换，选中 Tab 高亮
- [x] 子贴标题与一楼正文同容器渲染（SubthreadBody），首楼不进入回复楼层列表
- [x] 主题帖标题区独立置顶（非卡片，ThreadDetailHeader），子贴标题取代原卡片内标题位置
- [x] 回复楼层列表按 floorNumber 排序，分页加载（回复从 #2 开始）
- [x] 楼层卡片正确渲染 Markdown 内容
- [x] 未登录用户可浏览公开帖，不能发帖
- [x] 登录即可发帖（无加入/退出按钮，发帖自动入玩家候选池）
- [x] 发布新楼层
- [x] 点赞/取消点赞实时更新 likeCount
- [x] thread 不存在时显示 404
- [x] 所有错误状态有 toast 或内联提示
- [x] 帖主看到「管理」按钮（非帖主不显示）
- [x] 管理面板：左子贴目录树 + 右单例编辑器（返回浏览可切回）
- [x] 管理面板：添加/编辑/删除子贴（SubthreadForm 弹窗）
- [x] 管理面板：子贴拖拽排序（@dnd-kit + useReorderSubthreads）
- [x] 管理面板：编辑子贴正文（保存调用 createPost/updatePost）
- [x] 默认子贴不可删除、排序保持首位
- [x] 主帖徽章文案「主帖」；主帖节点不可拖拽，拖到主帖位置时前端拦截并 toast 友好提示
- [x] SubthreadTabs 支持几十个子贴：横向滚动 + 溢出箭头 + 选中自动滚入视野
- [x] 移除加入/退出按钮，登录即可发帖（发帖自动入玩家候选池，无感参与）
- [x] 元数据人数显示 `_count.players`（被授予玩家身份者），非候选池总数
- [x] `pnpm lint && pnpm typecheck && pnpm build` 通过

## 11. 子任务

- [x] 编写模块设计文档 `docs/modules/thread-detail.md`
- [x] 补齐 ThreadDetail / SubthreadDetail / PostData 类型
- [x] 实现 `useFloors` hook（楼层列表 cursor 分页）
- [x] 实现 `useLikeThread` hook（点赞/取消点赞）
- [x] 实现 `useCreateSubthread` / `useUpdateSubthread` / `useDeleteSubthread` / `useReorderSubthreads` hooks
- [x] 实现 `ThreadDetailHeader` 组件（含「管理」按钮）
- [x] 实现 `SubthreadTabs` 组件
- [x] 实现 `FloorCard` / `FloorList` / `FloorForm` 组件
- [x] 实现 `SubthreadBody`（子贴标题 + 一楼正文同容器），详情页过滤首楼、回复列表从 #2 开始
- [x] 移除 `useMemberActions` hook（加入/退出），FloorForm 登录即可发帖并映射 40302/40303 错误码
- [x] 元数据玩家数改用 `_count.players`（ThreadDetailHeader / ThreadCard）
- [x] 主帖排序拦截：`computeReorderedIds` 纯函数 + 主帖禁用拖拽 + 友好 toast
- [x] 实现 `SubthreadTree`（@dnd-kit 拖拽排序）与 `ManagementPanel`（左树右编辑）
- [x] 实现 `/threads/[id]` 页面（含管理面板切换）
- [x] 创建页移除沙盒多子贴/楼层管理，子贴管理移至详情页管理面板
- [x] 后端读端点 `@Public()` → `@OptionalAuth()` 修复（草稿帖楼层/子贴可查询）
- [x] lint / typecheck / build 通过
- [x] E2E：管理面板全流程（进入→增删改→正文编辑→排序→返回）+ 拖拽排序验证

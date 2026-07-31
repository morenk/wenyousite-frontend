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
- 加入/退出主题帖
- Loading / Error / Empty / 404 状态

**后续迭代：**
- 楼中楼回复（parentPostId / replyToPostId）
- 楼层编辑与删除
- 成员管理
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
| POST | `/subthreads/:subthreadId/posts` | Auth | 发布新楼层 |
| POST | `/threads/:id/like` | Auth | 点赞主题帖（幂等） |
| DELETE | `/threads/:id/like` | Auth | 取消点赞 |
| POST | `/threads/:threadId/members/join` | Auth | 加入主题帖 |
| DELETE | `/threads/:threadId/members/me` | Auth | 退出主题帖 |

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
    "_count": { "members": 1, "posts": 1 }
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

### POST /threads/:threadId/members/join → 201

成员记录返回 201，参与后即可发帖。

## 5. 状态管理

| 状态 | 来源 | 管理方式 |
|------|------|----------|
| 主题帖详情 | `GET /threads/:id` | TanStack Query `useQuery` |
| 楼层列表 | `GET /subthreads/:subthreadId/posts` | TanStack Query `useInfiniteQuery` |
| 当前选中子贴 | 用户点击 Tab | useState（默认 defaultSubthreadId） |
| 新楼层内容 | 用户输入 | useState |
| 点赞状态 | `POST/DELETE /threads/:id/like` | useMutation + query invalidation |
| 加入/退出 | `POST/DELETE members` | useMutation + query invalidation |

## 6. 组件清单

| 组件 | 路径 | 说明 |
|------|------|------|
| ThreadDetailPage | `src/app/threads/[id]/page.tsx` | 详情页主逻辑 |
| ThreadDetailHeader | `src/components/thread/thread-detail-header.tsx` | 帖子头部信息 + 操作按钮 |
| SubthreadTabs | `src/components/thread/subthread-tabs.tsx` | 子贴 Tab 切换导航 |
| FloorCard | `src/components/thread/floor-card.tsx` | 单条楼层卡片（Markdown 渲染） |
| FloorList | `src/components/thread/floor-list.tsx` | 楼层列表（无限滚动） |
| FloorForm | `src/components/thread/floor-form.tsx` | 新楼层发布表单 |
| useFloors | `src/api/hooks/use-floors.ts` | 楼层列表 hook |
| useLikeThread | `src/api/hooks/use-like-thread.ts` | 点赞/取消点赞 hook |
| useMemberActions | `src/api/hooks/use-member-actions.ts` | 加入/退出 hook |

## 7. 发布楼层流程

```
用户在 FloorForm 输入内容
  → 未登录：跳转 /login
  → 未加入：按钮变"加入后即可参与"
  → 已加入：调用 POST /subthreads/:id/posts { content }
    → 成功：清空输入框 + invalidation 刷新楼层列表
    → 失败：toast 后端 message
```

## 8. 错误处理

| 错误码 | 场景 | UI 行为 |
|--------|------|---------|
| 404 | 主题帖不存在 / 未发布 / PRIVATE 帖非成员 | 显示 "主题帖不存在或已被删除" |
| 40100 | 未登录发帖/点赞 | 自动跳转 /login（apiClient 拦截器） |
| 40300 | 无发帖权限（未加入） | toast "请先加入主题帖" |
| 40000 | 字段校验失败 | toast 后端 message |
| 42900 | 限流 | toast "操作太频繁，请稍后再试" |
| 网络错误 | fetch 失败 | 显示错误提示 + 重试按钮 |

## 9. 权限与访问控制

| 场景 | 处理 |
|------|------|
| 公开帖 | 所有用户可查看 |
| 私密帖 + 非成员 | 后端返回 404（设计决策：避免枚举私密帖） |
| 未登录发帖 | apiClient 拦截器自动跳转 /login |
| 未加入发帖 | FloorForm 禁用，按钮变为"加入后即可参与" |
| 已发布帖 OWNER | 显示 "编辑" 按钮（跳 /threads/[id]/edit，后续实现） |

## 10. 验收标准

- [x] 详情页正确展示帖子头部信息
- [x] 头部分类/状态/标签徽章正确映射为中文
- [x] 子贴 Tab 可切换，选中 Tab 高亮
- [x] 楼层列表按 floorNumber 排序，分页加载
- [x] 楼层卡片正确渲染 Markdown 内容
- [x] 未登录用户可浏览公开帖，不能发帖
- [x] 已登录未加入用户可浏览但发帖按钮变"加入后即可参与"
- [x] 加入后可发布新楼层
- [x] 点赞/取消点赞实时更新 likeCount
- [x] thread 不存在时显示 404
- [x] 所有错误状态有 toast 或内联提示
- [x] `pnpm lint && pnpm typecheck && pnpm build` 通过

## 11. 子任务

- [x] 编写模块设计文档 `docs/modules/thread-detail.md`
- [x] 补齐 ThreadDetail / SubthreadDetail / PostData 类型
- [x] 实现 `useFloors` hook（楼层列表 cursor 分页）
- [x] 实现 `useLikeThread` hook（点赞/取消点赞）
- [x] 实现 `useMemberActions` hook（加入/退出）
- [x] 实现 `ThreadDetailHeader` 组件
- [x] 实现 `SubthreadTabs` 组件
- [x] 实现 `FloorCard` 组件（Markdown 渲染）
- [x] 实现 `FloorList` 组件（无限滚动）
- [x] 实现 `FloorForm` 组件（简易回复框）
- [x] 实现 `/threads/[id]` 页面
- [x] lint / typecheck / build 通过

# 收藏模块

## 1. 目标与范围

实现收藏主题帖、我的收藏管理、他人收藏公开查看（尊重 `showBookmarks` 隐私）。

**本次迭代范围（Phase 8 · 收藏）：**
- 详情页收藏/取消收藏按钮（仅登录）
- `/bookmarks` 我的收藏管理页（列表 + 取消收藏，cursor 分页）
- 用户资料页「收藏」区块（read-only，尊重 showBookmarks：未公开显示占位）
- 收藏入口保留在主题帖详情页与个人资料相关区域，不在全局导航栏展示

**后续迭代：** 收藏分组、搜索收藏、下拉刷新。

## 2. 页面与路由

| 路由 | 页面说明 | 权限 |
|------|----------|------|
| `/bookmarks` | 我的收藏管理（取消收藏） | Auth（仅本人） |
| `/users/[id]`（收藏区块） | 该用户公开收藏（read-only） | 公开（OptionalAuth，showBookmarks 关闭返回 404） |

详情页操作区（点赞/订阅旁）加 `BookmarkButton`（登录显示）。

## 3. 涉及 API

| Method | Path | Guard | 用途 |
|--------|------|-------|------|
| GET | `/bookmarks?cursor=&limit=` | AuthRead | 我的收藏列表（cursor 分页，每条含 `bookmarkId`） |
| POST | `/bookmarks` | AuthRead | 收藏主题帖（Body `{ threadId }`，返回收藏记录 id） |
| DELETE | `/bookmarks/:id` | AuthRead | 取消收藏（按记录 id） |
| GET | `/users/:id/bookmarks` | OptionalAuth | 该用户公开收藏（cursor 分页，showBookmarks 关闭返回 404，私密帖非参与人过滤） |
| GET | `/threads/:id` | AuthRead | 登录态附加 `isBookmarked` + `bookmarkId`（详情页按钮状态） |

## 4. API 响应快照

真实响应见 `docs/snapshots/bookmarks.snapshot.json`。

### GET /bookmarks?limit=3 → { ...thread, bookmarkId }

```json
{
  "code": 0, "message": "ok",
  "data": [
    {
      "id": "<redacted-id>",
      "title": "管理面板测试帖",
      "category": "DEDUCTION",
      "status": "RECRUITING",
      "visibility": "PUBLIC",
      "published": true,
      "createdAt": "2026-08-01T18:25:11.069Z",
      "owner": { "id": "<redacted-id>", "username": "testuser", "avatar": null },
      "_count": { "members": 1, "posts": 3 },
      "bookmarkId": "<redacted-id>"
    }
  ],
  "meta": { "cursor": "<redacted-id>", "hasMore": false }
}
```

### POST /bookmarks / DELETE /bookmarks/:id

```json
// POST → 201
{ "code": 0, "message": "ok", "data": { "id": "cmsbh...", "userId": "...", "threadId": "...", "createdAt": "..." } }
// DELETE → 200
{ "code": 0, "message": "ok", "data": { "message": "已取消收藏" } }
```

### GET /threads/:id（登录态附加）

```json
{ "isBookmarked": true, "bookmarkId": "<redacted-id>", "...": "..." }
```

> 私密帖：非参与人收藏返回 404；`/users/:id/bookmarks` 对他人只暴露 PUBLIC + 查看者参与中的私密帖。

## 5. 状态管理

| 状态 | 来源 | 管理方式 |
|------|------|----------|
| 我的收藏 | `GET /bookmarks` | `useInfiniteQuery`（queryKey `["bookmarks"]`） |
| 他人收藏 | `GET /users/:id/bookmarks` | `useInfiniteQuery`（queryKey `["user","bookmarks",id]`，404→error 显示未公开） |
| 详情页收藏态 | `GET /threads/:id` 的 isBookmarked/bookmarkId | `useQuery`（`["thread",id]`） |
| 收藏/取消 | POST/DELETE | `useMutation`，成功后失效 `["bookmarks"]` + `["user","bookmarks"]` + `["thread",id]` |

## 6. 组件清单

| 组件 | 路径 | 说明 |
|------|------|------|
| BookmarkButton | `src/components/user/bookmark-button.tsx` | 详情页收藏/取消切换 |
| BookmarkThreadCard | `src/components/user/bookmark-thread-card.tsx` | 收藏帖卡片（分类/标题/作者/时间，可选取消按钮） |
| BookmarkList | `src/components/user/bookmark-list.tsx` | 我的收藏管理列表（无限滚动 + 取消收藏） |
| UserBookmarksSection | `src/components/user/user-bookmarks-section.tsx` | 资料页收藏区块（read-only，404=未公开） |
| useBookmarks | `src/api/hooks/use-bookmarks.ts` | 我的收藏 hook |
| useUserBookmarks | `src/api/hooks/use-user-bookmarks.ts` | 他人收藏 hook |
| useBookmarkActions | `src/api/hooks/use-bookmark-actions.ts` | 收藏/取消收藏 mutation |
| BookmarksPage | `src/app/bookmarks/page.tsx` | 我的收藏管理页 |

## 7. 交互规则

- 详情页按钮：已收藏 → 取消（按 bookmarkId DELETE）；未收藏 → 收藏（POST）
- `/bookmarks` 每条可取消收藏，取消后列表即时刷新
- 资料页收藏区块 read-only，点击跳转帖子
- 私密帖仅参与人可收藏（后端校验）

## 8. 错误处理

| 错误码 | 场景 | UI 行为 |
|--------|------|---------|
| 404 | 私密帖非参与人收藏 / 收藏不存在 / 他人未公开收藏 | toast 后端 message；资料页区块显示"该用户未公开收藏" |
| 409 | 重复收藏 | toast 后端 message |
| 40100 | 未登录收藏 | apiClient 跳 /login（页面另有登录守卫） |
| 网络错误 | 列表加载失败 | 错误态 + 重试按钮 |

## 9. 权限与访问控制

| 场景 | 处理 |
|------|------|
| 收藏/取消 | 仅登录（详情页按钮登录显示；/bookmarks 登录守卫） |
| 我的收藏 | 本人全部可见可管理 |
| 他人收藏 | `GET /users/:id/bookmarks` 强制 showBookmarks；未公开 404 → 前端占位 |
| 私密帖收藏 | 仅参与人（后端校验，非参与人 404） |

## 10. 验收标准

- [x] 详情页收藏/取消收藏按钮（登录显示，状态即时更新）
- [x] `/bookmarks` 我的收藏列表 + 取消收藏 + cursor 分页
- [x] 全局导航栏不展示收藏入口，避免占用顶栏操作位
- [x] 用户资料页「收藏」区块（read-only），未公开显示占位
- [x] 私密帖收藏权限由后端保证
- [x] `pnpm lint && pnpm typecheck && pnpm test && pnpm build` 通过

## 11. 子任务（切片）

- [x] 后端：findById 附加 isBookmarked/bookmarkId + findAll 附带 bookmarkId + 测试
- [x] 前端 hooks：useBookmarks / useUserBookmarks / useBookmarkActions + 测试
- [x] 前端组件：BookmarkButton / BookmarkThreadCard / BookmarkList / UserBookmarksSection + 测试
- [x] 页面：/bookmarks + 详情页收藏按钮 + 资料页收藏区块
- [x] 快照 + 文档 + Roadmap
- [ ] 质量检查 + 部署 + 提交推送

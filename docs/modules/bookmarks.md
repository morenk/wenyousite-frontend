# 收藏模块

## 1. 目标与范围

实现收藏主题帖和动态、两套完全独立的私有收藏夹目录、我的收藏管理、他人主题帖/动态收藏公开查看（尊重 `showBookmarks` 隐私）。

**当前能力：**
- 主题帖与动态详情首次收藏时先选择收藏夹；已收藏时直接取消
- `/bookmarks` 我的收藏管理页（主题帖/动态分栏，各自使用默认/自建收藏夹筛选、移动、取消收藏和 cursor 分页；两套目录允许同名）
- 用户资料页 `/users/[id]/bookmarks` 收藏 Tab（公开主题帖/动态分栏，不暴露收藏夹；尊重 showBookmarks）
- 登录后全局导航显示“收藏”；主题帖详情页和个人资料相关区域继续保留上下文入口

## 2. 页面与路由

| 路由 | 页面说明 | 权限 |
|------|----------|------|
| `/bookmarks` | 我的收藏管理（取消收藏） | Auth（仅本人） |
| `/users/[id]/bookmarks` | 该用户公开收藏 Tab（read-only） | 公开（OptionalAuth，showBookmarks 关闭时不发起列表请求） |

详情页操作区（点赞/订阅旁）加 `BookmarkButton`（登录显示）。

## 3. 涉及 API

| Method | Path | Guard | 用途 |
|--------|------|-------|------|
| GET | `/bookmarks?cursor=&limit=&folderId=` | AuthRead | 我的收藏列表（完整主题帖卡片 + `bookmarkId` / `bookmarkFolderId`） |
| GET | `/bookmarks/folders` | AuthRead | 获取主题帖收藏夹 |
| POST | `/bookmarks/folders` | Auth | 新建主题帖收藏夹 |
| POST | `/bookmarks` | AuthRead | 收藏主题帖；不传可选 `folderId` 时进入默认收藏夹 |
| PATCH | `/bookmarks/:id` | AuthRead | 移动到自己的其他收藏夹 |
| DELETE | `/bookmarks/:id` | AuthRead | 取消收藏（按记录 id） |
| GET | `/users/:id/bookmarks` | OptionalAuth | 该用户公开收藏（完整主题帖卡片；不返回私有收藏元数据） |
| GET | `/moments/bookmarks?folderId=` | AuthRead | 我的动态收藏（完整动态卡片 + `bookmarkFolderId`） |
| GET | `/moments/bookmark-folders` | AuthRead | 获取动态收藏夹 |
| POST | `/moments/bookmark-folders` | Auth | 新建动态收藏夹 |
| POST / DELETE | `/moments/:id/bookmark` | Auth | 收藏/取消动态；POST 可选 `folderId` |
| PATCH | `/moments/:id/bookmark` | Auth | 移动动态收藏 |
| GET | `/users/:id/moment-bookmarks` | OptionalAuth | 该用户公开的动态收藏；不返回私有收藏元数据 |
| GET | `/threads/:id` | AuthRead | 登录态附加 `isBookmarked` + `bookmarkId`（详情页按钮状态） |

## 4. 响应结构

响应结构以固定 OpenAPI 和 `src/api/types.ts` 的生成类型为事实源。

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
      "pinned": false,
      "tipTotal": "0",
      "createdAt": "2026-08-01T18:25:11.069Z",
      "updatedAt": "2026-08-01T18:25:11.069Z",
      "deletedAt": null,
      "owner": { "id": "<redacted-id>", "username": "testuser", "avatar": null, "level": 1 },
      "defaultSubthread": { "id": "<redacted-id>", "title": "主贴", "lastPostAt": null },
      "topicTags": [],
      "_count": { "members": 1, "players": 1, "posts": 3 },
      "preview": "主题帖正文摘要",
      "coverImages": [],
      "bookmarkId": "<redacted-id>",
      "bookmarkFolderId": "<redacted-id>"
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

> 合同 `5.1.0-dev.20260817.1` 起，收藏与首页、搜索、个人创建/参与列表共用 `ThreadListItemResponseDto` 基础字段；我的收藏只在基础卡片上叠加管理 ID。

## 5. 状态管理

| 状态 | 来源 | 管理方式 |
|------|------|----------|
| 我的收藏 | `GET /bookmarks` | 按 folderId 分 key 的 `useInfiniteQuery` |
| 主题帖收藏夹 | `GET /bookmarks/folders` | 独立 Query Key；新建/移动后只失效主题帖目录计数与列表 |
| 动态收藏夹 | `GET /moments/bookmark-folders` | 独立 Query Key；新建/移动后只失效动态目录计数与列表 |
| 他人收藏 | `GET /users/:id/bookmarks` | `useInfiniteQuery`（`queryKeys.users.bookmarks(id)`，404→error 显示未公开） |
| 他人动态收藏 | `GET /users/:id/moment-bookmarks` | 独立 `useInfiniteQuery`；不读取本人分类信息 |
| 详情页收藏态 | `GET /threads/:id` 的 isBookmarked/bookmarkId | `useQuery`（`queryKeys.threads.detail(id)`） |
| 收藏/取消 | POST/DELETE | 领域 mutation hook 统一更新详情并失效收藏列表 |

## 6. 组件清单

| 组件 | 路径 | 说明 |
|------|------|------|
| BookmarkButton | `src/components/user/bookmark-button.tsx` | 详情页收藏/取消切换 |
| BookmarkFolderPickerDialog | `src/components/user/bookmark-folder-picker-dialog.tsx` | 选择现有分类或就地新建后确认收藏 |
| BookmarkFolderBar | `src/components/user/bookmark-folder-bar.tsx` | 当前内容类型的分类筛选、数量与新建入口 |
| CreateBookmarkFolderButton | `src/components/user/create-bookmark-folder-button.tsx` | RHF + Zod 新建弹窗；按当前内容类型调用独立端点 |
| BookmarkThreadCard | `src/components/user/bookmark-thread-card.tsx` | 收藏帖卡片（分类/标题/作者/时间/移动/取消） |
| BookmarkList | `src/components/user/bookmark-list.tsx` | 我的收藏管理列表（分类分页 + 移动 + 取消） |
| UserBookmarksSection | `src/components/user/user-bookmarks-section.tsx` | 资料页收藏 Tab 复用首页主题帖列表卡片，保持只读（404=未公开） |
| UserBookmarksPage | `src/components/user/user-bookmarks-page.tsx` | 收藏 Tab 页面与权限门；无权限时不挂载列表查询 |
| useBookmarks | `src/api/hooks/use-bookmarks.ts` | 我的收藏 hook |
| useUserBookmarks | `src/api/hooks/use-user-bookmarks.ts` | 他人收藏 hook |
| useBookmarkActions | `src/api/hooks/use-bookmark-actions.ts` | 收藏/取消收藏 mutation |
| BookmarksPage | `src/app/bookmarks/page.tsx` | 我的收藏管理页；主题帖/动态分类复用共享 `Tabs` |

## 7. 交互规则

- 详情页按钮：已收藏直接取消；未收藏打开“收藏到”弹窗，预选默认夹，可选择或就地新建后确认
- 可操作收藏未选中时使用中性描边，选中后仅使用 Foundation 金色实心书签，容器保持透明；文字保持正文色，请求中保留原状态视觉，并通过稳定“收藏”名称与 `aria-pressed` 暴露状态
- 收藏与取消收藏成功后只刷新按钮或列表状态，不显示成功 Toast；失败继续显示错误 Toast
- `/bookmarks` 两个内容分栏各自保留当前分类；分类条固定“全部”在首位，只汇总当前目录集数量
- 本人资料收藏页标题区按当前分栏显示“新建主题帖收藏夹”或“新建动态收藏夹”，他人资料收藏页不显示管理操作
- 每条收藏可从选择器移动分类，当前筛选与所有分类计数同步刷新
- 资料页收藏 Tab 以主题帖/动态分栏公开展示，始终不显示收藏夹归类；未公开时隐藏主 Tab，直达路由不发起列表请求
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
| 他人收藏 | 主题帖与动态公开接口共同强制 showBookmarks；未公开 404 → 前端占位 |
| 私密帖收藏 | 仅参与人（后端校验，非参与人 404） |

## 10. 验收标准

- 主题帖与动态详情首次收藏均弹出收藏夹选择，已收藏再次点击直接取消
- 可操作收藏按钮正确呈现金色选中态；导航入口、收藏列表指标等只读书签继续使用通用导航/信息色
- `/bookmarks` 两类内容均支持收藏夹筛选、新建、移动、取消收藏与 cursor 分页
- 主题帖夹与动态夹从不同端点读取和创建，可分别新建同名目录，切换分栏不会把一侧选中的 folderId 带到另一侧
- 登录后全局导航栏显示收藏入口
- 用户资料页公开主题帖和动态收藏但不公开分类；本人可新建收藏夹，未公开时隐藏入口且直达显示占位
- 私密帖收藏权限由后端保证

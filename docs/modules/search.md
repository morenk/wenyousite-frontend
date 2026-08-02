# 搜索模块

## 1. 目标与范围

实现全文搜索入口与结果页，可搜索主题帖标题与楼层内容。

**本次迭代范围（Phase 8 · 第一轮：搜索）：**
- `/search` 搜索页：输入框（URL `?q=` 同步）+ 两栏结果（主题帖 / 楼层内容）
- 导航栏搜索图标入口
- loading / error / empty / data 四态

**后续迭代（Phase 8 · 收藏）：**
- 收藏：详情页收藏按钮（`POST/DELETE /bookmarks`）、`/bookmarks` 我的收藏页、后端 `findAll` 附带 `bookmarkId` + 帖详情附加 `isBookmarked`
- 搜索结果分页（后端当前各最多 50 条）、搜索高亮、收藏分组

## 2. 页面与路由

| 路由 | 页面说明 | 权限 |
|------|----------|------|
| `/search` | 搜索页（`?q=` 关键词同步） | 公开 |

导航栏搜索图标 → `/search`。

## 3. 涉及 API

| Method | Path | Guard | 用途 |
|--------|------|-------|------|
| GET | `/search?q=` | Public | 全文搜索（主题帖标题 + 楼层内容，ILIKE，各最多 50 条，无分页） |

> 空关键词返回 `{ threads: [], posts: [] }`；主题帖仅返回 PUBLIC 已发布帖。

## 4. API 响应快照

真实响应见 `docs/snapshots/search.snapshot.json`。

### GET /search?q=测试 → SearchResult

```json
{
  "code": 0, "message": "ok",
  "data": {
    "threads": [
      {
        "id": "cms7plneh00cq7q6lrmlwwpad",
        "title": "测试帖子喔",
        "category": "DEDUCTION",
        "createdAt": "2026-07-30T16:09:39.257Z",
        "owner": { "id": "cms7gly7n00017q6lbkla7ojh", "username": "morenk", "avatar": null },
        "_count": { "members": 1, "posts": 1 }
      }
    ],
    "posts": [
      {
        "id": "cms60cg8t000p7qahayb90l1a",
        "floorNumber": 1,
        "content": "这是主题帖的正文预览内容…",
        "createdAt": "2026-07-29T11:34:53.501Z",
        "author": { "id": "cms5zycb900017q0azar1nag2", "username": "testuser" },
        "thread": { "id": "cms60cg7a000j7qah3lfs60j0", "title": "智能排序测试帖" },
        "subthread": { "id": "cms60cg8p000n7qah7wmucyj6", "title": "主讨论区" }
      }
    ]
  }
}
```

> 主题帖结果无 `preview`/`status`/`pinned`（与 ThreadCardData 不同），楼层项含 `floorNumber`/`thread`/`subthread` 供跳转。

## 5. 状态管理

| 状态 | 来源 | 管理方式 |
|------|------|----------|
| 搜索结果 | `GET /search?q=` | TanStack Query `useQuery`（queryKey `["search", q]`，q 为空不请求） |
| 输入框 | 组件本地 | 受控 ref（`key={q}` 随 URL 同步，提交时 router.replace 更新 URL） |

## 6. 组件清单

| 组件 | 路径 | 说明 |
|------|------|------|
| SearchResults | `src/components/search/search-results.tsx` | 结果两栏（主题帖 / 楼层），空态 |
| useSearch | `src/api/hooks/use-search.ts` | 搜索 hook |
| SearchPage | `src/app/search/page.tsx` | 搜索页（输入 + 四态） |

## 7. 交互规则

- 输入框提交 → `router.replace('/search?q=…')`，URL 为唯一事实源
- `key={q}` 使输入框随 URL 变化重挂载（含浏览器前进/后退）
- 主题帖项 → `/threads/{id}`；楼层项 → `/threads/{threadId}`
- 空关键词 → 提示输入；无结果 → "没有找到相关内容"

## 8. 错误处理

| 场景 | UI 行为 |
|------|---------|
| 请求失败 | 错误态 + 重试按钮 |
| 空关键词 | 空态提示输入 |
| 无结果 | 空态"没有找到相关内容" |

## 9. 权限与访问控制

`/search` 公开，无需登录。

## 10. 验收标准

- [x] `/search` 输入关键词搜索主题帖标题与楼层内容
- [x] 结果分「主题帖」「楼层内容」两栏，均可跳转
- [x] URL `?q=` 与输入框同步（前进/后退生效）
- [x] loading / error / empty 三态
- [x] 导航栏搜索图标入口
- [x] `pnpm lint && pnpm typecheck && pnpm test && pnpm build` 通过

## 11. 子任务（切片）

- [x] 切片1：`useSearch` hook + 测试
- [x] 切片2：`SearchResults` 组件 + `/search` 页 + nav 入口 + 测试
- [x] 切片3：重抓 search 快照 + 模块文档 + Roadmap
- [ ] 切片4：质量检查 + 部署 + 提交推送

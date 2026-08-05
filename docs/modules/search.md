# 搜索模块

跨端发布批次：`search-scale-20260805`

## 1. 目标与范围

实现全站搜索入口与结果页，可搜索用户名、主题帖标题与楼层内容。

**本次迭代范围（Phase 8 · 第一轮：搜索）：**
- `/search` 搜索页：输入框（URL `?q=` 同步）+ 三类结果 Tab（主题帖 / 楼层内容 / 用户）
- 导航栏搜索图标入口
- loading / error / empty / data 四态

**后续迭代（Phase 8 · 收藏）：**
- 收藏功能已另立文档 `docs/modules/bookmarks.md`（详情页收藏按钮、/bookmarks 管理页、资料页收藏区块）
- 搜索高亮、收藏分组

## 2. 页面与路由

| 路由 | 页面说明 | 权限 |
|------|----------|------|
| `/search` | 搜索页（`?q=` 关键词同步） | 公开 |

导航栏搜索图标 → `/search`。

## 3. 涉及 API

| Method | Path | Guard | 用途 |
|--------|------|-------|------|
| GET | `/search/threads?q=` | Public | 主题帖 Tab 按需查询，最多 50 条 |
| GET | `/search/users?q=` | Public | 用户 Tab 按需查询，最多 20 条 |
| GET | `/search/posts?q=&cursor=&limit=20` | Public | 楼层 Tab 按需查询，相关度游标分页 |
| GET | `/search?q=` | Public | 旧客户端兼容聚合端点，新前端不调用 |

> 三个 Tab 不会并发预取：默认只请求主题帖，首次点击用户或楼层时才请求对应端点。楼层关键词至少 2 个字符，每页 20 条，每个主题帖最多 3 条；用户结果排除注销账号，主题帖与楼层仅返回 PUBLIC 已发布帖。

## 4. API 响应快照

旧聚合端点的脱敏响应见 `docs/snapshots/search.snapshot.json`；分类端点以生成的 OpenAPI 类型为事实来源。

### GET /search?q=测试 → SearchResult

```json
{
  "code": 0, "message": "ok",
  "data": {
    "users": [
      {
        "id": "<redacted-id>",
        "username": "测试用户",
        "avatar": null,
        "bio": "一起写故事"
      }
    ],
    "threads": [
      {
        "id": "<redacted-id>",
        "title": "测试帖子喔",
        "category": "DEDUCTION",
        "createdAt": "2026-07-30T16:09:39.257Z",
        "owner": { "id": "<redacted-id>", "username": "morenk", "avatar": null },
        "_count": { "members": 1, "posts": 1 }
      }
    ],
    "posts": [
      {
        "id": "<redacted-id>",
        "floorNumber": 1,
        "content": "这是主题帖的正文预览内容…",
        "createdAt": "2026-07-29T11:34:53.501Z",
        "author": { "id": "<redacted-id>", "username": "testuser" },
        "thread": { "id": "<redacted-id>", "title": "智能排序测试帖" },
        "subthread": { "id": "<redacted-id>", "title": "主讨论区" }
      }
    ]
  }
}
```

> 用户结果只含公开展示所需的 `id/username/avatar/bio`；主题帖结果无 `preview`/`status`/`pinned`，楼层项含 `floorNumber`/`thread`/`subthread` 供跳转。

## 5. 状态管理

| 状态 | 来源 | 管理方式 |
|------|------|----------|
| 主题帖结果 | `GET /search/threads?q=` | `useQuery`，仅主题帖 Tab 激活时 enabled |
| 用户结果 | `GET /search/users?q=` | `useQuery`，仅用户 Tab 激活时 enabled |
| 楼层结果 | `GET /search/posts?q=&cursor=` | `useInfiniteQuery`，仅楼层 Tab 激活且关键词不少于 2 字符时 enabled |
| 输入框 | 组件本地 | 受控 ref（`key={q}` 随 URL 同步，提交时 router.replace 更新 URL） |

## 6. 组件清单

| 组件 | 路径 | 说明 |
|------|------|------|
| SearchResults | `src/components/search/search-results.tsx` | 三类结果 Tab、分类 loading/error/empty、短词提示与楼层加载更多 |
| useSearchThreads / useSearchUsers | `src/api/hooks/use-search.ts` | 主题帖与用户分类查询 hooks |
| useSearchPosts | `src/api/hooks/use-search.ts` | 楼层游标分页 hook，透传 `meta.cursor` |
| SearchPage | `src/app/search/page.tsx` | 搜索页（输入 + 四态） |

## 7. 交互规则

- 输入框提交 → `router.replace('/search?q=…')`，URL 为唯一事实源
- `key={q}` 使输入框随 URL 变化重挂载（含浏览器前进/后退）
- 三类结果通过 Tab 切换；默认主题帖，仅激活的分类发起请求，已加载结果由 TanStack Query 缓存
- Tab 数量表示当前已加载条数而非全站总数；达到分类上限或楼层仍有下一页时显示 `+`，不发起昂贵的总数统计
- 用户名和主题帖允许单字符；单字符进入楼层 Tab 时提示至少输入 2 个字符且不请求接口
- 楼层每页加载 20 条，`meta.hasMore=true` 时显示“加载更多楼层”
- 用户项 → `/users/{id}`；主题帖项 → `/threads/{id}`；楼层项通过共享 `getPostHref` 携带目标帖子 ID，进入所属子贴并定位高亮具体楼层（楼中楼继续进入对应讨论页）
- 空关键词 → 提示输入；无结果 → "没有找到相关内容"

## 8. 错误处理

| 场景 | UI 行为 |
|------|---------|
| 请求失败 | 错误态 + 重试按钮 |
| 空关键词 | 空态提示输入 |
| 分类无结果 | 当前 Tab 显示对应空态，其他 Tab 仍可切换 |
| 楼层关键词不足 2 字符 | 显示补充关键词提示，不发请求 |

## 9. 权限与访问控制

`/search` 公开，无需登录。用户结果不返回邮箱等敏感字段且排除已注销账号；帖子结果不包含私密帖。

## 10. 验收标准

- [x] `/search` 输入关键词搜索用户名、主题帖标题与楼层内容
- [x] 结果分「主题帖」「楼层内容」「用户」三个 Tab，均可切换和跳转
- [x] 默认只请求主题帖，用户和楼层在首次激活 Tab 时才请求
- [x] 楼层单字符不请求，至少 2 字符才执行正文搜索
- [x] 楼层每页 20 条，可使用游标加载更多；数量有更多时显示 `+`
- [x] 后端保证每个主题帖最多返回 3 条楼层并按相关度优先排序
- [x] 楼层搜索结果可直接定位到具体楼层或楼中楼回复
- [x] URL `?q=` 与输入框同步（前进/后退生效）
- [x] loading / error / empty 三态
- [x] 导航栏搜索图标入口
- [x] `pnpm lint && pnpm typecheck && pnpm test && pnpm build` 通过

## 11. 子任务（切片）

- [x] 切片1：分类搜索 hooks + 楼层游标分页测试
- [x] 切片2：`SearchResults` 组件 + `/search` 页 + nav 入口 + 测试
- [x] 切片3：重抓 search 快照 + 模块文档 + Roadmap
- [x] 切片4：短词限制、Tab 惰性加载、楼层分页与结果去重策略
- [ ] 切片5：质量检查 + 部署 + 提交推送

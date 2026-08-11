# 搜索模块

## 1. 目标与范围

实现全站搜索入口与结果页，并在主题帖详情中提供继承帖子访问权限的楼层搜索；两处复用分页协议、结果列表与精确定位能力。

**当前能力：**
- `/search` 搜索页：输入框（URL `?q=` 同步）+ 四类结果 Tab（动态 / 主题帖 / 楼层内容 / 用户）
- 导航栏搜索图标入口
- loading / error / empty / data 四态
- `/threads/[id]` 帖内搜索面板：覆盖全部子贴与楼中楼，不离开当前主题帖即可检索和定位

## 2. 页面与路由

| 路由 | 页面说明 | 权限 |
|------|----------|------|
| `/search` | 搜索页（`?q=` 关键词同步） | 公开 |
| `/threads/[id]` | 头部“搜索本帖”打开内联搜索面板 | 继承主题帖访问权限 |

导航栏搜索图标 → `/search`。

## 3. 涉及 API

| Method | Path | Guard | 用途 |
|--------|------|-------|------|
| GET | `/search/moments?q=&cursor=&limit=20` | OptionalAuth | 动态 Tab 按需查询，游标分页并按查看者过滤拉黑关系 |
| GET | `/search/threads?q=` | Public | 主题帖 Tab 按需查询，最多 50 条 |
| GET | `/search/users?q=` | Public | 用户 Tab 按需查询，最多 20 条 |
| GET | `/search/posts?q=&cursor=&limit=20` | Public | 楼层 Tab 按需查询，相关度游标分页 |
| GET | `/threads/:threadId/search/posts?q=&cursor=&limit=20` | OptionalAuth | 搜索本帖全部子贴中的楼层与楼中楼 |
| GET | `/search?q=` | Public | 旧客户端兼容聚合端点，新前端不调用 |

> 各 Tab 不会并发预取，默认只请求动态，首次点击其他分类后才请求对应端点。动态与楼层关键词至少 2 个字符并使用游标分页，楼层每页 20 条且每个主题帖最多 3 条；用户结果排除注销账号，动态、主题帖与楼层仅返回公开内容。主题帖结果只使用 `coverImages[0]`，在标题下展示默认主贴的第一张 16:9 封面。

> 主题帖和楼层 Tab 属于用户显式搜索，因此仍展示已注销作者留下的公开历史内容；这些搜索结果不会写入首页 `threads` 发现缓存。

> 帖内搜索使用相同的短词限制、相关度排序和游标，但不套用“每个主题帖最多 3 条”；PRIVATE 帖仅成员可搜，未发布帖仅楼主可搜。搜索结果携带 `parentPostId`，楼中楼可直接进入独立讨论页。

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
| 动态结果 | `GET /search/moments?q=&cursor=` | `useInfiniteQuery`，仅动态 Tab 激活且关键词不少于 2 字符时 enabled；缓存按查看者隔离 |
| 主题帖结果 | `GET /search/threads?q=` | `useQuery`，仅主题帖 Tab 激活时 enabled |
| 用户结果 | `GET /search/users?q=` | `useQuery`，仅用户 Tab 激活时 enabled |
| 楼层结果 | `GET /search/posts?q=&cursor=` | `useInfiniteQuery`，仅楼层 Tab 激活且关键词不少于 2 字符时 enabled |
| 帖内楼层结果 | `GET /threads/:threadId/search/posts?q=&cursor=` | `useThreadSearchPosts`；仅提交有效关键词后请求，按 threadId 隔离缓存 |
| 已提交关键词 | URL `q` | nuqs 类型化字符串状态，URL 为唯一事实源 |
| 输入框 | 组件本地 | 非受控 ref（表单 `key={q}` 随已提交 URL 关键词重挂载） |

公开搜索结果离开页面后保留 30 分钟缓存。关键词变化时结果组件本身不重挂载；新请求期间保留上一组已完成结果、显示列表顶部更新线，避免内容区先清空再跳动。

## 6. 组件清单

| 组件 | 路径 | 说明 |
|------|------|------|
| SearchResults | `src/components/search/search-results.tsx` | 基于共享 `Tabs` 的四类结果、分类 loading/error/empty、短词提示与动态/楼层加载更多 |
| ThreadCover | `src/components/thread/thread-cover.tsx` | 与首页共用的主题帖单封面 |
| useSearchThreads / useSearchUsers | `src/api/hooks/use-search.ts` | 主题帖与用户分类查询 hooks |
| useSearchMoments | `src/api/hooks/use-search.ts` | 动态游标分页 hook，缓存键包含当前查看者 |
| useSearchPosts | `src/api/hooks/use-search.ts` | 楼层游标分页 hook，透传 `meta.cursor` |
| useThreadSearchPosts | `src/api/hooks/use-search.ts` | 帖内楼层分页 hook，与全站楼层共享分页核心 |
| PostSearchResultList | `src/components/search/post-search-result-list.tsx` | 全站与帖内共享的楼层结果、统一 Markdown 纯文本预览、加载更多和精确定位列表 |
| ThreadPostSearch | `src/components/thread/thread-post-search.tsx` | 详情页内联搜索面板，处理输入与 loading/error/empty/data 四态 |
| SearchPage | `src/app/search/page.tsx` | 搜索页（输入 + 四态） |

## 7. 交互规则

- 输入框提交 → nuqs 更新 `q`；空白输入移除参数，非空值由适配器统一编码
- 搜索表单的 `key={q}` 使输入框随 URL 变化重挂载（含浏览器前进/后退）；结果区保持同一查询观察者以承接旧内容
- 四类结果通过共享 `Tabs` 切换并继承方向键、Home/End 与 ARIA 语义；默认动态，仅激活的分类发起请求，已加载结果由 TanStack Query 缓存
- Tab 数量表示当前已加载条数而非全站总数；达到分类上限或楼层仍有下一页时显示 `+`，不发起昂贵的总数统计
- 用户名和主题帖允许单字符；单字符进入动态或楼层 Tab 时提示至少输入 2 个字符且不请求接口
- 楼层每页加载 20 条，`meta.hasMore=true` 时显示“加载更多楼层”
- 楼层内容卡片不暴露 Markdown 协议或链接地址：骰子显示为 `[表达式]`，标签链接显示为 `[标签]`，裸链接显示为 `[链接]`
- 用户项 → `/users/{id}`；主题帖项 → `/threads/{id}`；楼层项通过共享 `getPostHref` 携带目标帖子 ID 和 `parentPostId`，主楼层进入所属子贴，楼中楼直达对应讨论页并定位高亮
- 主题帖封面随整张结果卡片跳转，不单独打开灯箱；图片懒加载，本站静态图优先使用 `_feed.webp`，失败后回退原图
- 详情页头部“搜索本帖”切换内联面板；输入只在提交时发请求，点击主楼层结果会清除当前手选子贴后切换到结果所属子贴
- 空关键词 → 提示输入；无结果 → "没有找到相关内容"

## 8. 错误处理

| 场景 | UI 行为 |
|------|---------|
| 请求失败 | 错误态 + 重试按钮 |
| 空关键词 | 空态提示输入 |
| 分类无结果 | 当前 Tab 显示对应空态，其他 Tab 仍可切换 |
| 楼层关键词不足 2 字符 | 显示补充关键词提示，不发请求 |

## 9. 权限与访问控制

`/search` 公开，无需登录。用户结果不返回邮箱等敏感字段且排除已注销账号；动态搜索按可选登录身份过滤双向拉黑关系，全站帖子结果不包含私密帖。帖内搜索继承当前主题帖权限：公开帖允许匿名，PRIVATE 帖仅成员可用，未发布帖仅楼主可用，无权访问时后端统一返回 404。

## 10. 验收标准

- `/search` 输入关键词搜索动态标题/正文、用户名、主题帖标题与楼层内容
- 结果分「动态」「主题帖」「楼层内容」「用户」四个 Tab，均可切换和跳转
- 分类栏与结果面板在页面主内容列中纵向排列，各分类列表与结果卡片占满可用宽度
- 默认只请求动态，其余分类在首次激活 Tab 时才请求
- 动态与楼层单字符不请求，至少 2 字符才执行正文搜索
- 楼层每页 20 条，可使用游标加载更多；数量有更多时显示 `+`
- 后端保证每个主题帖最多返回 3 条楼层并按相关度优先排序
- 楼层搜索结果可直接定位到具体楼层或楼中楼回复
- 楼层搜索预览以方括号占位展示骰子和链接，不显示内部协议或裸 URL
- URL `?q=` 与输入框同步（前进/后退生效）
- loading / error / empty 三态
- 导航栏搜索图标入口
- 主题帖详情可搜索全部子贴中的主楼层和楼中楼
- 帖内搜索复用全站短词、游标、结果列表与帖子导航组件，且不限制为 3 条
- 私密帖与未发布帖的帖内搜索继承主题帖访问权限
- 已注销作者的公开历史主题帖和楼层仍可被显式搜索

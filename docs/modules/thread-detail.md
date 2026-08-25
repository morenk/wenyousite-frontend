# 主题帖详情与楼层模块

## 1. 目标与范围

实现主题帖详情页，展示帖子头部信息、排头卡内的子贴目录切换、楼层列表（分页）、Markdown 渲染，以及发布新楼层。

子贴目录状态写入稳定 URL：非默认子贴使用 `?subthread={id}`，默认子贴移除该参数；切换目录使用 shallow history replace，不发起 RSC 路由请求，并保留左右游标。当前子贴的相邻目录以及用户聚焦、悬停或按下的目标会预取首屏楼层，缓存命中时切换不重复请求。主楼层默认从早到晚，时间顺序使用与动态评论相同的单击按钮切换；最新在前时写入 `order=NEWEST`，使用 history push 并在页面内导航时保留。复制当前子贴链接只保留内容坐标，不携带排序状态。`post` 精确楼层参数优先于 `subthread`，二者并存时清理 `subthread`，无效子贴参数回落默认目录并清理。目录菜单不设置搜索框，打开后直接聚焦当前子贴项，可用方向键浏览、滚动承载几十个子贴并复制当前子贴链接。正文中的主题、子贴、楼层和回复链接统一按[站内传送门](./internal-references.md)内联显示。

内容浏览不维护阅读进度、楼层更新数或内容未读状态；子贴目录只展示楼层总数。通知中心的未读状态属于独立通知能力，继续保留。

浏览态不预先挂载 Milkdown，仅展示轻量的「发表回复」入口；用户点击发表、回复或编辑后，页面按目标位置挂载全局唯一的上下文编辑器。同一时刻详情页最多存在一个 Milkdown 实例。

平台管理员在公开主题帖头部以及每个楼层、楼中楼回复的更多菜单中可打开“站务隐藏”。提交使用管理员当前普通 Bearer 登录态，服务端实时校验角色，不要求独立站务会话；成功后立即移除已隐藏目标的详情缓存，并异步刷新楼层、回复、用户内容列表和审计查询，不等待必然返回 404 的目标详情重试。主题帖隐藏后返回首页，楼层或回复隐藏后留在当前阅读位置并由刷新后的查询移除。

Milkdown 通过客户端动态模块按需加载，编辑器样式不进入全局 CSS。编辑能力遵循 [`markdown-content-protocol.md`](./markdown-content-protocol.md) 的工具栏白名单：PC 一行容得下时直接平铺全部常用能力并隐藏“更多”，实际溢出时保留核心能力并把低频项收入“更多”；工具栏外格式静默保留为字面文本。增强代码编辑器、表格行列 UI、公式、AI 和块编辑不进入编辑器包。主题卡片在鼠标悬停或键盘聚焦时并行预取 30 秒内可复用的详情与首屏楼层，进入详情后不再串行等待两次请求。

**当前能力：**
- 主题帖详情页 `/threads/[id]`
- 详情排头卡（标题/分类/状态/作者/时间；低频工具置顶，目录与紧凑图标互动工具带置底）
- 排头卡子贴目录切换，并提供左右游标快速切换相邻子贴
- 排头卡离开视口后显示紧凑阅读书签条，保留当前主题、子贴切换、本帖搜索和回顶入口
- 楼层列表（cursor 分页 + 滚动加载 + 单击切换最早/最新在前 + 只看某人）
- 楼层 Markdown 渲染（react-markdown + remark-gfm）
- 通过全局唯一的上下文 Milkdown 发布、回复或编辑楼层
- 点赞/取消点赞主题帖
- 点赞未选中时使用中性描边，选中后使用 Foundation 鲜粉实心心形与柔和粉底；计数保持正文色，请求中保留原状态视觉
- 公开主题帖累计获得温油，登录且非楼主用户可通过“加油”输入整数升数投入
- 当前用户点赞状态 `isLiked`，不得使用全站 `likeCount` 推断
- Loading / Error / Empty / 404 状态
- 头部“搜索本帖”内联面板：检索全部子贴的楼层与楼中楼并精确定位
- 两层楼中楼、楼层编辑和权限删除；子贴正文由后端阻止当作普通楼层删除
- 管理面板可授予/收回玩家身份，头部可管理主题帖与玩家订阅
- 帖内订阅：THREAD 为楼主/协作者官方更新；USER 从头部图标弹层中选择 `PARTICIPANT + playerMarked=true` 的普通玩家
- 私密帖邀请：楼主生成/刷新邀请链接，受邀用户在 `/join/[token]` 预览并加入；已加入用户再次打开同一邀请会直接进入主题帖
- 公开帖发言即参与，不提供手动加入入口；已标记玩家可退出玩家身份

## 2. 页面与路由

| 路由 | 页面说明 | 权限 |
|------|----------|------|
| `/threads/[id]` | 主题帖详情页（含子贴、楼层） | 公开（PRIVATE 帖非成员返回 404） |
| `/threads/[id]?post={postId}` | 精确定位主楼层；未知父楼上下文时兼容识别并转入楼中楼 | 继承主题帖访问权限 |
| `/threads/[id]/posts/[postId]/replies?post={replyId}` | 独立楼中楼阅读页：原楼层作为讨论正文，楼中楼回复作为连续楼层 | 继承主题帖访问权限 |
| `/threads/[id]/edit` | 兼容编辑路由：草稿使用 ThreadCreateForm；已发布帖复用统一管理面板并默认进入「帖子设置」 | OWNER/COLLABORATOR；草稿仅 OWNER |

## 3. 涉及 API

| Method | Path | Guard | 用途 |
|--------|------|-------|------|
| GET | `/thread-categories` | Public | 解析动态分类 slug 的名称与顺序 |
| GET | `/threads/:id` | OptionalAuth | 主题帖详情（含子贴列表、owner、_count；登录时附加 isBookmarked/isLiked） |
| GET | `/threads/:threadId/search/posts` | OptionalAuth | 帖内楼层搜索（至少 2 字符，相关度游标分页，继承主题帖权限） |
| DELETE | `/threads/:id` | Auth | 删除主题帖：未发布帖硬删除，已发布帖软删除，仅 OWNER |
| GET | `/subthreads/:subthreadId/posts` | Public | 楼层列表（cursor 分页，`order=OLDEST\|NEWEST`，含最多 5 条内联 replies） |
| GET | `/subthreads/:subthreadId/posts/authors` | Public | 当前子贴中实际发布过未删除主楼层的楼主、协作者与已标记玩家 |
| POST | `/subthreads/:subthreadId/posts` | Auth | 发布新楼层/楼中楼回复（kind=FLOOR，发帖自动成为参与人=玩家候选池；楼中楼带 parentPostId/replyToPostId） |
| GET | `/posts/:id/replies` | Public | 楼中楼回复列表（cursor 分页，支持正/倒序与玩家、楼主、协作者作者筛选） |
| GET | `/posts/:id/replies/authors` | Public | 当前主楼层下实际发布过未删除回复的楼主、协作者与已标记玩家 |
| GET | `/posts/:id` | Public | 查询通知目标帖的主题、子贴与父楼上下文 |
| PUT | `/subthreads/:subthreadId/body` | Auth | upsert 子贴正文（管理面板保存正文：无正文创建 kind=BODY，有正文乐观锁更新） |
| POST | `/threads/:id/like` | Auth | 点赞主题帖（幂等） |
| DELETE | `/threads/:id/like` | Auth | 取消点赞 |
| POST | `/threads/:id/tips` | Auth | 向主题帖楼主投入不少于 2 升温油（UUID 幂等） |
| GET | `/threads/:threadId/members` | OptionalAuth | 参与人列表；按主题帖可见性校验 |
| PATCH | `/threads/:threadId/members/:userId` | Auth | 楼主任免协作者；楼主/协作者管理玩家标记 |
| POST | `/threads/:threadId/members/join` | Auth | 旧客户端兼容端点（deprecated；Web 不调用） |
| DELETE | `/threads/:threadId/members/me` | AuthRead | 退出玩家身份（保留参与人候选记录） |
| POST | `/threads/:id/invite-link` | Auth | 私密帖楼主生成或刷新邀请 token |
| GET | `/threads/join-by-link/:token` | AuthRead | 预览私密帖邀请并返回 `alreadyJoined` |
| POST | `/threads/join-by-link/:token` | Auth | 幂等地通过邀请加入私密帖 |
| GET | `/subscriptions` | Auth | 我的订阅列表 |
| POST | `/subscriptions` | Auth | 创建订阅（THREAD/USER） |
| DELETE | `/subscriptions/:id` | Auth | 取消订阅 |

> **「参与」语义**：回复后后端自动写入参与人记录，公开帖 Web 不再提供显式加入。`DELETE members/me` 只取消 `playerMarked`，参与记录和私密帖成员资格永久保留。元数据显示的 `_count.players` 为被授予玩家身份（`playerMarked=true`）的人数。

> **候选池管理**：参与人记录只表示用户曾回复过主题帖，用于楼主选定玩家；管理操作不会删除参与人记录，仅通过角色字段管理协作者身份、通过 `playerMarked` 管理玩家标记。

> **ID 校验说明**：后端所有 ID 为 Prisma `cuid()` 生成的 CUID（非 UUID），DTO 校验统一使用 `@IsCuid`（替代 `@IsUUID`，后者会因 CUID 不含连字符而拒绝请求）。

> **分类显示契约**：`thread.category` 是可空的动态 slug，不再是封闭枚举。详情通过 `GET /thread-categories` 显示管理员配置的名称，并使用 Foundation 统一中性呈现；分类 API 不包含颜色字段。未知 slug 显示原 slug，空值显示“未分类”，不能导致页面崩溃。

> **通知精确定位**：主楼层仍使用详情页 `?post=` 注入并立即定位；楼中楼通知直接进入 `/threads/{threadId}/posts/{parentPostId}/replies?post={replyId}`，在独立阅读页立即定位并高亮目标回复。定位不使用平滑移动动画；高亮只作用于目标楼层/回复卡片本身，父楼层和列表容器不高亮。兼容旧链接：详情页发现目标是楼中楼时立即重定向到独立阅读页，重定向期间不高亮父楼层。

> **楼中楼链接契约**：楼中楼回复可通过 `/threads/{threadId}/posts/{parentPostId}/replies?post={replyId}` 精确定位；回复卡片右上角操作菜单提供复制链接入口。该 URL 仅依赖现有 Post 字段，不新增 API。

> **主楼层链接契约**：主楼层可通过 `/threads/{threadId}?post={postId}` 精确定位；楼层卡片右上角操作菜单提供复制链接入口。该 URL 仅依赖现有 Post 字段，不新增 API。

> **卡片操作契约**：子贴回复串的主楼层与楼中楼回复共用同一套右上角三点菜单。复制文本、复制链接始终可用；编辑仅作者可用；删除仅作者或帖内管理者可用并与普通操作分组。回复不藏在更多菜单中：登录用户可从卡片底部右侧带 `action.reply` 图标与“回复”文字的按钮原位打开编辑器，底部左侧显示发布时间。动态评论区继续使用带 Tooltip 的纯图标形态，以保持信息流密度。

> **作者导航契约**：主楼层、内联楼中楼、独立回复列表与独立回复串原楼层的作者头像和用户名均进入 `/users/{userId}`；头像链接提供独立的键盘焦点和无障碍名称。

> **统一导航契约**：`src/lib/post-navigation.ts` 集中生成主楼层、楼中楼讨论和目标回复地址，供搜索、通知、个人动态、复制链接、讨论列表及兼容重定向复用。各业务组件只负责呈现或触发导航，不再自行拼接帖子定位 URL。

> **主题帖链接契约**：公开主题帖可通过 `/threads/{threadId}` 访问根页面，详情头部提供复制主题帖链接入口。私密帖不显示普通复制链接；生成或刷新邀请链接只放在管理台「帖子设置 → 私密访问」，详情头部不重复提供邀请与删除入口。

> **主题标签导航**：详情头部的主题帖标签链接到 `/tags/{tagId}`；标签页只列出关联该标签的公开已发布主题帖，私密帖不会因标签关系出现在公开列表中。

> **邀请重复访问契约**：`/join/[token]` 读取预览响应的 `alreadyJoined`。已是成员时显示加载过渡并立即 `replace` 到 `/threads/{threadId}`；提交加入接口本身也保持幂等，用于覆盖多标签页或并发点击。加入成功后失效“参与的帖子”缓存。预览查询不自动重试，旧 token 的 404 会立即显示“邀请链接无效或已失效”，避免页面长时间转圈和重复请求。

> **邀请传送门契约**：合法的 `/join/{16 位 token}` 及 `https://wenyou.site` / `https://www.wenyou.site` 同源绝对地址可在帖子、动态和评论中显示为站内传送门；解析阶段不请求邀请预览或私密帖元数据。公开主题、子贴正文、楼层和回复提交邀请传送门前确认，失败重试同一邀请内容时不重复打断；私密主题不弹公开分享确认。发布邀请传送门等同于分享该邀请凭据，目标可见性仍由加入页和既有权限逻辑决定。

## 4. 响应结构示例

### GET /threads/:id → ThreadDetail

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "id": "<redacted-id>",
    "title": "快照测试帖",
    "ownerId": "<redacted-id>",
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
    "defaultSubthreadId": "<redacted-id>",
    "createdAt": "2026-07-30T17:07:26.204Z",
    "updatedAt": "2026-07-30T17:07:26.215Z",
    "deletedAt": null,
    "owner": { "id": "<redacted-id>", "username": "testthread2", "avatar": null },
    "subthreads": [
      {
        "id": "<redacted-id>",
        "threadId": "<redacted-id>",
        "title": "快照测试帖",
        "sortOrder": 0,
        "postingPolicy": "PARTICIPANTS",
        "version": 1,
        "lastPostAt": null,
        "deletedAt": null,
        "createdAt": "2026-07-30T17:07:26.207Z",
        "_count": { "posts": 0 },
        "tags": [],
        "bodyPost": { "id": "<redacted-id>", "content": "这是一段正文内容（快照验证）", "version": 1 }
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
      "id": "<redacted-id>",
      "threadId": "<redacted-id>",
      "subthreadId": "<redacted-id>",
      "authorId": "<redacted-id>",
      "floorNumber": 1,
      "parentPostId": null,
      "replyToPostId": null,
      "content": "正文内容...",
      "version": 1,
      "createdAt": "2026-07-30T16:13:06.198Z",
      "updatedAt": "2026-07-30T16:13:06.198Z",
      "deletedAt": null,
      "author": { "id": "<redacted-id>", "username": "morenk", "avatar": null },
      "_count": { "replies": 0 },
      "replies": []
    }
  ],
  "meta": { "cursor": "<redacted-id>", "hasMore": false }
}
```

### POST /subthreads/:subthreadId/posts → Created Post

```json
{
  "id": "<redacted-id>",
  "threadId": "<redacted-id>",
  "subthreadId": "<redacted-id>",
  "authorId": "<redacted-id>",
  "floorNumber": 1,
  "parentPostId": null,
  "replyToPostId": null,
  "content": "后来补的首楼",
  "version": 1,
  "createdAt": "2026-07-30T17:07:26.306Z",
  "updatedAt": "2026-07-30T17:07:26.306Z",
  "deletedAt": null,
  "author": { "id": "<redacted-id>", "username": "testthread2", "avatar": null }
}
```

### GET /posts/:id/replies?limit=5 → ReplyList

```json
{
  "code": 0,
  "message": "ok",
  "data": [
    {
      "id": "<redacted-id>",
      "threadId": "<redacted-id>",
      "subthreadId": "<redacted-id>",
      "authorId": "<redacted-id>",
      "floorNumber": null,
      "parentPostId": "<redacted-id>",
      "replyToPostId": "<redacted-id>",
      "replyTo": {
        "id": "<redacted-id>",
        "authorId": "<redacted-id>",
        "author": { "id": "<redacted-id>", "username": "morenk", "avatar": null }
      },
      "content": "回复 @morenk 的内容",
      "version": 1,
      "createdAt": "2026-07-30T17:07:26.306Z",
      "updatedAt": "2026-07-30T17:07:26.306Z",
      "deletedAt": null,
      "author": { "id": "<redacted-id>", "username": "testthread2", "avatar": null }
    }
  ],
  "meta": { "cursor": "<redacted-id>", "hasMore": false }
}
```

> **replyTo 字段**：后端 `GET /posts/:id/replies` 与 `GET /subthreads/:id/posts` 内嵌回复均带 `replyToPost` 关联（含目标回复 `author`），前端 `PostData.replyToPost` 据此渲染「回复 @xxx」上下文。字段事实以固定 OpenAPI 和生成类型为准。

### POST /threads/:id/like → ThreadDetail (partial)

```json
{
  "id": "<redacted-id>",
  "title": "快照测试帖",
  "likeCount": 1,
  ...
}
```

## 5. 状态管理

| 状态 | 来源 | 管理方式 |
|------|------|----------|
| 主题帖详情 | `GET /threads/:id` | TanStack Query `useQuery`；query key 含查看者 ID，认证恢复后重新读取权限字段 |
| 楼层列表 | `GET /subthreads/:subthreadId/posts` | TanStack Query `useInfiniteQuery` |
| 楼层顺序 | 用户切换最早/最新在前 | URL `order` + TanStack Query key；默认 `OLDEST` 不写入 URL |
| 楼层作者 | `GET /subthreads/:subthreadId/posts/authors` | 本地 `authorId` + TanStack Query key；切换子贴时清空，不写入 URL |
| 当前选中子贴 | 用户通过目录、搜索结果或左右游标切换 | URL `subthread` 参数 + 本地派生（默认 `defaultSubthreadId`） |
| 当前编辑会话 | 用户点击发表/回复/编辑 | `ThreadComposerProvider`（全页唯一 session + content + pending） |
| 点赞状态 | `GET /threads/:id` 的 `isLiked` + `POST/DELETE /threads/:id/like` | useMutation + query invalidation；`likeCount` 仅用于展示总数 |
| 订阅状态 | `GET /subscriptions` + `GET /threads/:id/members` | THREAD 通过单个图标切换官方更新；USER 在弹层中选择普通已标记玩家；楼主/协作者隐藏全部订阅控件；成功只更新控件状态，失败显示错误 Toast |
| 当前用户帖内权限 | `GET /threads/:id` 的 `currentMembership` + `capabilities` | 与详情共用缓存，只查询当前用户成员关系；不为权限判断预取全量成员 |
| 帖内搜索 | `GET /threads/:threadId/search/posts` | `useThreadSearchPosts` 游标分页；面板开关与待提交输入为详情页/组件本地状态 |
| 表情收藏 | `GET /stickers` 与导入/排序/删除端点 | `useStickers` 用户级缓存；编辑器点选插入，正文图片可快速收藏 |
| 动态分类 | `GET /thread-categories` | 全局 Query 缓存；详情、列表和管理表单共用同一 slug → 展示映射 |
| 管理视图 | `/threads/[id]/edit` | `view=settings|subthreads|members` 与可选 `subthread={id}` URL 状态；默认参数省略，切换使用 history replace 并在离开前检查未保存内容 |

## 6. 组件清单

| 组件 | 路径 | 说明 |
|------|------|------|
| ThreadDetailPage | `src/app/threads/[id]/page.tsx` | 详情页主逻辑；管理入口关闭当前编辑器后导航到 workspace 编辑路由 |
| ThreadDetailHeader | `src/components/thread/thread-detail-header.tsx` | 两段式排头卡：上层展示主题信息与搜索/分享/管理工具，下层以禁止换行的单行工具带合并弹性子贴目录与紧凑图标互动操作；点赞与收藏相邻 |
| ThreadReadingBar | `src/components/thread/thread-reading-bar.tsx` | 排头卡离开视口后的帖内阅读书签条；保留标题、子贴目录、搜索和回顶，并遵循减少动态效果设置 |
| ThreadSubscriptionControls | `src/components/thread/thread-subscription-controls.tsx` | 普通用户的官方更新图标开关与玩家订阅弹层、成员候选查询；官方更新激活态使用透明容器上的品牌深紫实心铃铛 |
| ThreadPostSearch | `src/components/thread/thread-post-search.tsx` | 内联搜索全部子贴与楼中楼；处理短词、分页及四态 |
| PostSearchResultList | `src/components/search/post-search-result-list.tsx` | 与全站搜索共用的结果列表、加载更多和精确帖子导航 |
| SubthreadSwitcher | `src/components/thread/subthread-tabs.tsx` | 排头卡与阅读书签条共用的子贴目录；弹出紧凑的固定高度纵向菜单，显示当前项与各子贴楼层数；左右游标在首尾循环衔接 |
| SubthreadBody | `src/components/thread/subthread-body.tsx` | 当前子贴标题与正文（kind=BODY）在主题文档容器内连续阅读；不显示“主帖正文 / 子贴 n/N”等重复定位文案，正文不进入楼层列表 |
| FloorCard | `src/components/thread/floor-card.tsx` | 单条楼层卡片；主楼层及其内联回复均提供原位回复和完整操作菜单，作者可编辑，作者或楼主/协作者可删除；正文图片可收藏为表情 |
| FloorList | `src/components/thread/floor-list.tsx` | 楼层列表（仅 kind=FLOOR，无限滚动，cursor 分页） |
| FloorListControls | `src/components/thread/floor-list-controls.tsx` | 主楼层轻量筛选工具行；范围化作者下拉与单击时间顺序按钮始终可见并覆盖加载、失败、空候选四态 |
| ThreadComposerProvider | `src/components/thread/thread-composer-context.tsx` | 全页唯一编辑会话；统一处理目标切换、脏内容确认和提交锁 |
| ThreadComposer | `src/components/thread/thread-composer.tsx` | 按当前会话创建楼层、回复或编辑帖子；唯一挂载 MilkdownEditor |
| ThreadComposerOutlet | `src/components/thread/thread-composer.tsx` | 放置在楼层/回复上下文中的轻量插槽，仅活动目标渲染编辑器 |
| FloorForm | `src/components/thread/floor-form.tsx` | 新楼层轻量入口；点击后才在底部浮层中展开唯一编辑器 |
| FloatingComposerDock | `src/components/thread/floating-composer-dock.tsx` | 主回复串与楼中楼共用的视口底部浮动输入坞；对齐内容列、自动留白、其他卡片编辑时隐藏 |
| ReplyDiscussion | `src/components/thread/reply-discussion.tsx` | 独立楼中楼阅读主体：原楼层保留 `#n` 定位、导航回原楼层、回复列表与共享浮动输入坞；不重复显示楼中楼说明标题 |
| ReplyCard | `src/components/thread/reply-card.tsx` | 主楼层内联预览与完整回复列表共用的楼中楼卡片；统一原位回复、复制、编辑、删除与站务操作 |
| getPostHref / getPostDiscussionHref | `src/lib/post-navigation.ts` | 共享帖子导航契约：统一主楼层定位、楼中楼直达及 URL 编码 |
| ReplyForm | `src/components/thread/reply-form.tsx` | 楼中楼浮动回复入口：登录用户按需打开统一编辑器，未登录显示登录提示 |
| ReplyList | `src/components/thread/reply-list.tsx` | 楼中楼连续列表，各条保留显式原位回复按钮与 `#n` 顺序定位；独立阅读时单击切换最早/最新在前，并只看当前主楼层下实际回复过的角色作者；作者可编辑，作者或楼主/协作者可删除 |
| ThreadPermissionsProvider | `src/components/thread/thread-permissions-context.tsx` | 复用详情中的当前成员与 capability 投影，计算楼主、协作者、参与人和管理权限 |
| MemberManager | `src/components/thread/member-manager.tsx` | 成员权限表：本地搜索/筛选，楼主可任免协作者，楼主/协作者可授予或收回玩家标记 |
| ManagementPanel | `src/components/thread/management-panel.tsx` | 楼主/协作者统一桌面管理台：帖子设置、子贴内容、成员权限三个 URL 页签，持续保存状态与快捷保存 |
| useManagementPanelController | `src/components/thread/use-management-panel-controller.ts` | 管理台 reducer、URL 恢复、未保存导航保护、联合保存/冲突恢复与 mutation 编排 |
| SubthreadTree | `src/components/thread/subthread-tree.tsx` | 管理台左栏章节目录（真实顺序、权限/楼层摘要、@dnd-kit 鼠标与键盘排序） |
| SubthreadForm | `src/components/forms/subthread-form.tsx` | 新建子贴 Dialog（焦点圈定、Esc/遮罩关闭）+ 共享 Select（title + postingPolicy + Zod 校验）；已有子贴在正文画布上方内联编辑元数据 |
| useFloors | `src/api/hooks/use-floors.ts` | 楼层列表 hook；顺序与作者进入 query key 和每页请求 |
| useLikeThread | `src/api/hooks/use-like-thread.ts` | 点赞/取消点赞 hook |
| useCreateSubthread | `src/api/hooks/use-create-subthread.ts` | 管理面板：添加子贴 |
| useUpdateSubthread | `src/api/hooks/use-update-subthread.ts` | 管理面板：编辑子贴 |
| useDeleteSubthread | `src/api/hooks/use-delete-subthread.ts` | 管理面板：删除子贴 |
| useReorderSubthreads | `src/api/hooks/use-reorder-subthreads.ts` | 管理面板：拖拽排序 |
| useUpsertBody | `src/api/hooks/use-upsert-body.ts` | 管理面板：写入子贴正文（upsert：无正文创建、有正文乐观锁更新） |
| useCreatePost | `src/api/hooks/use-create-post.ts` | 楼层回复发布（FloorForm） |
| useUpdatePost | `src/api/hooks/use-update-post.ts` | 编辑楼层正文（乐观锁 version） |
| useDeletePost | `src/api/hooks/use-delete-post.ts` | 删除楼层/回复（作者或楼主/协作者；BODY 由后端拦截） |
| useSyncThreadTags | `src/api/hooks/use-sync-thread-tags.ts` | 编辑帖时同步主题帖标签（diff 后添加/移除） |
| useReplies | `src/api/hooks/use-replies.ts` | 楼中楼回复列表（排序、作者筛选条件进入 query key 与 cursor 分页请求） |
| useFloorAuthors / useReplyAuthors | `src/api/hooks/use-discussion-authors.ts` | 与列表首页并行读取范围化作者候选，不从当前已加载分页推导 |
| useMembers | `src/api/hooks/use-members.ts` | 仅成员管理页或普通用户订阅候选需要时加载全量参与人列表 |
| useUpdateMember | `src/api/hooks/use-update-member.ts` | 改参与人角色/玩家标记 |
| useSubscriptions | `src/api/hooks/use-subscriptions.ts` | 我的订阅列表 |

> 楼层卡片会直接展示 API 返回的前 5 条楼中楼回复；每条预览右上角保留完整三点菜单，登录用户可在底部原位回复。发布时间与主楼层回复入口位于正文和预览之间，使用留白而非分割线组织层级。当真实回复数超过预览数量，或预览正文合计超过 500 个字符时，内联区域截断并使用渐变遮罩，通过粗体「查看全部 N 条回复」进入独立楼中楼页面；在预览内回复或编辑期间临时解除截断，关闭编辑器后恢复。未超限时不提供独立阅读入口，主楼层底部也不再重复显示回复数链接；正文的「展开全文 / 收起」使用相同的粗体操作字重。没有楼中楼回复时不显示空状态文案。
| useSubscriptionMutations | `src/api/hooks/use-subscription-mutations.ts` | 创建/取消订阅 |
| ThreadEditForm | `src/components/forms/thread-edit-form.tsx` | 管理台「帖子设置」双栏表单；协作者可改标题/分区/状态/标签/主帖正文，可见性仅楼主；邀请与删除归入楼主侧栏并上报统一保存状态 |
| EditThreadPage | `src/app/threads/[id]/edit/page.tsx` | 兼容路由：未发布草稿继续使用发布表单，已发布帖复用统一管理面板 |
| useEditorMentionController | `src/components/editor/use-editor-mention-controller.ts` | Milkdown 的提及 DOM 监听、键盘导航、原子删除与插入事务 |

## 6.1 帖主管理面板

帖主/协作者在详情头部只看到一个「管理主题帖」按钮，点击进入 `/threads/[id]/edit` 的 **共同创作管理台**。该路由只面向 PC，固定使用 72px 图标导航且不显示右侧信息栏；验收最小宽度为 1024px，不提供移动抽屉或触控排序。管理台包含「帖子设置 / 子贴内容 / 成员权限」三个页签并默认打开「帖子设置」；「返回帖子」回到主题帖详情。

```
┌─ 共同创作管理台 ─────────────────────────────────────────────┐
│ [← 返回帖子]  {帖子标题} [楼主/协作者]   已保存   [保存当前页] │
│ 帖子设置 ｜ 子贴内容 N ｜ 成员权限 N                         │
├──────────────────────────────────────────────────────────────┤
│ 设置：标题、标签、主帖正文            │ 发布/可见性/访问权限 │
│ 子贴：约 18rem 章节目录                │ 元数据 + 正文画布    │
│ 成员：搜索与角色筛选后的桌面权限表                           │
└──────────────────────────────────────────────────────────────┘
```

- 顶栏持续显示「已保存 / 有未保存修改 / 保存中 / 保存失败 / 内容冲突」，页签以状态点标记未保存修改；帖子与子贴均支持 `Ctrl/Cmd+S`，成员权限修改即时生效。
- 「帖子设置」采用内容主栏与 18rem 发布侧栏。标题、分区、状态、标签和主帖正文通过 `PATCH /threads/:id/aggregate` 原子保存；可见性仅楼主可改。协作者仍能看到只读可见性和明确能力说明。
- 私密帖邀请与删除主题帖集中到帖子设置：生成邀请前说明旧链接失效；刚改为私密但尚未保存时禁用邀请。删除确认包含帖子标题、子贴/楼层影响及不可恢复说明，成功后 replace 到首页。
- 「子贴内容」左栏只展示真实子贴，使用真实顺序号、短发帖权限和楼层数；当前项以品牌竖线标记。鼠标和键盘拖拽均先本地排序，失败回滚。提交排序时自动把默认子贴补在首位，继续满足 `sortOrder=0` 约束。
- 子贴标题与发帖权限在右侧正文画布上方内联编辑。顶栏「保存子贴」按实际变更分别提交元数据和正文；部分成功只提交成功部分的新基线，并明确提示剩余失败项。新建后立即选中、写入 URL 并聚焦正文；删除当前项后选择相邻章节。
- 「成员权限」使用桌面表格，默认按楼主、协作者、玩家、其他参与人排序；支持用户名搜索与「全部 / 协作者 / 玩家 / 其他参与人」筛选。协作权限和玩家标记是独立维度：任免协作者需站内确认，玩家标记直接切换；每行 mutation 独立 pending、乐观更新并在失败时回滚。
- 乐观锁冲突不清空本地输入。帖子和子贴均提供「复制本地正文 / 载入最新版本」，载入前再次确认。
- 帖子设置或当前子贴有未保存内容时，页签切换、子贴切换、返回帖子、工作区链接、浏览器后退、刷新和关闭均受保护；保存、排序、创建、删除或图片上传期间禁止离开。
- 管理上下文由 URL 恢复：默认设置页省略参数；子贴使用 `?view=subthreads&subthread={id}`，成员使用 `?view=members`。无效子贴安全回落首个真实子贴并规范化 URL，切换统一使用 history replace。
- `/threads/[id]/edit` 是已发布帖管理的唯一页面入口，同时兼容历史收藏和直达链接；草稿续写/发布流程不变。

## 6.2 阅读排版

主题帖正文、楼层和独立回复遵循 `foundation.lock.json` 对应的 Web 平台规范；当前实现为主阅读正文 `17px / 约 32px`、最大 40 个全角字宽，嵌套回复 `16px / 1.85`。完整阅读态保留普通段落内的 Markdown 软换行，与 Flutter 展示一致；列表摘要另行折叠为空格。正文、粗体、斜体与富文本标题统一使用 Noto Sans SC，粗体使用真实 700 字重；LXGW WenKai 500 只用于详情内容标题和页面/区块结构标题。Milkdown 编辑区使用同一套字号、行距和强调映射。

## 7. 发布楼层流程

创建楼层和楼中楼请求携带 UUID `clientRequestId`。Composer 以子贴、完整正文（含内联骰子节点）和回复目标生成请求指纹：相同指纹在网络失败后的人工重试复用同一 UUID；任一内容变化时生成新 UUID。后端按用户和请求 ID 唯一，确保 Web/Flutter 的超时重试不会生成重复楼层或重复骰子结果。

### 骰子

- 骰子入口在 PC 宽栏和标准内容栏直接展示，仅在继续变窄为核心栏时进入“更多”；点击后打开结构化插入器，分别填写骰子数、面数与正负修正。d4/d6/d8/d10/d12/d20/d100 快捷项只替换面数，实时预览规范化的 `{notation} = ?`，确认后在打开菜单前的光标处插入。
- 骰子在正文中是不可编辑但可移动/删除的无图标原子节点，与普通文字基线对齐且内部不换行。未结算显示 `{notation} = ?` 并使用浅黄警告底；正式结果显示 `{notation} = {total}` 并使用柔粉品牌底，正文内不额外显示箭头、图标或“点击展开”文案。
- 阅读态的正式结果可点击或用 Enter/Space 打开详情。Web 使用锚定浮层，在最多 `22rem × 28rem` 且受视口约束的内部滚动区中，以数字格按服务端顺序展示全部逐骰结果；计算区显示骰面小计、仅在非零时显示的修正，以及服务端总计。触发器的无障碍名称只包含表达式与总计，每个数字格单独提供“第 N 枚，V 点”语义，关闭后焦点回到原骰子。
- 编辑态的骰子保持选择型原子，不在编辑器里打开结果详情；结构化输入的即时范围检查镜像后端约束，发布时仍以后端校验和结算为准。
- content 使用 `[[dice:v1:<UUIDv4 nodeId>:<notation>]]` 存储节点。前端不生成点数，正式结果仅按后端 `diceRolls[].nodeId` 映射显示。
- 普通楼层/楼中楼可只发骰子；子贴 BODY 在发布状态下仍必须有可见正文。
- 已发布帖子编辑时，移动节点保留结果，删除节点同步删除结果，同一 nodeId 不可改表达式；每帖最多 20 个节点。
- 草稿主题帖和云草稿都把节点作为 content 的一部分原子保存；主题帖发布时由后端对全帖节点统一结算，任一失败时保持未发布。
- Web 与 Flutter 共用同一 content/nodeId 协议；移动端只需实现对应的内联原子节点和小弹窗，不在客户端掷骰。

> **一楼渲染规则：** 每个子贴的正文（`subthread.bodyPost`，kind=BODY）为该子贴的「正文」，由 `SubthreadBody` 与子贴标题放在同一卡片容器中渲染（Markdown），**不进入楼层列表**，`floorNumber = null` **不占楼层号**。`FloorList` 展示的为楼层（kind=FLOOR），楼层号从 #1 开始显示。楼层接口已只返回楼层（不含正文），前端无需再按 `bodyPostId` 过滤。`bodyPost` 对任意子贴均可用：每个子贴（含非默认子贴）的正文通过 `PUT /subthreads/:id/body` upsert。

> **子贴正文 vs 回复串：** 子贴正文（kind=BODY）与楼层/回复串（kind=FLOOR）定位不同——正文由子贴生命周期管理（管理面板 upsert，删除帖子接口对 BODY 返回 403 拦截），**楼层列表中的楼层（含 #1）作者均可删除/编辑**，不存在「首楼禁删」。

**页面布局：** 主题帖排头卡为不带分类色块的两段式信息面板（`ThreadDetailHeader`：上层为徽章/标题/作者/标签与低频工具，下层为禁止换行的子贴目录和图标互动工具带；目录标题弹性截断，左右游标首尾循环）→ 排头卡离开视口后出现阅读书签条（标题、目录、搜索、回顶）→ 当前子贴标题与正文（不重复显示定位说明）→ 楼层列表（不额外显示“讨论 n 楼”标题）→ 语义上位于列表底部、视觉上浮在视口底部的轻量发布入口。

```
用户点击 FloorForm 的「发表回复」入口
  → 按需挂载全页唯一 MilkdownEditor（支持 Markdown + 图片上传）
  → 未登录：跳转 /login
  → 已登录：调用 POST /subthreads/:id/posts { content }（骰子节点已内联；发帖自动成为参与人=候选池）
    → 成功：关闭编辑会话 + invalidation 刷新楼层列表
    → 失败：按错误码提示（40302 协作者 / 40303 玩家，或后端 message）
```

> **唯一编辑会话：** `create-floor`、`reply`、`edit` 使用同一份判别联合状态。点击新目标时，当前内容为空或未修改则直接切换；存在未提交修改时先确认是否放弃；提交或图片上传期间禁止切换。保存成功后关闭会话。浏览态和未登录态均不挂载 Milkdown。

> **楼层编辑**：作者从 FloorCard 右上角操作菜单选择“编辑”后，唯一编辑器在正文位置回填 `floor.content`，保存调用 `useUpdatePost`（乐观锁 version）。原正文仅在该楼层为当前编辑目标时隐藏。

> **楼中楼回复与独立阅读**：详情页不原地展开超限回复串。登录用户点击楼层下方显式回复按钮时，在当前楼层内挂载唯一编辑器；数量或文字超限时通过「查看全部 N 条回复」进入独立阅读页，未超限时直接在预览中完成阅读和回复。通知、搜索与精确链接仍可直接进入独立页。独立页顶部保留主题帖/子贴/原楼层上下文，回复按普通楼层密度连续排列，每条回复也有显式原位回复按钮。存储语义不变，创建仍传 `parentPostId=主楼层 id`、`replyToPostId=目标 id`；编辑、删除和无限分页复用原有 hooks。

> **讨论阅读筛选**：主题帖主楼层与独立楼中楼都使用轻量右对齐工具行；时间顺序通过同一 `action.sort` 按钮在“最早在前 / 最新在前”间直接切换，不使用下拉框或“阅读方式”面板。两处都提供“只看某人”：主楼层候选只取当前子贴实际发布过主楼层的角色作者，楼中楼候选只取当前主楼层下实际回复过的角色作者；普通参与人和其他子贴/楼层的角色成员不会混入。候选接口与列表首页并行读取，筛选不裁剪主楼层卡片内的 5 条回复预览。切换条件使用新的查询缓存与第一页游标；作者筛选激活时，其他作者的精确定位内容不会额外注入结果。

> **长回复串浮动入口**：主题帖楼层串与独立楼中楼页共用 `FloatingComposerDock`。入口在 DOM 与阅读语义上仍位于列表底部，但视觉上固定浮在当前内容列的视口底部，用户无需滚到最后即可打开统一编辑器。浮层依实际高度为列表尾部留白，避免遮住最后一条；从某条回复的操作菜单选择“回复”或“编辑”时，通用浮层暂时隐藏，编辑器仍在目标卡片内挂载。

> **编辑器图片上传状态**：楼层/楼中楼按需编辑器上传图片时仅锁定提交和取消按钮，编辑器本身保持可编辑，避免 Crepe 在只读切换中重建并丢失顶栏。编辑器右上反馈区持续显示准备、真实已传/总字节、百分比和处理状态，并可取消当前上传。E2E 分别覆盖创建页和独立楼中楼编辑器上传完成后的工具栏可见性。

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
| 40912 | clientRequestId 被不同载荷复用 | toast 后端冲突提示，不清空编辑器 |
| 40003 | 骰子节点格式/表达式非法、nodeId 重复或同 ID 改表达式 | toast 后端 message，保留编辑器内容 |
| 40004 | 单帖骰子节点超过 20 个 | toast 后端 message，保留编辑器内容 |

## 9. 权限与访问控制

| 场景 | 处理 |
|------|------|
| 公开帖 | 所有用户可查看 |
| 私密帖 + 非成员 | 后端返回 404（设计决策：避免枚举私密帖） |
| 帖内搜索 | 公开帖允许匿名；PRIVATE 帖仅成员；未发布草稿仅 OWNER；无权访问返回 404 |
| 未登录发帖 | apiClient 拦截器自动跳转 /login |
| 发帖 | 登录且通过主题帖访问校验即可发帖，发帖自动入候选池；OWNER/COLLABORATOR 绕过子贴策略 |
| 已发布帖 OWNER/COLLABORATOR | 管理类操作集中在独立图标组；协作者可进入三个管理页签，但保存主题帖时不包含 visibility/published |
| 未发布草稿 OWNER | 从草稿列表进入 `/threads/[id]/edit` 后显示 ThreadCreateForm，可保存草稿或最终发布 |
| OWNER 删除 | 显示 "删除" 按钮；确认后调用 `DELETE /threads/:id`，成功返回首页 |
| OWNER/COLLABORATOR 订阅 | 不显示任何订阅控件；自动接收全部帖子动态 |
| 普通用户订阅 | THREAD 使用铃铛图标切换官方更新；USER 通过玩家图标弹层选择 `PARTICIPANT + playerMarked=true` 普通玩家；用途由悬浮说明展示 |
| PRIVATE OWNER | 详情头部不显示普通分享；管理台「帖子设置 → 私密访问」可生成邀请，每次调用都会刷新旧 token |
| PRIVATE 其他成员 | 不显示普通复制链接或邀请链接 |
| PUBLIC 非成员 | 不显示手动加入；首次发言自动建立参与人记录 |
| 已标记玩家 | 显示“退出玩家身份”；OWNER 不可退出 |

## 10. 验收标准

- 详情页正确展示帖子头部信息
- 头部分类从公开分类接口解析；未知或空分类安全降级
- 排头卡内可打开子贴目录并切换，当前子贴在按钮和菜单内均明确标记
- 子贴标题与正文（kind=BODY）同容器渲染（SubthreadBody），正文不进入楼层列表
- 主题帖标题区独立置顶（ThreadDetailHeader），子贴标题取代原卡片内标题位置
- OWNER 可删除主题帖：已发布帖软删除，草稿硬删除，成功后返回首页
- 楼层列表默认按 floorNumber 正序，可切换倒序并在 URL、分页与子贴切换中保留（楼层编号不变）
- 动态评论、主题帖楼层和独立楼中楼都通过同样的单击时间顺序按钮切换，不出现排序下拉框
- 主楼层和独立楼中楼均可只看某人；候选分别严格限定为当前子贴主楼层作者和当前主楼层回复作者，切换子贴会清空主楼层作者筛选
- 主楼层、内联回复与独立回复串中的作者头像可进入对应用户主页
- 楼层卡片正确渲染 Markdown 内容
- 任意子贴正文、主楼层与楼中楼回复均保留首部、中间和尾部的连续空段；历史原始空行按兼容规则恢复，长内容仍使用“展开全文”且展开后留白数量不变
- 未登录用户可浏览公开帖，不能发帖
- 登录且通过访问校验即可发帖；公开帖发言即参与，已有玩家可退出玩家身份
- 私密帖楼主可生成邀请链接，受邀用户可预览并加入；已加入用户重复打开邀请直接进入帖子
- 公开帖不提供手动加入，玩家可退出玩家身份
- 发布新楼层
- 浏览态不挂载 Milkdown，点击发表/回复/编辑后才出现编辑器
- 详情页任意时刻最多存在一个 MilkdownEditor
- 楼层与楼中楼的创建、回复、编辑统一使用 MilkdownEditor
- 切换目标时保护未提交内容，提交期间禁止切换
- 点赞/取消点赞实时更新 likeCount
- 不同用户分别按 `isLiked` 正确展示和切换点赞状态
- 点赞按钮保持“点赞”的稳定可访问名称，以说明关联当前计数，并通过 `aria-pressed` 暴露选中状态
- thread 不存在时显示 404
- 所有错误状态有 toast 或内联提示
- 帖主看到「管理」按钮（非帖主不显示）
- 详情头部不再显示独立「编辑」、邀请或删除按钮；管理入口进入 `/threads/[id]/edit` workspace 并默认打开「帖子设置」页签
- 管理台顶栏显示当前身份、计数、持续保存状态和当前页保存按钮；帖子/子贴支持 `Ctrl/Cmd+S`
- 帖子设置保存后停留在管理台；协作者看到只读可见性和能力边界，楼主在同页管理私密邀请与删除
- 切页签、切子贴、返回帖子、工作区链接、浏览器后退或刷新前保护未保存内容；写入与上传期间锁定离开
- 管理 URL 可刷新恢复：`?view=subthreads&subthread={id}` 与 `?view=members`；非法子贴安全回落并规范化
- 主帖正文仅在「帖子设置」编辑，子贴内容页不重复挂载主帖编辑器
- 子贴内容：左侧章节目录 + 右侧单例编辑器；已有子贴的标题和发帖权限在正文画布上方内联编辑
- 子贴内容：创建后自动选中聚焦，删除后选择相邻项；元数据与正文由顶栏联合保存并保留部分成功状态
- 子贴内容：鼠标和键盘拖拽排序（@dnd-kit + useReorderSubthreads），失败时回滚并显示状态
- 成员权限：表格搜索筛选、独立的协作权限/玩家标记、协作者任免确认、逐行 pending 与乐观失败回滚
- 帖子或子贴版本冲突保留本地输入，并提供复制本地正文与确认后载入最新版本
- 子贴目录不展示默认主贴；排序请求自动保留默认子贴首位
- 排头卡内的子贴目录菜单支持几十个子贴：当前项明确、显示各子贴楼层数、纵向滚动且不占用正文上方横向空间；菜单两侧游标循环切换上一个/下一个子贴
- 消息/站内链接定位取消移动动画，仅高亮目标楼层或楼中楼回复卡片
- 头部可打开帖内搜索，覆盖全部子贴与楼中楼并支持游标加载更多
- 搜索结果可切换到所属子贴并精确定位；楼中楼直达独立讨论页
- 帖内搜索与全站搜索复用结果列表和导航协议，同时继承私密帖/草稿权限
- 登录发帖自动进入参与人候选池；玩家身份通过邀请链接加入，并可主动退出
- 元数据人数显示 `_count.players`（被授予玩家身份者），非候选池总数
- 创建楼层/楼中楼提交稳定 clientRequestId
- 相同内容网络重试复用 UUID，修改内容后使用新 UUID

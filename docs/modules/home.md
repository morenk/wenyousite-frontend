# 首页模块

## 1. 目标与范围

实现主题帖列表首页和标签主题帖列表，展示公开的已发布主题帖，支持分页加载，以及分类、排序和状态组合筛选。

**当前能力：**
- 主题帖列表（分页）
- 发现流隐藏已注销楼主的历史帖子
- ThreadCard 卡片组件
- 分类筛选 Tab
- 排序筛选（最新创建、最新回复、智能排序）
- 状态筛选（全部状态、招募中、已停招、已结束）
- 主题帖标签可点击，并通过稳定标签 ID 查看该标签下的帖子
- PC Web 布局
- 全局应用壳中的创建、搜索、收藏与账户快捷入口

## 2. 页面与路由

| 路由 | 页面说明 | 权限 |
|------|----------|------|
| `/` | 首页主题帖列表 | 公开 |
| `/tags/[id]` | 指定标签下的公开主题帖列表 | 公开 |

## 3. 涉及 API

| Method | Path | Guard | 用途 |
|--------|------|-------|------|
| GET | `/threads` | OptionalAuth | 获取公开已发布主题帖列表；支持 `category`、`sort`、`status`、`tagId` 组合筛选 |
| GET | `/tags` | Public | 获取平台标签列表（可选，分类筛选用） |
| GET | `/tags/:id` | Public | 获取标签名称，用于标签主题帖页标题与不存在状态 |

## 4. 状态管理

| 状态 | 来源 | 管理方式 |
|------|------|----------|
| 帖子列表 | `GET /threads` | TanStack Query `useInfiniteQuery` |
| 当前标签 | `GET /tags/:id` + 路由参数 | TanStack Query `useQuery`；标签 ID 进入主题帖列表 query key |
| 当前分类 | URL `category` | nuqs 类型化解析；非法值回退全部 |
| 当前排序 | URL `sort` | nuqs 类型化解析；默认 `recommended` 且默认值不写入 URL |
| 当前状态 | URL `status` | nuqs 类型化解析；非法值回退全部状态 |
| 分页 cursor | 后端返回 | react-query 自动管理 |
| 用户信息 | AuthContext | 用于显示"创建"、"草稿箱"等入口 |

公开浏览列表离开页面后保留 30 分钟缓存。筛选变化时继续展示上一组已完成内容，并用列表顶部细进度线表达更新；新结果到达前暂停无限滚动，避免为旧筛选继续翻页。

`GET /threads` 由服务端保证只返回未注销楼主的帖子。Web 用户完成自身账号注销后会立即移除 `threads` 发现分页缓存，避免返回首页时短暂闪回旧帖；`search` 缓存保持独立，不会回填发现流。

## 5. 组件清单

| 组件 | 路径 | 说明 |
|------|------|------|
| HomePage | `src/app/page.tsx` | 首页主逻辑；紧凑排头合并标题与筛选工具，不显示解释性副标题 |
| AppChrome | `src/components/layout/app-chrome.tsx` | 根据路由切换社区三栏、工作区双栏和认证页布局 |
| AppContextRail | `src/components/layout/app-context-rail.tsx` | 宽屏账户主页、钱包、通知/私聊未读数、收藏、设置和访客入口；不重复分类筛选 |
| TagThreadsPage | `src/app/tags/[id]/page.tsx` | 指定标签主题帖列表，复用首页筛选和无限滚动 |
| ThreadList | `src/components/thread/thread-list.tsx` | 首页、标签页和个人资料主题帖共用的 Panel 外框、行分隔、四态与无限滚动 |
| ThreadCard | `src/components/thread/thread-card.tsx` | 首页、搜索与个人资料创建/参与/收藏列表共用的完整主题帖卡片；所有入口消费同一基础生成类型 |
| ThreadCover | `src/components/thread/thread-cover.tsx` | 首页与搜索共用的半宽 16:9 单封面，支持 feed 衍生图回退 |
| TopicTagLink | `src/components/thread/topic-tag-link.tsx` | 卡片与详情页共用的标签浏览入口 |

分类元数据不包含颜色字段，界面只通过文字或 neutral Badge 显示分类，不渲染色块或线路；可点击主题标签统一保留 `#`、Web 32px 命中高度，并消费 Foundation 的粉色品牌色对与悬停态，状态 Badge 使用默认/紧凑尺寸而非页面手写高度。
| CategoryTabs | `src/components/thread/category-tabs.tsx` | 分类筛选 Tab |
| ThreadFilters | `src/components/thread/thread-filters.tsx` | 排序与状态下拉筛选栏 |
| EmptyState | `src/components/shared/empty-state.tsx` | 空状态提示 |

## 6. ThreadCard 卡片信息

每张卡片展示：

首页使用社区应用壳：1024px 起显示 72px 紧凑导航和最大 672px feed；1280px 起切换为 272px 完整导航、672px feed 与 272px 上下文栏。主题帖以单一白色面板内的连续列表行展示；作者、时间、分类和状态位于紧凑元数据区，列表行之间使用细分隔线，不为每行重复常驻阴影。右侧上下文栏只提供账户快捷信息，不重复顶部分类筛选。

| 字段 | 来源 | 格式 |
|------|------|------|
| 标题 | thread.title | 文本 |
| 分类 | thread.category + `GET /thread-categories` | 动态 slug → 管理员配置的名称与顺序；空值/未知值安全降级 |
| 正文预览 | 默认子贴正文（kind=BODY） | 紧凑纯文本（实体单遍解码、连续空白折叠，最多约 100 字） |
| 正文封面 | thread.coverImages[0] | 标题下方只展示默认主贴正文中的第一张普通图片，按半宽 16:9 裁切预览 |
| 标签 | thread.topicTags[] | 可点击标签徽章，进入 `/tags/{tag.id}` |
| 状态 | thread.status | 招募中/已停招/已结束 |
| 玩家数 | thread._count.players | 数字（被楼主授予玩家身份者） |
| 楼层数 | thread._count.posts | 数字 |
| 作者 | thread.owner | 头像母版（无则首字符占位）+ 用户名 + Lv.等级 |
| 创作激励 | thread.tipTotal | 公开累计获得温油总额（整数升） |
| 最后活跃 | thread.updatedAt | date-fns 相对时间 |

## 7. 分页策略

- 使用 cursor-based 分页。
- 每次请求 20 条。
- 滚动到底部自动加载下一页（`IntersectionObserver`）。
- 加载更多时显示 spinner。
- **推荐排序（recommended）分类筛选去重**：后端智能排序活跃度纳入回复、点赞、浏览和累计获得温油，再按主题帖年龄衰减；全局 Redis ZSET 按「已消费可见帖数」累进分页（前缀扫描 + 可见帖切片，每帖只出现一次）。前端 `ThreadList` 渲染前按 `thread.id` 兜底去重，防御任何来源（历史缓存/后端异常）的重复 id，确保同一帖不渲染多次。
- 排序参数：`newest`=最新创建，`active`=最新回复，`recommended`=智能排序（默认）。
- 状态参数：不传表示全部状态；`RECRUITING`=招募中，`CLOSED`=已停招，`FINISHED`=已结束。
- 标签 ID、分类、排序和状态都进入 `useThreads` 的 query key；切换任一筛选条件会得到独立分页缓存。
- 首页分类、排序与状态使用 nuqs 同步到 URL，并写入浏览历史；链接可分享，刷新以及浏览器前进/后退均能恢复筛选。
- 标签页使用相同的 URL 筛选规则。返回首页或标签页时，缓存的分页内容会先重建原列表高度，再由浏览器恢复滚动位置。
- 公开列表缓存新鲜期为 60 秒、离页保留期为 30 分钟；写操作继续通过 query invalidation 主动刷新。主题卡片在悬停、聚焦或按下指针时只预取无浏览计数副作用的默认子贴首屏楼层，绝不预取会增加浏览量的详情接口。
- 中文标题使用本地打包的 LXGW WenKai，界面正文使用 Noto Sans SC Variable，数字与短标签使用 Nunito Variable；运行时不请求外部字体服务。

## 8. 错误处理

| 错误码 | 场景 | UI 行为 |
|--------|------|---------|
| 网络错误 | fetch 失败 | 显示错误提示 + 重试按钮 |
| 空列表 | 无数据 | 显示 EmptyState "还没有主题帖" |
| 标签不存在 | `GET /tags/:id` 失败 | 显示“标签不存在”并提供返回发现入口 |

## 9. 权限与访问控制

| 场景 | 处理 |
|------|------|
| 未登录 | 正常浏览列表，隐藏"创建"入口 |
| 已登录 | 宽屏左栏用文楷“发布”按钮统一提供“发布主题帖 / 发布动态”，个人快捷入口集中到右栏；右栏隐藏时个人入口回到左侧图标轨道 |

## 10. 验收标准

- 首页加载并显示主题帖列表
- 首页、标签页与各排序都不展示已注销楼主的历史帖
- 卡片正确显示标题、分类、正文摘要、标签
- 分类筛选 Tab 可切换列表
- 最新创建、最新回复、智能排序可切换列表
- 全部状态、招募中、已停招、已结束可筛选列表
- 分类、排序和状态可组合使用
- 首页筛选同步到 URL，刷新、分享和浏览器前进/后退均可恢复
- 多页阅读后进入详情再后退，恢复筛选、已加载内容与原滚动位置
- 筛选切换期间保留旧列表、显示更新反馈且暂停旧列表翻页
- 滚动到底部自动加载更多
- 空列表显示空状态
- 网络错误显示重试
- 登录/未登录显示不同入口
- 卡片和详情页标签可进入稳定标签路由
- 标签页仅展示精确关联该标签的公开已发布主题帖，并可继续组合筛选
- 标签不存在时显示明确错误状态
- 首页与标签页使用纯白阅读表面、语义 PageShell 和连续信息列表，不渲染分类色块
- 首页排头只显示“发现主题帖”和实际筛选控件，不用说明文字重复解释筛选能力
- 1024/1440/1920px 具有确定性 Playwright 视觉基线，宽屏保持 272px 导航 + 672px feed + 272px 上下文栏

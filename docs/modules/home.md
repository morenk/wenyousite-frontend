# 首页模块

## 1. 目标与范围

实现主题帖列表首页，展示公开的已发布主题帖，支持分页加载，以及分类、排序和状态组合筛选。

**本次迭代范围（Phase 3）：**
- 主题帖列表（分页）
- ThreadCard 卡片组件
- 分类筛选 Tab
- 排序筛选（最新创建、最新回复、智能排序）
- 状态筛选（全部状态、招募中、已停招、已结束）
- PC Web 布局
- 登录状态下的快捷入口（创建帖、草稿箱）

**后续迭代：**
- 搜索栏集成
- 置顶帖特殊展示

## 2. 页面与路由

| 路由 | 页面说明 | 权限 |
|------|----------|------|
| `/` | 首页主题帖列表 | 公开 |

## 3. 涉及 API

| Method | Path | Guard | 用途 |
|--------|------|-------|------|
| GET | `/threads` | Public | 获取公开已发布主题帖列表；支持 `category`、`sort`、`status` 组合筛选 |
| GET | `/tags` | Public | 获取平台标签列表（可选，分类筛选用） |

## 4. 状态管理

| 状态 | 来源 | 管理方式 |
|------|------|----------|
| 帖子列表 | `GET /threads` | TanStack Query `useInfiniteQuery` |
| 当前分类 | 用户选择 | useState |
| 当前排序 | 用户选择 | useState，默认 `recommended` |
| 当前状态 | 用户选择 | useState，默认全部状态 |
| 分页 cursor | 后端返回 | react-query 自动管理 |
| 用户信息 | AuthContext | 用于显示"创建"、"草稿箱"等入口 |

## 5. 组件清单

| 组件 | 路径 | 说明 |
|------|------|------|
| HomePage | `src/app/page.tsx` | 首页主逻辑 |
| ThreadList | `src/components/thread/thread-list.tsx` | 列表容器 |
| ThreadCard | `src/components/thread/thread-card.tsx` | 主题帖卡片 |
| CategoryTabs | `src/components/thread/category-tabs.tsx` | 分类筛选 Tab |
| ThreadFilters | `src/components/thread/thread-filters.tsx` | 排序与状态下拉筛选栏 |
| EmptyState | `src/components/shared/empty-state.tsx` | 空状态提示 |

## 6. ThreadCard 卡片信息

每张卡片展示：

| 字段 | 来源 | 格式 |
|------|------|------|
| 标题 | thread.title | 文本 |
| 分类 | thread.category | 枚举 → 中文（演绎/国策/RPG） |
| 正文预览 | 默认子贴正文（kind=BODY） | Markdown 纯文本截断（~120 字） |
| 标签 | thread.topicTags[] | 标签徽章 |
| 状态 | thread.status | 招募中/已停招/已结束 |
| 玩家数 | thread._count.players | 数字（被楼主授予玩家身份者） |
| 楼层数 | thread._count.posts | 数字 |
| 作者 | thread.owner | 头像（`_thumb.webp`，无则首字符占位）+ 用户名 |
| 最后活跃 | thread.updatedAt | date-fns 相对时间 |

## 7. 分页策略

- 使用 cursor-based 分页。
- 每次请求 20 条。
- 滚动到底部自动加载下一页（`IntersectionObserver`）。
- 加载更多时显示 spinner。
- **推荐排序（recommended）分类筛选去重**：后端智能排序用全局 Redis ZSET 按「已消费可见帖数」累进分页（前缀扫描 + 可见帖切片，每帖只出现一次）。前端 `ThreadList` 渲染前按 `thread.id` 兜底去重，防御任何来源（历史缓存/后端异常）的重复 id，确保同一帖不渲染多次。
- 排序参数：`newest`=最新创建，`active`=最新回复，`recommended`=智能排序（默认）。
- 状态参数：不传表示全部状态；`RECRUITING`=招募中，`CLOSED`=已停招，`FINISHED`=已结束。
- 分类、排序和状态都进入 `useThreads` 的 query key；切换任一筛选条件会得到独立分页缓存。

## 8. 错误处理

| 错误码 | 场景 | UI 行为 |
|--------|------|---------|
| 网络错误 | fetch 失败 | 显示错误提示 + 重试按钮 |
| 空列表 | 无数据 | 显示 EmptyState "还没有主题帖" |

## 9. 权限与访问控制

| 场景 | 处理 |
|------|------|
| 未登录 | 正常浏览列表，隐藏"创建"入口 |
| 已登录 | 显示顶部"创建主题帖"和"草稿箱"入口 |

## 10. 验收标准

- [x] 首页加载并显示主题帖列表
- [x] 卡片正确显示标题、分类、正文摘要、标签
- [x] 分类筛选 Tab 可切换列表
- [x] 最新创建、最新回复、智能排序可切换列表
- [x] 全部状态、招募中、已停招、已结束可筛选列表
- [x] 分类、排序和状态可组合使用
- [x] 滚动到底部自动加载更多
- [x] 空列表显示空状态
- [x] 网络错误显示重试
- [x] 登录/未登录显示不同入口
- [x] `pnpm lint && pnpm typecheck && pnpm build` 通过

## 11. 子任务

- [x] 编写模块设计文档 `docs/modules/home.md`
- [x] 实现 ThreadCard 组件
- [x] 实现 ThreadList 组件（含无限滚动）
- [x] 实现 CategoryTabs 组件
- [x] 实现 ThreadFilters 排序与状态下拉筛选组件
- [x] 实现 EmptyState 组件
- [x] 集成 TanStack Query `useInfiniteQuery`
- [x] 更新首页 page.tsx
- [x] 同步更新文档
- [x] lint / typecheck / build 通过

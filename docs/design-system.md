# Web 设计基础接入

状态：`active`

跨端审美、共享 Token、字体角色和编辑器能力的唯一事实源是公开仓库
[`morenk/wenyousite-foundation`](https://github.com/morenk/wenyousite-foundation)。本仓库由
[`foundation.lock.json`](../foundation.lock.json) 固定到 `v3.1.0`，实现前必须读取同版本的：

- [`docs/foundation.md`](https://github.com/morenk/wenyousite-foundation/blob/v3.1.0/docs/foundation.md)
- [`docs/platforms/web.md`](https://github.com/morenk/wenyousite-foundation/blob/v3.1.0/docs/platforms/web.md)
- [`docs/images.md`](https://github.com/morenk/wenyousite-foundation/blob/v3.1.0/docs/images.md)
- [`docs/icons.md`](https://github.com/morenk/wenyousite-foundation/blob/v3.1.0/docs/icons.md)
- [`docs/notifications.md`](https://github.com/morenk/wenyousite-foundation/blob/v3.1.0/docs/notifications.md)
- [`docs/interaction.md`](https://github.com/morenk/wenyousite-foundation/blob/v3.1.0/docs/interaction.md)
- [`docs/navigation-language.md`](https://github.com/morenk/wenyousite-foundation/blob/v3.1.0/docs/navigation-language.md)
- [`contracts/foundation.v1.json`](https://github.com/morenk/wenyousite-foundation/blob/v3.1.0/contracts/foundation.v1.json)

本地只保留实现映射，不复制规范：

- `src/app/layout.tsx` 引入中央字体与 Token CSS，`globals.css` 只做 Tailwind 映射和 Web 组件样式。
- `src/lib/editor-capabilities.ts` 是中央编辑器契约的薄转发层。
- `src/components/ui/wenyou-icon.tsx` 根据产品语义渲染 Foundation 同源 Lucide 节点；Crepe 顶栏消费相同来源生成的 SVG 字符串，并在 Web 接入边界覆盖其默认实心 `fill`，保持 Lucide 无填充描边。
- 编辑器使用 Foundation 的 50rem 框架承载工具栏，但正文块固定为 680px 测量宽度；正文 24px 首列偏移与工具栏 12px 外层加首控件 12px 内缩共用基线。
- `src/components/ui/` 与 `src/components/layout/` 承担 Web 原语和页面骨架。
- 发现、动态与搜索使用 `PageHeader compact`：标题和紧随其后的筛选、切换或搜索工具收在同一紧凑面板，不用副标题重复解释页面名称。
- 列表容器与列表项按 Foundation `experiences.collections` 占满分配列；消息气泡、标签、徽标与紧凑操作是内容宽度例外。
- 核心导航、操作、编辑器能力和常见状态使用 Foundation 语义图标；图标型操作统一通过共享 `Tooltip` 补足悬停/聚焦说明；全局 Provider 使用短延迟并保留可访问名称，不能以 `title` 属性或仅悬停内容替代按钮的 `aria-label`。
- 二态互动统一通过 `InteractionToggle` 消费 Foundation `iconControls`：未选中使用 `mutedForeground` 描边；点赞后使用鲜粉 `like` 实心心形与 `likeSoft` 底，收藏后使用金色 `bookmark` 实心书签与 `bookmarkSoft` 底；计数和文字始终保持 `foreground`。通用选中态使用 `accent`，危险操作继续使用 destructive 语义。请求中保留提交前视觉和焦点能力，以 loading 图标、`aria-busy` 与 `aria-disabled` 阻止重复提交；按钮名称稳定为动作词，数量置于可访问说明并用 `aria-pressed` 表示状态。
- 页面标题、区块标题、正文、标签和说明消费 Foundation 语义排版 Token；加载、空结果、失败和 Mutation pending 遵循 `interaction` 契约。
- Sticky、应用框架、悬浮操作、菜单、模态、Tooltip、模态内浮层和全局进度消费 Foundation layer Token，业务组件不写任意全局 z-index。
- 导航标签、目的地图标及稳定动作词直接消费 `navigation` 与 `language` 导出，路由地址仍由 Web 拥有。
- 社区页在 `1024–1279px` 居中排列 72px 导航轨与 42rem 内容栏，`1280px` 起再展开左右 17rem 侧轨，避免隐藏右轨后内容栏仍向右偏移；该断点只服务 PC Web，不引入移动端布局契约。
- 功能性过渡由全局 Motion Provider 遵循 `prefers-reduced-motion`；原生滚动行为也必须单独读取同一偏好，不能只依赖动画组件降级。
- 分类名称、排序和可选颜色等业务数据仍由 `GET /thread-categories` 提供，不进入设计基础仓库。
- `pnpm design:check` 同时校验版本锁、中央产物消费和业务 UI 静态约束。

需要新增共享语义时，先在基础仓库修改契约、生成产物并发布新标签，再升级本仓库锁文件；只影响 Web 的实现细节记录在对应 `docs/modules/` 文档。

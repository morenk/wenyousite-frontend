# Web 设计基础接入

状态：`active`

跨端审美、共享 Token、字体角色和编辑器能力的唯一事实源是公开仓库
[`morenk/wenyousite-foundation`](https://github.com/morenk/wenyousite-foundation)。本仓库由
[`foundation.lock.json`](../foundation.lock.json) 固定到 `v6.6.1`，实现前必须读取同版本的：

- [`docs/foundation.md`](https://github.com/morenk/wenyousite-foundation/blob/v6.6.1/docs/foundation.md)
- [`docs/platforms/web.md`](https://github.com/morenk/wenyousite-foundation/blob/v6.6.1/docs/platforms/web.md)
- [`docs/brand.md`](https://github.com/morenk/wenyousite-foundation/blob/v6.6.1/docs/brand.md)
- [`docs/elements.md`](https://github.com/morenk/wenyousite-foundation/blob/v6.6.1/docs/elements.md)
- [`docs/images.md`](https://github.com/morenk/wenyousite-foundation/blob/v6.6.1/docs/images.md)
- [`docs/icons.md`](https://github.com/morenk/wenyousite-foundation/blob/v6.6.1/docs/icons.md)
- [`docs/notifications.md`](https://github.com/morenk/wenyousite-foundation/blob/v6.6.1/docs/notifications.md)
- [`docs/interaction.md`](https://github.com/morenk/wenyousite-foundation/blob/v6.6.1/docs/interaction.md)
- [`docs/presentation.md`](https://github.com/morenk/wenyousite-foundation/blob/v6.6.1/docs/presentation.md)
- [`docs/navigation-language.md`](https://github.com/morenk/wenyousite-foundation/blob/v6.6.1/docs/navigation-language.md)
- [`contracts/foundation.v1.json`](https://github.com/morenk/wenyousite-foundation/blob/v6.6.1/contracts/foundation.v1.json)

本地只保留实现映射，不复制规范：

- `src/app/layout.tsx` 引入中央字体与 Token CSS，`globals.css` 只做 Tailwind 映射和 Web 组件样式。
- 根布局在 hydration 前运行由中央偏好与调色板生成的静态脚本；默认跟随系统，`ThemeProvider` 负责运行时解析、跨标签页同步、`color-scheme`、浏览器主题色与 Sonner 主题。显式偏好只以 `wenyousite-theme` 保存在当前浏览器，不进入账号资料。
- `ThemeMenu` 在社区/工作区全局导航和认证/站务壳右上角提供“跟随系统、亮色、黑夜”原生单选组；键盘选择即时生效，不发送请求或成功 Toast。
- 根布局直接消费 Foundation 的正式品牌名称与文案；侧栏首页入口使用相邻可见名称与装饰性标题标识。favicon、Apple touch icon、PWA 图标、标题标识和 Web Manifest 由 `pnpm brand:sync` 从锁定包同步，并由 `pnpm design:check` 逐项校验哈希。
- 标题标识在亮色保留原资源，在黑夜通过同一透明轮廓蒙版映射 `brandStrong`；正文图片、头像、封面和外部资源不做反色或全局亮度滤镜。
- `src/lib/editor-capabilities.ts` 是中央编辑器契约的薄转发层。
- `src/components/ui/wenyou-icon.tsx` 根据产品语义渲染 Foundation 同源 Lucide 节点；Crepe 顶栏消费相同来源生成的 SVG 字符串，并在 Web 接入边界覆盖其默认实心 `fill`，保持 Lucide 无填充描边。
- 编辑器使用 Foundation 的 50rem 框架承载工具栏，但正文块固定为 680px 测量宽度；正文 24px 首列偏移与工具栏 12px 外层加首控件 12px 内缩共用基线。
- `src/components/ui/` 与 `src/components/layout/` 承担 Web 原语和页面骨架。
- 发现、动态与搜索使用 `PageHeader compact`：标题和紧随其后的筛选、切换或搜索工具收在同一紧凑面板，不用副标题重复解释页面名称。
- 列表容器与列表项按 Foundation `experiences.collections` 占满分配列；消息气泡、标签、徽标与紧凑操作是内容宽度例外。
- 列表负责扫描和进入，标题统一使用 Noto Sans SC 600；详情负责连续阅读，内容标题使用 LXGW WenKai 500。文楷只用于品牌、页面/区块结构标题、详情内容标题和文字封面，不用于弹层、状态、导航、控件、用户名、计数或富文本标题。
- `WenyouTime` 统一列表与详情时间：72 小时内显示“刚刚 / N 分钟前 / N 小时前 / N 天前”，之后同年显示 `MM-dd HH:mm`、跨年显示 `yyyy-MM-dd HH:mm`，完整本地时间写入 `title`。`WenyouCount` 从一万起使用“万/亿”紧凑值，并向辅助技术保留精确数字。
- 核心导航、操作、编辑器能力和常见状态使用 Foundation 语义图标；图标型操作统一通过共享 `Tooltip` 补足悬停/聚焦说明；全局 Provider 使用短延迟并保留可访问名称，不能以 `title` 属性或仅悬停内容替代按钮的 `aria-label`。
- 二态互动统一通过 `InteractionToggle` 消费 Foundation `iconControls`：未选中使用 `mutedForeground` 描边；选中态始终保持容器透明，只让点赞的实心心形变为鲜粉 `like`、收藏的实心书签变为金色 `bookmark`、官方更新订阅的实心铃铛变为品牌深紫 `brandStrong`。计数和文字保持中性 `foreground`。hover、focus 与 pressed 只在图标命中区显示同色圆形瞬时状态层，不能重新给整个按钮添加柔和底色；危险操作继续使用 destructive 语义。请求中保留提交前视觉和焦点能力，以 loading 图标、`aria-busy` 与 `aria-disabled` 阻止重复提交；按钮名称稳定为动作词，状态和数量置于可访问说明并用 `aria-pressed` 表示。
- 收藏、订阅、关注、拉黑、归档等轻量状态操作由 pending 与更新后的控件/列表状态反馈成功，不再重复弹出成功 Toast；失败仍使用错误 Toast。金额或奖励结果、复制、发布删除、消息决策、安全与站务操作等需要补充结果信息的反馈继续保留。
- 正文与元数据元素统一消费 Foundation `experiences.elements`：传送门使用同源门图标和可换行轻量胶囊；普通链接保留下划线，提及保留 `@`，行内代码、骰子、引用和分隔线使用 `--element-*`。引用在编辑态和发布态都映射为占满可用正文宽度的“书签纸条”：`muted` 底色、2px `brandStrong` 起始边标记、只圆结束侧、正文排版继承，裁掉首尾子节点外间距且不生成引号、图标或阴影。正文分隔线在两态都映射为正文可用宽度 50% 的居中 `border` 短线与 5px `brandStrong` 圆点，上下保持 1.75em 节奏，不复用楼层或卡片的满宽边界；编辑态必须覆盖 Crepe 原子选中样式，保证圆点不随下一段是否存在而漂移。骰子以无图标原子节点显示 `{notation} = {total}`，多骰明细保留在完整可访问说明中；待掷显示 `{notation} = ?`。Badge 只有默认/紧凑两档，等级固定 `Lv.N` 并按雾灰、杏桃、玫瑰、珊瑚、深莓五档渐进，未读数隐藏零并封顶 `99+`；可点击主题标签保留 `#` 与 32px 命中区，使用 Foundation 粉色品牌色对，不借用点赞专色。
- 头像缺失或图片失败时显示首个可读字符，匿名或不可用身份显示中性用户图标；邮箱验证状态不进入列表、详情或公开资料，只保留账号安全入口与受限操作引导。
- 分类只使用文字与 neutral Badge 表达，不渲染分类色块或线路；分类 API 不定义颜色字段。
- 页面标题、区块标题、正文、标签和说明消费 Foundation 语义排版 Token；加载、空结果、失败和 Mutation pending 遵循 `interaction` 契约。
- 主要行动按钮消费 `actionPrimary`，柔和容器和选中面消费 `primary`，导航线路、未读点、进度和焦点定位消费 `brandStrong`。Milkdown Crepe、图片查看器、原生表单与 Toast 都映射当前主题语义，避免黑夜模式出现亮白孤岛。
- 可见辅助文案只保留操作后果、输入限制、权限边界、错误恢复和空态引导；不向用户解释格式白名单、服务端结算、编码压缩、存储协议或内部编号，也不重复字段、计数器和按钮已经表达的信息。必要的无障碍名称与隐藏说明继续保留。
- Sticky、应用框架、悬浮操作、菜单、模态、Tooltip、模态内浮层和全局进度消费 Foundation layer Token，业务组件不写任意全局 z-index。
- 导航标签、目的地图标及稳定动作词直接消费 `navigation` 与 `language` 导出，路由地址仍由 Web 拥有。
- 社区页在 `1024–1279px` 居中排列 72px 导航轨与 42rem 内容栏，`1280px` 起再展开左右 17rem 侧轨，避免隐藏右轨后内容栏仍向右偏移；该断点只服务 PC Web，不引入移动端布局契约。
- 功能性过渡由全局 Motion Provider 遵循 `prefers-reduced-motion`；原生滚动行为也必须单独读取同一偏好，不能只依赖动画组件降级。
- 分类名称和排序等业务数据仍由 `GET /thread-categories` 提供，不进入设计基础仓库。
- `pnpm design:check` 同时校验版本锁、中央产物消费和业务 UI 静态约束。

需要新增共享语义时，先在基础仓库修改契约、生成产物并发布新标签，再升级本仓库锁文件；只影响 Web 的实现细节记录在对应 `docs/modules/` 文档。

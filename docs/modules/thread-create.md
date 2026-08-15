# 创建主题帖模块

## 1. 目标与范围

实现用户创建并发布主题帖的完整前端流程：进入创建页先看到未发布草稿列表，可继续编辑或点击「新建主题帖」进入编辑器（自动创建沙盒草稿），编辑标题/分区/可见性/标签与默认子贴正文，保存草稿，最终发布。

**当前能力：**
- 创建主题帖页面 `/threads/create`（**双模式：先草稿列表，点「新建」再进编辑器**）
- 草稿列表：未发布帖（标题/分类/更新时间/继续编辑/删除），空态「还没有主题帖草稿」并说明如何新建
- 草稿列表「继续编辑」进入 `/threads/:id/edit` 时按 `published` 分流：未发布草稿仍使用 `ThreadCreateForm`，保留「保存草稿」与最终「发布」按钮；不能误用仅有「保存修改」的已发布帖表单
- 点「新建主题帖」后自动创建沙盒草稿
- 草稿创建只允许由「新建主题帖」点击处理函数直接发起，并使用同步点击锁；渲染和 effect 均不发起 `POST /threads`。同一次点击及网络失败后的人工重试复用同一个 UUID `clientRequestId`，成功或返回草稿列表后才清除，避免响应丢失、Strict Mode 重放或连点生成重复草稿。
- 表单编辑：标题、分区、可见性、主题帖标签，以及可混排内联骰子节点的默认子贴正文
- Milkdown Crepe WYSIWYG 编辑器（PC 宽栏平铺常用能力、溢出时自适应收纳到“更多” + 所见即所得渲染 + 字数统计 + 正文草稿入口）
- Milkdown 输出协议：独占行 `<br />`（含历史变体）规范化并原样保存，用于精确保留手动空行；空图片语法清理，工具栏外格式静默转成可见字面文本
- 图片上传期间仅锁定提交/取消操作，不把编辑器切换为只读，避免 Crepe 重建顶栏；编辑器内固定显示准备、真实已传/总字节、百分比和处理状态，并可取消当前上传；若第三方内部仍替换顶栏节点，当前编辑器宿主会重新同步可见性与中文标签，多编辑器页面之间互不影响
- 编辑器支持私有表情面板；面板通过视口级 Portal 浮在编辑器外壳上方，不受外壳圆角裁切，表情较多时只滚动内部网格且不向页面传递滚动，并在当前光标插入最大 128px 的原子节点；普通图片只允许选择本地文件上传，隐藏外部图片 URL 输入
- 编辑器 `@` 候选只包含“我关注的人 + 帖内标记玩家”；楼主/协作者额外拥有 `@全体玩家`
- 发布校验：纯空白、仅空段落或仅分隔线不可发布；图片、普通列表、裸 HTTP(S) URL、CommonMark 自动链接等非空内容可发布；未转义的白名单外格式由后端拒绝
- 保存草稿与发布统一调用聚合端点（`PATCH /threads/:id/aggregate`），元数据、默认子贴标题/正文、标签和发布状态在同一数据库事务中提交
- 正文内联骰子节点由服务端在同一发布事务中统一结算
- 发布后跳转详情页 `/threads/[id]`
- 放弃创建时删除草稿并返回草稿列表（`DELETE /threads/:id`）

进入创建页先展示草稿列表和「新建主题帖」按钮，点击新建后才进入编辑器。全局导航不单列草稿入口；主题帖草稿在创建页管理，正文草稿在编辑器工具栏管理。

**设计边界：**
- 创建页**仅管理默认子贴正文**，不做多子贴 / 楼层管理（保持简洁）
- 多子贴创建与管理移至**详情页管理面板**（见 `docs/modules/thread-detail.md`）：左子贴目录树 + 右单例编辑器 + 拖拽排序

## 2. 页面与路由

| 路由 | 页面说明 | 权限 |
|------|----------|------|
| `/threads/create` | 创建主题帖页 | 需登录且邮箱已验证 |

创建页和未发布草稿编辑页使用 `workspace` 宽内容骨架；左侧导航只压缩为 72px 图标轨道，不增加浏览页宽屏已收进右侧账户栏的个人快捷按钮。

## 3. 涉及 API

| Method | Path | Guard | 用途 |
|--------|------|-------|------|
| POST | `/threads` | Auth | 创建沙盒草稿（事务创建 Thread + OWNER + 默认子贴） |
| GET | `/threads/:id` | AuthRead | 获取草稿最新数据（含 subthreads[].bodyPost: {id,content,version} 正文信息（kind=BODY），供编辑器回填和乐观锁编辑） |
| PATCH | `/threads/:id/aggregate` | Auth | 原子保存元数据、默认子贴标题/正文、标签和发布状态 |
| PATCH | `/threads/:id` | Auth | 细粒度元数据更新（其他管理入口兼容；创建表单不再使用） |
| DELETE | `/threads/:id` | Auth | 放弃创建，删除草稿 |
| GET | `/thread-categories` | Public | 获取管理员配置并排序的启用分类；表单保存稳定 `slug` |
| PUT | `/subthreads/:subthreadId/body` | Auth | 非默认子贴管理时单独 upsert 正文；创建表单改用聚合端点 |
| GET | `/tags?q=` | Public | 标签自动补全 |
| POST | `/media/upload-url` | Auth | 获取 S3 预签名 URL；**每用户小时配额（默认 60 次）**，超限返回 429 |
| POST | `/media/upload-done` | Auth | 确认上传完成 |
| GET | `/media/:id` | Auth | 轮询图片处理状态 |

> 子贴增删改 / 排序 / 子贴正文管理相关端点（`/subthreads`、`/threads/:id/subthreads/reorder` 等）由详情页管理面板使用，见 `docs/modules/thread-detail.md`。

**响应数据类型说明（与真实 API 对齐）：**
- `ThreadDetail` 的 `_count` 字段为 `{ members, posts }`（非 `{ subthreads, posts }`）。
- 子贴对象通过 `normalizeThreadDetail()` 处理：后端返回 `subthreads` 数组 + `defaultSubthreadId`，前端按 ID 匹配出 `defaultSubthread` 字段。
- 后端 `includeSubthreads` 已带 `bodyPost: { id, content, version, diceRolls }`。草稿期节点保存在 content 内并显示 `?`；发布成功后按 `diceRolls[].nodeId` 在原位置显示正式结果。

## 4. 状态管理

| 状态 | 来源 | 管理方式 |
|------|------|----------|
| 页面模式 | picker / editor | useState（默认 picker，点「新建主题帖」切 editor） |
| 草稿列表 | `GET /threads/draft` | TanStack Query `useQuery`（`queryKeys.threadDrafts`，DraftList 复用） |
| 草稿 Thread | `POST /threads` | 页面本地 state，进入 editor 模式后创建并持久化 threadId |
| 表单字段 | 用户输入 | react-hook-form |
| 标签候选 | `GET /tags?q=` | TanStack Query + 本地 debounce |
| 可用分类 | `GET /thread-categories` | Query 缓存 5 分钟；Provider 只挂在社区壳和主题帖创建/编辑工作区，认证与消息工作区不额外请求；按服务端顺序显示，未知/停用值只作历史降级 |
| 发布 loading | 提交中 | useState |
| 编辑器完整 Markdown | Milkdown listener + 内联骰子节点插件 | 单一 content 受控状态，正文与节点共同保存 |

**草稿生命周期：**
- 进入 `/threads/create` 默认展示**草稿列表**（`picker` 模式），含「新建主题帖」按钮；无草稿时显示「还没有主题帖草稿」和新建操作说明。
- 点「新建主题帖」切到 `editor` 模式并 `POST /threads`，请求只携带默认可见性和稳定 UUID `clientRequestId`，不预选分类、不发送空 `title`；草稿可在后续编辑时选择管理员当前启用的分类。
- 用户每次修改后通过提交按钮保存，或最终发布时一次性提交。
- 离开编辑器时如果未发布且未保存，草稿保留在 `GET /threads/draft` 中，用户下次进入创建页可在列表继续编辑。
- 从草稿列表继续编辑时，`/threads/:id/edit` 加载详情并依据 `published=false` 渲染发布表单；返回操作仅回到草稿列表，不删除已有草稿。
- 编辑器「放弃」调用 `DELETE /threads/:id` 硬删除并返回草稿列表。

## 5. 组件清单

| 组件 | 路径 | 说明 |
|------|------|------|
| CreateThreadPage | `src/app/threads/create/page.tsx` | 创建页主逻辑（picker/editor 双模式） |
| ThreadDraftPicker | `src/components/thread/thread-draft-picker.tsx` | 草稿选择：标题 + 「新建主题帖」按钮 + 草稿列表 |
| DraftList | `src/components/user/draft-list.tsx` | 未发布帖列表（复用；空态说明如何新建） |
| ThreadCreateForm | `src/components/forms/thread-create-form.tsx` | 主题帖创建表单：基础信息 + 默认子贴正文（简洁模式）；分区、状态、可见性统一复用共享 `Select` |
| EditThreadPage | `src/app/threads/[id]/edit/page.tsx` | 兼容编辑路由：草稿渲染 ThreadCreateForm，已发布帖复用统一 ManagementPanel |
| MilkdownEditor | `src/components/editor/milkdown-editor.tsx` | @milkdown/crepe WYSIWYG 编辑器（骰子/表情内联节点、字数统计、本地图片上传、正文草稿入口） |
| TagInput | `src/components/forms/tag-input.tsx` | 主题帖标签输入（支持自动补全） |
| useCreateThread | `src/api/hooks/use-create-thread.ts` | 创建草稿 hook |
| useThreadCategories | `src/api/hooks/use-thread-categories.ts` | 公开动态分类查询；Web 与 Flutter 均消费稳定 slug |
| useThreadDetail | `src/api/hooks/use-thread-detail.ts` | 获取详情 hook |
| useSaveThreadAggregate | `src/api/hooks/use-save-thread-aggregate.ts` | 单请求原子保存/发布主题帖聚合 |
| useUpdateThread | `src/api/hooks/use-update-thread.ts` | 细粒度元数据更新兼容 hook |
| useDeleteThread | `src/api/hooks/use-delete-thread.ts` | 删除草稿 hook |
| useUpsertBody | `src/api/hooks/use-upsert-body.ts` | 非默认子贴正文的细粒度 upsert hook |
| useUploadImage | `src/api/hooks/use-upload-image.ts` | 图片上传 hook |
| uploadImage | `src/lib/upload-image.ts` | 图片上传流程工具函数 |

> 子贴管理相关组件/hooks（`SubthreadTree`、`ManagementPanel`、`SubthreadCard/List/Form`、`useCreateSubthread` 等）在详情页管理面板中使用，见 `docs/modules/thread-detail.md`。

**编辑器实现说明：**

使用 `@milkdown/crepe`（Milkdown 官方 WYSIWYG 方案），通过 `CrepeFeature` 精确控制功能：

输入 `@` 后，编辑器从 `/users/mention-candidates?threadId=&q=` 拉取候选；单人通过原生链接 Mark 插入并所见即所得显示为 `@用户名`，序列化时才写入 `[@用户名](/users/{userId})`，群体插入 `@全体玩家`。后端在创建和编辑正文时再次校验权限并同步提及快照，前端候选菜单不是安全边界。

候选搜索使用 180ms 防抖，并在中文输入法组合输入期间暂停键盘确认；菜单会依据光标位置在上下方选择可见区域，窄视口限制最大宽度。用户提及在光标末尾按 Backspace 时作为整体删除。

| Feature | 状态 | 说明 |
|---------|------|------|
| TopBar | ✅ | 单行自适应一级栏：PC 宽栏平铺全部常用能力并隐藏“更多”；实际溢出时保留核心能力并显示“更多”，不启用横向滚动 |
| Toolbar | ❌ | 不装载选区浮动工具栏，格式入口集中在固定 TopBar |
| BlockEdit | ❌ | 禁用（以间接编辑为主，移除左侧 +/拖拽按钮） |
| LinkTooltip | ✅ | 链接悬停编辑弹窗，输入框占位符"粘贴链接…" |
| ImageBlock | ✅ | 仅允许本地图片上传，按钮/占位符全中文化；外部图片 URL 输入隐藏 |
| CodeMirror | ❌ | 不装载增强代码编辑器；围栏和缩进代码块静默保留为字面文本 |
| ListItem | ✅ | 普通无序/有序列表在 PC 宽栏直接展示，收纳状态进入“更多”；最多嵌套三层，任务列表保留为字面文本 |
| Placeholder | ✅ | "开始输入…"（可通过 props 自定义） |
| Table | ❌ | 表格不属于正文结构，手写、粘贴和历史异常内容均静默保留为字面文本 |
| Latex | ❌ | 禁用 |
| AI | ❌ | 禁用 |

**中文本地化策略：** 通过 `Crepe` 构造函数的 `featureConfigs` 覆盖所有英文 UI 字符串。
Milkdown Crepe v7 不支持 i18n 插件，所有文本通过各 feature 的 config 对象逐项覆盖。

**中文字体与阅读列：** `src/components/editor/milkdown-editor.css` 使用自托管 Noto Sans SC Variable 作为全部输入正文（包括 Markdown 标题与强调），系统等宽字体作为代码字体。正文为 `17px / 1.9`，粗体使用 700 字重，斜体使用标准 `italic` 样式；缺少斜体字形时仅允许浏览器合成倾斜。编辑器产出的正文不使用 LXGW WenKai，实际输入列与发布结果一致，限制在约 40 个全角字宽。主题帖标题、子帖标题等界面标题仍可使用展示字体。

字数统计：底部实时显示 `{已输入}/10000`，70% 黄色警告，90% 红色警告。

**内容区高度与滚动：** `.ProseMirror` 内容区通过 CSS 变量 `--editor-min-height`（默认 280px）/ `--editor-max-height`（默认 400px）控制：min-height 撑开可视区，使空白处点击可将光标落到文档末尾（ProseMirror 原生 clamp，记事本式落位）；超过 max-height 后内容区出现滚动条，顶部工具栏 fixed 不滚动。编辑器保留 Crepe 的拖拽落点能力，但关闭会重复计算滚动偏移的虚拟光标，统一使用浏览器原生输入光标。组件提供 `maxHeight`/`minHeight` props 按场景覆盖（创建/编辑/管理面板默认 400，发布/编辑楼层传 300）。

编辑区内边距与阅读排版统一位于 `src/components/editor/milkdown-editor.css`；正文和工具栏共享 `50rem` 居中内容列，正文使用 `24px` 水平内边距，工具栏补偿首个控件自身内缩后与正文首列对齐。

顶栏按钮 tooltip：Milkdown Crepe v7 TopBar 不支持 tooltip 配置，宿主在 DOM 就绪及第三方顶栏重建后同步 `title`、无障碍名称和稳定能力 ID，利用浏览器原生 tooltip 实现中文提示。

**Markdown 输入与复制策略：** 工具栏入口就是结构化能力白名单。手写、快捷输入、Markdown/HTML 复制和历史正文中的表格、任务列表、代码块、额外标题、显式硬换行、原始 HTML 与未知协议节点，均按源码行静默转成普通段落；界面显示原字符且再次保存不会解析成结构。HTML 剪贴板优先使用对应纯文本，没有纯文本时只提取文本内容。图片继续受站内媒体规则限制。

**顶栏窄容器策略：** 所有编辑器共用单行左对齐工具栏，直接测量编辑器实际容器，不按主题详情、楼中楼或管理页分别猜断点，也不启用横向滚动。PC 一行容得下时平铺正文样式、粗体、斜体、删除线、行内代码、无序列表、有序列表、链接、图片、引用、分隔线、骰子和正文草稿，同时隐藏“更多”；标准内容栏优先保留链接、引用、分隔线和骰子直达，仅将行内代码、无序列表和有序列表收入“更多”。继续变窄时先收纳正文草稿，再降级为核心栏并收纳删除线与其余次级能力。“更多”使用视口浮层；Flutter 客户端保持固定核心栏与原生底部面板，不照搬 PC 的全量平铺。标题选择菜单同样按视口定位，只提供正文、二级标题和三级标题；其他标题层级作为字面文本处理。

## 6. 表单与校验

校验 schema 放在 `src/lib/validations/thread-create.ts`。

### 创建/编辑主题帖

```ts
const threadCreateSchema = z.object({
  title: z
    .string()
    .max(100, "标题最多 100 个字符")
    .optional(),
  category: z.string().trim().min(1, "请选择分区").optional(),
  visibility: z.enum(["PUBLIC", "PRIVATE"], {
    message: "请选择可见性",
  }),
  tagNames: z
    .array(z.string().min(1).max(20))
    .max(5, "最多 5 个标签")
    .optional(),
  subthreadTitle: z
    .string()
    .min(1, "请输入子贴标题")
    .max(100, "子贴标题最多 100 个字符")
    .optional(),
  content: z
    .string()
    .max(10000, "正文最多 10000 个字符")
    .optional(),
});
```

**发布前预校验（前端）：**
- 标题非空且不是 `"未命名草稿"`
- category 已选择，且 slug 仍存在并处于启用状态
- 正文非空

后端在 `PATCH { published: true }` 时做最终校验，前端以 toast 展示后端 message。

## 7. 错误处理

| 错误码 | 场景 | UI 行为 |
|--------|------|---------|
| 40100 | 未登录 / 缺少认证凭证 | 登录守卫跳转 `/login` |
| 40101 | access token 过期 | apiClient 自动刷新并重放创建请求，保留同一 `clientRequestId` |
| 40300 | 邮箱未验证 | toast "请先验证邮箱后再发布" 并跳转 `/verify-email` |
| 40000 | 字段长度/格式校验失败 | 按字段显示 inline error |
| 40001 | 发布校验失败（缺标题/分区/正文） | toast 后端 message |
| 40900 | 乐观锁冲突 | toast "内容已被修改，请刷新后重试" 并重新获取详情 |
| 40912 | `clientRequestId` 被不同创建载荷复用 | toast 后端冲突提示并返回草稿列表；不得换新键盲重试 |
| 40414 | 所选分类不存在 | 重新加载分类并要求用户重新选择 |
| 40919 | 所选分类或标签已停用 | 保留正文和其他字段，重新加载可用选项 |
| 42900（发帖/保存） | 限流 | toast "操作太频繁，请稍后再试" |
| 42900（图片上传） | 每用户小时上传配额超限 / 全局限流 | `uploadImageFile` 显式映射为 toast "上传图片太频繁，请稍后再试"，编辑器与头像上传统一复用 |
| 网络错误 | fetch 失败 | toast "网络连接失败，请检查网络后重试" |

## 8. 权限与访问控制

| 场景 | 处理 |
|------|------|
| 未登录用户访问 `/threads/create` | 路由 layout 的 `RequireAuth` 等待会话恢复，保留 `next` 跳转登录 |
| 已登录但邮箱未验证 | layout 的 `RequireAuth(requireVerifiedEmail)` 跳转 `/verify-email` |
| 创建草稿失败（网络等） | 显示错误提示，提供重试按钮 |
| 发布时并发冲突 | 重新获取详情刷新 version，用户手动再次发布 |

## 9. 用户流程

### 创建并发布

```
进入 /threads/create 草稿选择器
  ↓ 未登录 → /login
  ↓ 未验证邮箱 → /verify-email
  ↓ 已登录且已验证
点击“新建主题帖”
POST /threads 创建草稿
  ↓ 成功
显示表单（标题/分区/可见性/标签 + 默认子贴正文编辑器）
  ↓ 用户编辑
点击"保存草稿" → PATCH /threads/:id/aggregate { 元数据、标签、默认子贴/正文版本与 content }
  ↓ 成功 toast "草稿已保存"
点击"发布" → 前端校验 → PATCH /threads/:id/aggregate { ..., published: true }
  ↓ 成功 toast "发布成功" 跳转 /threads/:id
  ↓ 失败 按错误码提示
点击"放弃" → 站内无障碍确认框 → DELETE /threads/:id → 返回草稿选择器
```
> 发布后的主题信息、主帖正文、多子贴与成员管理统一使用详情页「管理」面板（见 thread-detail.md）；旧 `/threads/[id]/edit` 链接也会渲染同一管理界面。

## 10. 验收标准

- 进入 `/threads/create` 先展示草稿选择器，仅点击「新建主题帖」才创建草稿
- 未登录用户跳转登录页
- 未验证邮箱用户收到提示并跳转验证页
- 表单可编辑标题、分区、可见性、标签、默认子贴正文
- 创建页保持简洁：不承载多子贴/楼层管理（移至详情页管理面板）
- 标签输入支持自动补全和新建
- 编辑器支持 WYSIWYG 渲染与可见工具栏
- PC 宽栏功能：一行容得下时直接展示正文样式、粗体、斜体、删除线、行内代码、无序列表、有序列表、链接、图片、引用、分隔线、骰子和正文草稿，不显示“更多”
- 收纳状态功能：标准内容栏显示“更多”并只承载行内代码、无序列表和有序列表，链接、引用、分隔线和骰子继续常驻；更窄时再承载正文草稿、删除线及其余次级能力，始终不横向滚动
- 任务列表、代码块、表格和额外标题无论手输、粘贴或重开都显示原字符，且不生成对应结构
- 草稿允许暂不选择分类；发布必须使用 `GET /thread-categories` 返回的启用 slug
- 编辑器正文排版与发布结果一致，默认缩放下使用 17px 正文和真实字重
- 编辑器支持图片上传并插入 Markdown
- 编辑器支持字数统计（70% 黄色 / 90% 红色阈值提示）
- 编辑器不可见空段落不会在发布后显示为字面 `<br />`，普通文本中的 `<br />` 示例不会执行为 HTML
- 阅读端遇到未迁移异常正文时同样不生成表格、代码块、任务复选框或额外标题
- 保存草稿成功更新 Thread 元数据
- 元数据、标签、默认正文与发布状态使用单个聚合请求原子保存
- 发布前校验不满足时提示具体缺项（含默认子贴无正文）
- 发布成功跳转详情页
- 从草稿列表继续编辑时显示「保存草稿」与「发布」，发布后跳转详情页
- 已发布帖编辑页仍只显示「保存修改」，草稿/已发布状态互不混用
- 放弃创建可删除草稿
- 所有错误状态有 toast 提示
- 提交按钮显示 loading 状态
- 编辑区已调整内边距（从 60px/120px 收紧到 20px/32px）
- 顶栏按钮悬浮提示与无障碍名称由宿主同步为中文

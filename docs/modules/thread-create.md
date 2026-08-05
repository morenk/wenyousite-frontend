# 创建主题帖模块

## 1. 目标与范围

实现用户创建并发布主题帖的完整前端流程：进入创建页先看到未发布草稿列表，可继续编辑或点击「新建主题帖」进入编辑器（自动创建沙盒草稿），编辑标题/分区/可见性/标签与默认子贴正文，保存草稿，最终发布。

**本次迭代范围（Phase 4）：**
- 创建主题帖页面 `/threads/create`（**双模式：先草稿列表，点「新建」再进编辑器**）
- 草稿列表：未发布帖（标题/分类/更新时间/继续编辑/删除），空态「没有草稿喔」
- 草稿列表「继续编辑」进入 `/threads/:id/edit` 时按 `published` 分流：未发布草稿仍使用 `ThreadCreateForm`，保留「保存草稿」与最终「发布」按钮；不能误用仅有「保存修改」的已发布帖表单
- 点「新建主题帖」后自动创建沙盒草稿（方案 A）
- 草稿创建只允许由「新建主题帖」点击处理函数直接发起，并使用同步点击锁；渲染和 effect 均不发起 `POST /threads`，避免重渲染、Strict Mode effect 重放或连点生成重复草稿并触发 429 限流。
- 表单编辑：标题、分区、可见性、主题帖标签、默认子贴正文
- Milkdown Crepe WYSIWYG 编辑器（可见工具栏 + 所见即所得渲染 + 字数统计 + 正文草稿入口）
- Milkdown 输出协议：代码块外独占行 `<br />`（含历史变体）规范化并原样保存，用于精确保留手动空行；空图片语法清理，围栏代码块和 Shift+Enter 硬换行保持原样
- 图片上传期间仅锁定提交/取消操作，不把编辑器切换为只读，避免 Crepe 重建顶栏；若第三方内部仍替换顶栏节点，当前编辑器宿主会重新同步可见性与中文标签，多编辑器页面之间互不影响
- 发布校验：纯空白、仅空段落或仅分隔线不可发布；图片、代码块、列表、裸 HTTP(S) URL、CommonMark 自动链接等非空内容可发布，禁止任意 HTML
- 保存草稿（`PATCH /threads/:id`）
- 发布主题帖（`PATCH /threads/:id { published: true }`）
- 发布后跳转详情页 `/threads/[id]`
- 放弃创建时删除草稿并返回草稿列表（`DELETE /threads/:id`）

> **2026-08 交互调整**：原「进入创建页即自动创建草稿」改为「进入创建页先展示草稿列表 + 「新建主题帖」按钮，点新建才进入编辑器」。全局导航栏的「草稿箱」「正文草稿」入口已移除；正文草稿入口移入编辑器工具栏。`/drafts` 路由已删除。

**设计决策（与沙盒版对比）：**
- 创建页**仅管理默认子贴正文**，不做多子贴 / 楼层管理（保持简洁）
- 多子贴创建与管理移至**详情页管理面板**（见 `docs/modules/thread-detail.md`）：左子贴目录树 + 右单例编辑器 + 拖拽排序

**后续迭代：**
- 楼中楼回复（`parentPostId` / `replyToPostId`，详情页实现）
- 默认子贴标题的单独管理
- 更复杂的标签颜色选择
- 编辑器 @提及候选菜单：所有角色仅可选择“我关注的人 + 帖内标记玩家”，楼主/协作者额外显示 `@全体玩家`

## 2. 页面与路由

| 路由 | 页面说明 | 权限 |
|------|----------|------|
| `/threads/create` | 创建主题帖页 | 需登录且邮箱已验证 |

## 3. 涉及 API

| Method | Path | Guard | 用途 |
|--------|------|-------|------|
| POST | `/threads` | Auth | 创建沙盒草稿（事务创建 Thread + OWNER + 默认子贴） |
| GET | `/threads/:id` | AuthRead | 获取草稿最新数据（含 subthreads[].bodyPost: {id,content,version} 正文信息（kind=BODY），供编辑器回填和乐观锁编辑） |
| PATCH | `/threads/:id` | Auth | 修改草稿元数据 / 发布 |
| DELETE | `/threads/:id` | Auth | 放弃创建，删除草稿 |
| PUT | `/subthreads/:subthreadId/body` | Auth | upsert 默认子贴正文（kind=BODY：无正文创建，有正文乐观锁更新，version 不匹配返回 409） |
| GET | `/tags?q=` | Public | 标签自动补全 |
| POST | `/media/upload-url` | Auth | 获取 S3 预签名 URL；**每用户小时配额（默认 60 次）**，超限返回 429 |
| POST | `/media/upload-done` | Auth | 确认上传完成 |
| GET | `/media/:id` | Auth | 轮询图片处理状态 |

> 子贴增删改 / 排序 / 子贴正文管理相关端点（`/subthreads`、`/threads/:id/subthreads/reorder` 等）由详情页管理面板使用，见 `docs/modules/thread-detail.md`。

**响应数据类型说明（与真实 API 对齐）：**
- `ThreadDetail` 的 `_count` 字段为 `{ members, posts }`（非 `{ subthreads, posts }`）。
- 子贴对象通过 `normalizeThreadDetail()` 处理：后端返回 `subthreads` 数组 + `defaultSubthreadId`，前端按 ID 匹配出 `defaultSubthread` 字段。
- 后端 `includeSubthreads` 已带 `bodyPost: { id, content, version }`（kind=BODY 正文帖），首次创建草稿无正文时 `bodyPost` 为 `null`，有正文后其中含 `id` 和 `version` 用于乐观锁编辑（经 `PUT /subthreads/:subthreadId/body` upsert）。

## 4. 状态管理

| 状态 | 来源 | 管理方式 |
|------|------|----------|
| 页面模式 | picker / editor | useState（默认 picker，点「新建主题帖」切 editor） |
| 草稿列表 | `GET /threads/draft` | TanStack Query `useQuery`（queryKey `["drafts"]`，DraftList 复用） |
| 草稿 Thread | `POST /threads` | 页面本地 state，进入 editor 模式后创建并持久化 threadId |
| 表单字段 | 用户输入 | react-hook-form |
| 标签候选 | `GET /tags?q=` | TanStack Query + 本地 debounce |
| 发布 loading | 提交中 | useState |
| 编辑器 Markdown | Milkdown listener | 受控于表单字段 |

**草稿生命周期：**
- 进入 `/threads/create` 默认展示**草稿列表**（`picker` 模式），含「新建主题帖」按钮；无草稿时显示空态「没有草稿喔」。
- 点「新建主题帖」切到 `editor` 模式并 `POST /threads`（可传空对象，前端不发送空 `title`，避免触发后端 `@MinLength(1)` 校验），拿到 `threadId` + `defaultSubthreadId` + `version`。
- 用户每次修改后通过提交按钮保存，或最终发布时一次性提交。
- 离开编辑器时如果未发布且未保存，草稿保留在 `GET /threads/draft` 中，用户下次进入创建页可在列表继续编辑。
- 从草稿列表继续编辑时，`/threads/:id/edit` 加载详情并依据 `published=false` 渲染发布表单；返回操作仅回到草稿列表，不删除已有草稿。
- 编辑器「放弃」调用 `DELETE /threads/:id` 硬删除并返回草稿列表。

## 5. 组件清单

| 组件 | 路径 | 说明 |
|------|------|------|
| CreateThreadPage | `src/app/threads/create/page.tsx` | 创建页主逻辑（picker/editor 双模式） |
| ThreadDraftPicker | `src/components/thread/thread-draft-picker.tsx` | 草稿选择：标题 + 「新建主题帖」按钮 + 草稿列表 |
| DraftList | `src/components/user/draft-list.tsx` | 未发布帖列表（复用；空态「没有草稿喔」） |
| ThreadCreateForm | `src/components/forms/thread-create-form.tsx` | 主题帖创建表单：基础信息 + 默认子贴正文（简洁模式） |
| EditThreadPage | `src/app/threads/[id]/edit/page.tsx` | 状态感知编辑页：草稿渲染 ThreadCreateForm，已发布帖渲染 ThreadEditForm |
| MilkdownEditor | `src/components/editor/milkdown-editor.tsx` | @milkdown/crepe WYSIWYG 编辑器（工具栏/字数统计/图片上传/中文本地化 + 正文草稿入口） |
| TagInput | `src/components/forms/tag-input.tsx` | 主题帖标签输入（支持自动补全） |
| useCreateThread | `src/api/hooks/use-create-thread.ts` | 创建草稿 hook |
| useThreadDetail | `src/api/hooks/use-thread-detail.ts` | 获取详情 hook |
| useUpdateThread | `src/api/hooks/use-update-thread.ts` | 更新草稿 / 发布 hook |
| useDeleteThread | `src/api/hooks/use-delete-thread.ts` | 删除草稿 hook |
| useUpsertBody | `src/api/hooks/use-upsert-body.ts` | 写入默认子贴正文 hook（upsert：无正文创建、有正文乐观锁更新） |
| useUploadImage | `src/api/hooks/use-upload-image.ts` | 图片上传 hook |
| uploadImage | `src/lib/upload-image.ts` | 图片上传流程工具函数 |

> 子贴管理相关组件/hooks（`SubthreadTree`、`ManagementPanel`、`SubthreadCard/List/Form`、`useCreateSubthread` 等）在详情页管理面板中使用，见 `docs/modules/thread-detail.md`。

**编辑器实现说明：**

使用 `@milkdown/crepe`（Milkdown 官方 WYSIWYG 方案），通过 `CrepeFeature` 精确控制功能：

输入 `@` 后，编辑器从 `/users/mention-candidates?threadId=&q=` 拉取候选；单人通过原生链接 Mark 插入并所见即所得显示为 `@用户名`，序列化时才写入 `[@用户名](/users/{userId})`，群体插入 `@全体玩家`。后端在创建和编辑正文时再次校验权限并同步提及快照，前端候选菜单不是安全边界。

候选搜索使用 180ms 防抖，并在中文输入法组合输入期间暂停键盘确认；菜单会依据光标位置在上下方选择可见区域，移动端限制最大宽度。用户提及在光标末尾按 Backspace 时作为整体删除。

| Feature | 状态 | 说明 |
|---------|------|------|
| TopBar | ✅ | 顶部固定工具栏：标题选择器、粗体/斜体/链接/图片/引用/分隔线/无序列表（全部中文标签），按钮悬浮带中文 tooltip |
| Toolbar | ✅ | 选区浮动工具栏：粗体/斜体/删除线/行内代码/链接 |
| BlockEdit | ❌ | 禁用（以间接编辑为主，移除左侧 +/拖拽按钮） |
| LinkTooltip | ✅ | 链接悬停编辑弹窗，输入框占位符"粘贴链接…" |
| ImageBlock | ✅ | 图片上传，按钮/占位符全中文化（上传/上传文件/确认/输入图片说明/或粘贴链接） |
| CodeMirror | ❌ | 禁用（取消代码块功能，顶栏无代码块按钮；历史含代码块的正文仍可正常渲染） |
| ListItem | ✅ | 有序/无序列表 |
| Placeholder | ✅ | "开始输入…"（可通过 props 自定义） |
| Table | ❌ | 禁用 |
| Latex | ❌ | 禁用 |
| AI | ❌ | 禁用 |

**中文本地化策略：** 通过 `Crepe` 构造函数的 `featureConfigs` 覆盖所有英文 UI 字符串。
Milkdown Crepe v7 不支持 i18n 插件，所有文本通过各 feature 的 config 对象逐项覆盖。

**中文字体：** `globals.css` 中覆盖 Milkdown Crepe 的 CSS 自定义属性 `--crepe-font-default`、`--crepe-font-title`、`--crepe-font-code`，插入 Noto Sans SC / M PLUS Rounded 1c / JetBrains Mono。

字数统计：底部实时显示 `{已输入}/10000`，70% 黄色警告，90% 红色警告。

**内容区高度与滚动：** `.ProseMirror` 内容区通过 CSS 变量 `--editor-min-height`（默认 280px）/ `--editor-max-height`（默认 400px）控制：min-height 撑开可视区，使空白处点击可将光标落到文档末尾（ProseMirror 原生 clamp，记事本式落位）；超过 max-height 后内容区出现滚动条，顶部工具栏 fixed 不滚动。组件提供 `maxHeight`/`minHeight` props 按场景覆盖（创建/编辑/管理面板默认 400，发布/编辑楼层传 300）。

编辑区内边距通过 `globals.css` 覆盖 `.milkdown .ProseMirror { padding: 20px 32px }`（Nord 主题默认 60px 120px 过宽）。

顶栏按钮 tooltip：Milkdown Crepe v7 TopBar 不支持 tooltip 配置，通过 `injectToolbarTooltips()` 函数在 DOM 就绪后给 `.top-bar-item` 和 `.top-bar-heading-button` 注入 `title` 属性，利用浏览器原生 tooltip 实现中文本地化悬浮提示。

## 6. 表单与校验

校验 schema 放在 `src/lib/validations/thread-create.ts`。

### 创建/编辑主题帖

```ts
const threadCreateSchema = z.object({
  title: z
    .string()
    .max(100, "标题最多 100 个字符")
    .optional(),
  category: z.enum(["DEDUCTION", "NATION", "RPG"], {
    message: "请选择分区",
  }),
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
- category 已选择
- 正文非空

后端在 `PATCH { published: true }` 时做最终校验，前端以 toast 展示后端 message。

## 7. 错误处理

| 错误码 | 场景 | UI 行为 |
|--------|------|---------|
| 40100 | 未登录 / token 失效 | 自动跳转 `/login`（apiClient 拦截器） |
| 40300 | 邮箱未验证 | toast "请先验证邮箱后再发布" 并跳转 `/verify-email` |
| 40000 | 字段长度/格式校验失败 | 按字段显示 inline error |
| 40001 | 发布校验失败（缺标题/分区/正文） | toast 后端 message |
| 40900 | 乐观锁冲突 | toast "内容已被修改，请刷新后重试" 并重新获取详情 |
| 42900（发帖/保存） | 限流 | toast "操作太频繁，请稍后再试" |
| 42900（图片上传） | 每用户小时上传配额超限 / 全局限流 | `uploadImageFile` 显式映射为 toast "上传图片太频繁，请稍后再试"，编辑器与头像上传统一复用 |
| 网络错误 | fetch 失败 | toast "网络连接失败，请检查网络后重试" |

## 8. 权限与访问控制

| 场景 | 处理 |
|------|------|
| 未登录用户访问 `/threads/create` | 等 `isInitialized` 为 true 后跳转 `/login`（避免 hydration 误判） |
| 已登录但邮箱未验证 | 等 `isInitialized` 后提示"请先验证邮箱"并跳转 `/verify-email` |
| 创建草稿失败（网络等） | 显示错误提示，提供重试按钮 |
| 发布时并发冲突 | 重新获取详情刷新 version，用户手动再次发布 |

## 9. 用户流程

### 创建并发布

```
进入 /threads/create
  ↓ 未登录 → /login
  ↓ 未验证邮箱 → /verify-email
  ↓ 已登录且已验证
POST /threads 创建草稿
  ↓ 成功
显示表单（标题/分区/可见性/标签 + 默认子贴正文编辑器）
  ↓ 用户编辑
点击"保存草稿" → PATCH /threads/:id { 当前字段, version } + PUT /subthreads/:id/body upsert 保存默认子贴正文
  ↓ 成功 toast "草稿已保存"
点击"发布" → 校验默认子贴正文 → upsert 正文（PUT /subthreads/:id/body）→ PATCH { published: true, version }
  ↓ 成功 toast "发布成功" 跳转 /threads/:id
  ↓ 失败 按错误码提示
点击"放弃" → 确认弹窗 → DELETE /threads/:id → 跳转 /
```
> 多子贴创建/管理入口在发布后的详情页「管理」面板（见 thread-detail.md）

## 10. 验收标准

- [x] 进入 `/threads/create` 自动创建草稿并显示表单
- [x] 未登录用户跳转登录页
- [x] 未验证邮箱用户收到提示并跳转验证页
- [x] 表单可编辑标题、分区、可见性、标签、默认子贴正文
- [x] 创建页保持简洁：不承载多子贴/楼层管理（移至详情页管理面板）
- [x] 标签输入支持自动补全和新建
- [x] 编辑器支持 WYSIWYG 渲染与可见工具栏
- [x] 编辑器功能：粗体/斜体/删除线/行内代码/链接/标题/列表/引用/代码块
- [x] 编辑器支持图片上传并插入 Markdown
- [x] 编辑器支持字数统计（70% 黄色 / 90% 红色阈值提示）
- [x] 编辑器不可见空段落不会在发布后显示为字面 `<br />`，代码块中的 `<br />` 示例不被误删
- [x] 编辑器禁用表格功能
- [x] 保存草稿成功更新 Thread 元数据
- [x] 发布前校验不满足时提示具体缺项（含默认子贴无正文）
- [x] 发布成功跳转详情页
- [x] 从草稿列表继续编辑时显示「保存草稿」与「发布」，发布后跳转详情页
- [x] 已发布帖编辑页仍只显示「保存修改」，草稿/已发布状态互不混用
- [x] 放弃创建可删除草稿
- [x] 所有错误状态有 toast 提示
- [x] 提交按钮显示 loading 状态
- [x] 编辑区已调整内边距（从 60px/120px 收紧到 20px/32px）
- [x] 顶栏按钮悬浮提示（通过 JS `title` 属性注入中文本地化 tooltip）
- [x] `pnpm lint && pnpm typecheck && pnpm build` 全部通过

## 11. 子任务

- [x] 编写模块设计文档 `docs/modules/thread-create.md`
- [x] 创建 Zod schema `src/lib/validations/thread-create.ts`
- [x] 实现 Milkdown Crepe WYSIWYG 编辑器 `src/components/editor/milkdown-editor.tsx`
- [x] 实现图片上传工具 `src/lib/upload-image.ts`
- [x] 实现 `useCreateThread` / `useThreadDetail` / `useUpdateThread` / `useDeleteThread` hooks
- [x] 实现 `useUpsertBody` / `useUploadImage` hooks
- [x] 实现 `TagInput` 标签输入组件
- [x] 实现 `ThreadCreateForm` 表单组件（简洁模式）
- [x] 实现 `/threads/create` 页面
- [x] 沙盒版多子贴/楼层管理已移除（组件/逻辑回退，相关 hooks 保留供详情页管理面板复用）
- [x] 同步更新文档
- [x] lint / typecheck / build 通过
- [x] vitest 单元测试通过：Zod schema / API hooks / 工具函数 / 组件
- [x] Playwright E2E 测试通过：登录→创建完整流程 / 顶栏工具栏 / 发布校验 / 放弃
- [x] 修复草稿继续编辑误用已发布帖表单：编辑页按 `published` 分流，并补页面回归测试
- [x] 修复 Milkdown 空段落序列化泄漏：输出阶段清理独占行 `<br />`，并补代码块保护测试

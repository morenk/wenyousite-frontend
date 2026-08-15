# 正文草稿模块（全局 5 槽位草稿池）

## 1. 目标与范围

实现「编辑器正文草稿」的前端能力，与「主题帖草稿」（创建页草稿列表）完全隔离展示。

**背景：站内有两套互相独立的草稿系统**

| 维度 | 主题帖草稿（threads 模块） | 正文草稿（drafts 模块） |
|------|---------------------------|------------------------|
| 语义 | 创建帖子的沙盒：标题/分区/可见性/标签/完整正文 | 通用编辑器快照：完整 `content`（含内联骰子节点） |
| 模型 | Thread（`published=false`） | Draft（`userId + slot` 联合唯一） |
| 容量 | 每用户最多 10 条 | 每用户固定 5 槽位（slot 1-5） |
| 绑定 | 未发布帖，仅 owner 可见 | 不与子贴绑定，全局浮动编辑器缓存 |
| 前端入口 | `/threads/create` 草稿列表 | 编辑器工具栏「正文草稿」→ 编辑器内草稿托盘 |
| 交互 | 显式「保存草稿」按钮 | 当前编辑器全文手动保存/恢复；可开启自动保存 |

**当前行为：**
- 正文草稿面板：5 槽位列表，支持手动保存/恢复/删除
- Milkdown 顶部格式工具栏「正文草稿」按钮（所有 MilkdownEditor 共享），打开面板
- 恢复草稿时回填完整正文，内联骰子节点随 content 一起恢复；托盘打开期间始终读取当前编辑器的最新正文
- 不提供二次输入框：可把当前编辑器全文直接保存到空槽位或覆盖指定槽位
- 自动保存开关：开启后防抖更新槽位 1；槽位 1 已有内容时开启前确认
- 恢复覆盖非空正文前二次确认
- 与主题帖草稿完全隔离（入口/命名/视觉/数据四层）

入口固定在 Milkdown 顶部格式工具栏（登录可见）；编辑器底部仅保留 Markdown 提示和字数统计。草稿内容以 01–05 槽位托盘内嵌在当前编辑器下方，不使用全屏遮罩或右侧 Sheet，避免与浮动回复框、全局导航竞争层级。

## 2. 页面与路由

| 路由/形态 | 说明 | 权限 |
|-----------|------|------|
| 编辑器工具栏「正文草稿」 | 在当前编辑器下方展开 01–05 草稿槽位托盘（非独立页面） | 需登录 |

不占用独立路由：正文草稿是「全局浮动缓存」，面板由编辑器工具栏入口唤起，不新增页面。

## 3. 涉及 API

| Method | Path | Guard | 用途 |
|--------|------|-------|------|
| GET | `/drafts/slots` | AuthRead | 槽位使用情况（usedSlots / maxSlots=5 / slots[]） |
| GET | `/drafts` | AuthRead | 当前用户全部草稿（按 slot 排序） |
| POST | `/drafts` | Auth | 保存草稿（指定 slot 覆盖；不指定自动分配空闲位） |
| GET | `/drafts/:id` | AuthRead | 单条草稿 |
| PATCH | `/drafts/:id` | Auth | 更新草稿内容 |
| DELETE | `/drafts/:id` | Auth | 删除草稿（硬删除） |

**响应数据类型（与 OpenAPI 生成类型对齐）：**

```ts
interface DraftItem {
  id: string;
  userId: string;
  slot: number;        // 1-5
  content: string;     // 完整 Markdown；可含 [[dice:v1:<nodeId>:<notation>]] 节点
  version: number;     // 乐观锁版本
  createdAt: string;
  updatedAt: string;
}
```

- `GET /drafts` → `data: DraftItem[]`
- `GET /drafts/slots` → `data: { usedSlots: number; maxSlots: number; slots: number[] }`（`slots` 顺序不保证稳定）
- `POST /drafts`（body `{ content, slot?, version? }`）→ 201，覆盖已有槽位时必须提交当前 version
- `GET/PATCH /drafts/:id` → `data: DraftItem`
- `DELETE /drafts/:id` → `data: { message: "草稿已删除" }`

> **内容存储策略（全站统一）**：content 按 **Markdown 存储**，后端不做 HTML 转义。Web 编辑器输出时只清理 Milkdown 自身产生的空图片并规范化独占行空段落 `<br />`；提交和保存链路不做全局 `trim()`，因此首尾空段落及空白可原样保留。XSS 由渲染层净化：Web 端 react-markdown 启用 `skipHtml`，移动端需使用安全的 Markdown 渲染器。

## 4. 状态管理

| 状态 | 来源 | 管理方式 |
|------|------|----------|
| 草稿列表 | `GET /drafts` | TanStack Query `useQuery`（`queryKeys.contentDrafts`） |
| 槽位使用 | `GET /drafts/slots` | TanStack Query `useQuery`（`queryKeys.draftSlots`） |
| 保存/删除 | mutation | `useMutation`，成功后 invalidate 列表与槽位 |
| 面板开关 | 编辑器工具栏入口 | useState（MilkdownEditor 持有） |
| 自动保存 | 当前编辑器状态 | 800ms 防抖串行写入完整 content 到 slot 1；成功后推进 version，409 或保存失败时关闭自动保存并保持错误状态可见 |

## 5. 组件清单

| 组件 | 路径 | 说明 |
|------|------|------|
| ContentDraftsPanel | `src/components/editor/content-drafts-panel.tsx` | 5 槽位卡片；当前编辑器全文保存/覆盖/恢复/删除；槽位 1 自动保存开关 |
| 编辑器入口 | `src/components/editor/milkdown-editor-core.tsx` | 顶部工具栏按钮、面板挂载、恢复回填及 slot 1 防抖自动保存 |
| useContentDrafts | `src/api/hooks/use-content-drafts.ts` | 草稿列表 hook（集中式 query key） |
| useDraftSlots | `src/api/hooks/use-draft-slots.ts` | 槽位使用 hook（集中式 query key） |
| useSaveDraft | `src/api/hooks/use-save-draft.ts` | 保存草稿 hook（成功 invalidate 列表+槽位） |
| useDeleteContentDraft | `src/api/hooks/use-delete-content-draft.ts` | 删除草稿 hook（成功 invalidate 列表+槽位） |

> 面板形态：当前 Milkdown 编辑器内的折叠托盘。托盘不创建遮罩、不拦截页面级导航，使用两列槽位索引和内部滚动限制高度；楼中楼的浮动回复框会随托盘实际高度重新预留页面底部空间。

## 6. 表单与校验

无二次输入表单。`POST /drafts` 直接提交当前编辑器的完整 Markdown；内联骰子节点是 content 的一部分，因此天然与前后文字处于同一版本快照。允许纯正文或只含骰子节点，但 content 不能为空。`slot` 可选（1-5），不传由后端自动分配。覆盖已有槽位时同时提交该记录当前的正整数 `version`。

打开面板、窗口重新获得焦点、开启自动保存前都会重新拉取远端快照。发生 409 时停止当前自动保存并提示刷新，不拆解或合并 content 内的骰子节点，避免跨设备把两个版本拼成非用户意图的状态。

## 7. 错误处理

| 错误码 | 场景 | UI 行为 |
|--------|------|---------|
| 40100 | 未登录 / 缺少认证凭证 | 登录守卫跳转 `/login` |
| 40101 | access token 过期 | apiClient 自动刷新并重放请求 |
| 40000 | 草稿位已满（5/5） | toast「草稿位已满（5/5），请先删除旧草稿」 |
| 40400 | 草稿不存在（已被删） | toast「草稿不存在或已删除」并刷新列表 |
| 40002 / HTTP 409 | 草稿已在其他标签页或设备修改 | 停止自动保存，刷新列表并提示用户重新确认 |
| 网络错误 | fetch 失败 | toast「网络连接失败，请稍后重试」 |
| 兜底 | 其它 | toast「操作失败，请稍后重试」 |

## 8. 权限与访问控制

- 未登录用户不显示入口：编辑器工具栏「正文草稿」按钮仅登录后渲染
- 草稿仅本人可见（后端 AuthRead 按 userId 隔离）

## 9. 验收标准

- Milkdown 顶部格式工具栏「正文草稿」入口（所有 MilkdownEditor 共享），登录可见
- 面板展示 5 槽位草稿：槽位号 + 内容预览 + 更新时间 + 恢复/删除
- 草稿托盘内嵌于当前编辑器，不产生全屏遮罩或与全局导航竞争层级
- 空槽位显示空态提示；无草稿时显示槽位占位
- 保存草稿到草稿池；满 5 槽时禁用自动分配并提示选择已有槽位覆盖
- 恢复草稿把完整 content（含内联骰子节点）回填当前编辑器（无回调时复制完整正文）
- 托盘打开期间继续编辑时，保存按钮始终读取当前编辑器的最新正文
- 当前正文可保存到指定空槽位，或经确认后覆盖指定已用槽位
- 面板不要求再次粘贴或输入内容，所有保存操作直接使用当前编辑器全文
- 自动保存开启后，当前编辑器完整 content 经防抖原子更新到槽位 1，并显示保存状态
- 手动覆盖槽位 1 后立即同步响应 version，后续自动保存继续使用最新乐观锁版本
- 自动保存失败时关闭开关并持续显示错误状态，直到用户重新开启
- 手动保存和自动保存均保留首尾 Markdown 内容，不做全局 `trim()`
- 恢复草稿会覆盖非空当前正文时要求二次确认
- 删除草稿确认后调用 DELETE，成功后列表刷新
- 与主题帖草稿在入口/命名/视觉/数据上完全隔离
- 手动覆盖与自动保存均携带当前 version，成功后使用响应中的新版本
- 409 冲突不覆盖远端内容，并停止当前编辑器自动保存
- 面板打开、窗口聚焦和启用自动保存时刷新远端版本，支持多设备接续

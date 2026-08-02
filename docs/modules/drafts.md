# 正文草稿模块（全局 5 槽位草稿池）

## 1. 目标与范围

实现「编辑器正文草稿」的前端能力，与「主题帖草稿」（创建页草稿列表）完全隔离展示。

**背景：站内有两套互相独立的草稿系统**

| 维度 | 主题帖草稿（threads 模块） | 正文草稿（drafts 模块） |
|------|---------------------------|------------------------|
| 语义 | 创建帖子的沙盒：标题/分区/可见性/标签/正文 | 通用编辑器内容暂存：仅 `content` 纯文本 |
| 模型 | Thread（`published=false`） | Draft（`userId + slot` 联合唯一） |
| 容量 | 每用户最多 10 条 | 每用户固定 5 槽位（slot 1-5） |
| 绑定 | 未发布帖，仅 owner 可见 | 不与子贴绑定，全局浮动编辑器缓存 |
| 前端入口 | `/threads/create` 草稿列表 | 编辑器工具栏「正文草稿」→ 面板（Sheet） |
| 交互 | 显式「保存草稿」按钮 | 手动保存/恢复；后续自动暂存 |

**本次迭代范围（完整手动草稿闭环）：**
- 正文草稿面板：5 槽位列表，支持手动保存/恢复/删除
- Milkdown 顶部格式工具栏「正文草稿」按钮（所有 MilkdownEditor 共享），打开面板
- 恢复草稿时回填当前编辑器内容；打开面板预填当前正文便于存池
- 可直接保存到空槽位、覆盖指定槽位；恢复覆盖非空正文前二次确认
- 与主题帖草稿完全隔离（入口/命名/视觉/数据四层）

**后续迭代：**
- 楼层/回复编辑器自动暂存（debounce 输入 → 固定写 slot 1 覆盖）
- 编辑器「已暂存正文草稿」状态提示条

> **2026-08 交互调整**：入口由全局导航栏移至 Milkdown 顶部格式工具栏（登录可见）；编辑器底部仅保留 Markdown 提示和字数统计，不重复放置入口。

## 2. 页面与路由

| 路由/形态 | 说明 | 权限 |
|-----------|------|------|
| 编辑器工具栏「正文草稿」 | 打开正文草稿面板（右侧 Sheet，非独立页面） | 需登录 |

不占用独立路由：正文草稿是「全局浮动缓存」，面板由编辑器工具栏入口唤起，不新增页面。

## 3. 涉及 API

| Method | Path | Guard | 用途 |
|--------|------|-------|------|
| GET | `/drafts/slots` | AuthRead | 槽位使用情况（usedSlots / maxSlots=5 / slots[]） |
| GET | `/drafts` | AuthRead | 当前用户全部草稿（按 slot 排序） |
| POST | `/drafts` | AuthRead | 保存草稿（指定 slot 覆盖；不指定自动分配空闲位） |
| GET | `/drafts/:id` | AuthRead | 单条草稿 |
| PATCH | `/drafts/:id` | AuthRead | 更新草稿内容 |
| DELETE | `/drafts/:id` | AuthRead | 删除草稿（硬删除） |

**API 响应快照（事实契约）**：`docs/snapshots/drafts.snapshot.json`

**响应数据类型（与真实快照对齐）：**

```ts
interface DraftItem {
  id: string;
  userId: string;
  slot: number;        // 1-5
  content: string;     // Markdown 纯文本
  createdAt: string;
  updatedAt: string;
}
```

- `GET /drafts` → `data: DraftItem[]`
- `GET /drafts/slots` → `data: { usedSlots: number; maxSlots: number; slots: number[] }`（`slots` 顺序不保证稳定）
- `POST /drafts`（body `{ content, slot? }`）→ 201，`data: DraftItem`；满 5 槽且未指定 slot 时返回 400「草稿位已满（5/5），请先删除旧草稿」
- `GET/PATCH /drafts/:id` → `data: DraftItem`
- `DELETE /drafts/:id` → `data: { message: "草稿已删除" }`

> **内容存储策略（全站统一）**：content 一律按 **Markdown 原样存储**，后端不再做 HTML 转义（曾用 sanitize-html 转义导致 `>` 变 `&gt;`，已修复并清理存量数据）。XSS 由各端渲染层净化：web 端 react-markdown 默认剥离原始 HTML 标签；移动端需用 markdown 渲染器。

## 4. 状态管理

| 状态 | 来源 | 管理方式 |
|------|------|----------|
| 草稿列表 | `GET /drafts` | TanStack Query `useQuery`（queryKey `["content-drafts"]`） |
| 槽位使用 | `GET /drafts/slots` | TanStack Query `useQuery`（queryKey `["draft-slots"]`） |
| 保存/删除 | mutation | `useMutation`，成功后 invalidate 列表与槽位 |
| 面板开关 | 编辑器工具栏入口 | useState（MilkdownEditor 持有） |

## 5. 组件清单

| 组件 | 路径 | 说明 |
|------|------|------|
| ContentDraftsPanel | `src/components/user/content-drafts-panel.tsx` | 正文草稿面板：5 槽位卡片（内容预览/时间/指定槽位保存或覆盖/恢复/删除），loading/error/empty/data 四态；支持 `initialContent` 预填 |
| 编辑器入口 | `src/components/editor/milkdown-editor.tsx` | Milkdown 顶部格式工具栏草稿按钮（登录可见）+ 面板挂载；恢复草稿重挂载编辑器回填 |
| useContentDrafts | `src/api/hooks/use-content-drafts.ts` | 草稿列表 hook（queryKey `["content-drafts"]`） |
| useDraftSlots | `src/api/hooks/use-draft-slots.ts` | 槽位使用 hook（queryKey `["draft-slots"]`） |
| useSaveDraft | `src/api/hooks/use-save-draft.ts` | 保存草稿 hook（成功 invalidate 列表+槽位） |
| useDeleteContentDraft | `src/api/hooks/use-delete-content-draft.ts` | 删除草稿 hook（成功 invalidate 列表+槽位） |

> 面板形态：右侧 Sheet，参照 `image-lightbox.tsx` 手写 overlay 模式（不引入 shadcn CLI 依赖）。

## 6. 表单与校验

无表单。`POST /drafts` 的 `content` 为编辑器输出 Markdown；`slot` 可选（1-5），不传由后端自动分配。

## 7. 错误处理

| 错误码 | 场景 | UI 行为 |
|--------|------|---------|
| 40100 | 未登录 / token 失效 | apiClient 拦截器自动跳转 `/login` |
| 40000 | 草稿位已满（5/5） | toast「草稿位已满（5/5），请先删除旧草稿」 |
| 40400 | 草稿不存在（已被删） | toast「草稿不存在或已删除」并刷新列表 |
| 网络错误 | fetch 失败 | toast「网络连接失败，请稍后重试」 |
| 兜底 | 其它 | toast「操作失败，请稍后重试」 |

## 8. 权限与访问控制

- 未登录用户不显示入口：编辑器工具栏「正文草稿」按钮仅登录后渲染
- 草稿仅本人可见（后端 AuthRead 按 userId 隔离）

## 9. 验收标准

- [x] Milkdown 顶部格式工具栏「正文草稿」入口（所有 MilkdownEditor 共享），登录可见
- [x] 面板展示 5 槽位草稿：槽位号 + 内容预览 + 更新时间 + 恢复/删除
- [x] 空槽位显示空态提示；无草稿时显示槽位占位
- [x] 保存草稿到草稿池；满 5 槽时禁用自动分配并提示选择已有槽位覆盖
- [x] 恢复草稿把 content 回填当前编辑器（缺省复制剪贴板）
- [x] 打开面板预填当前编辑器正文，便于把正在写的内容存入草稿池
- [x] 当前正文可保存到指定空槽位，或经确认后覆盖指定已用槽位
- [x] 恢复草稿会覆盖非空当前正文时要求二次确认
- [x] 删除草稿确认后调用 DELETE，成功后列表刷新
- [x] 与主题帖草稿在入口/命名/视觉/数据上完全隔离
- [x] `pnpm lint && pnpm typecheck && pnpm test` 通过

## 10. 子任务（切片）

- [x] 切片1：扩展 `scripts/api-verify.ts` drafts 快照覆盖（GET/POST/PATCH/DELETE 全链路），抓取真实响应到 `docs/snapshots/drafts.snapshot.json`；编写本文档
- [x] 切片2：API hooks（`useContentDrafts` / `useDraftSlots` / `useSaveDraft` / `useDeleteContentDraft`）+ 测试
- [x] 切片3：`ContentDraftsPanel` 组件 + 测试
- [x] 切片4：编辑器工具栏「正文草稿」入口 + 面板挂载（原导航栏入口已移除）
- [x] 切片5：文档收尾 + 质量检查（lint / typecheck / test / build）
- [x] 切片6：入口迁入 Milkdown 顶部工具栏；补齐指定槽位保存/覆盖与恢复确认

## 11. 后续（本次不做）

- 楼层/回复编辑器自动暂存：输入 debounce（~500ms）后固定写入 slot 1（覆盖更新），发布/回复成功清除该槽位
- 编辑器「已暂存正文草稿 · 恢复/清除」提示条
- 满 5 槽且自动暂存命中时按后端 400 提示，不做自动覆盖

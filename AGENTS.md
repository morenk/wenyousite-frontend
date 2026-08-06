# 温油站前端 — AI 辅助编程上下文

## 项目概述

温油站 Web 端。基于 Next.js 16 + React 19 + TypeScript 5 + Tailwind CSS 4 + shadcn/ui。
与 NestJS 后端共用一套 REST API，通过 OpenAPI 生成类型。

### 平台边界（全局强制）

- 本项目仅面向 **PC Web 端**，以现代桌面浏览器和鼠标/键盘操作为目标。
- 不为手机或平板追加响应式断点、触屏手势、移动端抽屉或移动端专用布局，也不因移动端显示效果牺牲 PC 信息密度与交互。
- 移动端由独立的 Flutter 客户端实现；两端仅复用后端 REST API 契约，不在本仓库维护 Flutter 或移动 Web 适配代码。

## 技术栈

| 分类 | 选型 | 用途 |
|------|------|------|
| 框架 | Next.js 16 App Router | 同域部署、页面路由 |
| 语言 | TypeScript 5 + React 19 | 类型安全 |
| 样式 | Tailwind CSS 4 + shadcn/ui (Base UI preset) | 高度自定义 UI |
| 动画 | Framer Motion | 微交互、页面过渡 |
| API 请求 | openapi-fetch + @tanstack/react-query | 类型安全、缓存 |
| 类型生成 | openapi-typescript | 从后端 Swagger 生成 |
| 表单 | react-hook-form + @hookform/resolvers + zod | 表单校验 |
| Markdown 编辑器 | Milkdown 7 | 输出原生 Markdown |
| Markdown 渲染 | react-markdown + remark-gfm | 帖子正文渲染 |
| 提示 | sonner | Toast 提示 |
| 日期 | date-fns | 时间格式化 |
| 工具 | clsx + tailwind-merge | 类名合并 |
| 字体 | M PLUS Rounded 1c + Noto Sans SC | 二次元风格（后期启用） |

## 开发约定

### 1. 先功能，后美化

- MVP 阶段使用 shadcn/ui 默认样式，把页面和接口跑通。
- 所有核心功能完成后，再统一切换到 Misskey 轻二次元风格。
- 不要过早写大量自定义 CSS。

### 2. 项目结构

```
src/
  app/              # Next.js App Router 页面
  components/
    ui/             # shadcn/ui 组件（仅通过 CLI 生成）
    forms/          # 业务表单组件
    layout/         # 导航、侧边栏、页脚
    editor/         # Milkdown 编辑器封装
    thread/         # 主题帖相关业务组件
  lib/
    auth.tsx        # 认证上下文
    utils.ts        # cn 等工具函数
  api/
    client.ts       # openapi-fetch 客户端
    types.ts        # OpenAPI 生成类型
    hooks/          # TanStack Query 自定义 hooks
  hooks/            # 通用自定义 hooks
```

### 3. 命令

```bash
pnpm dev          # 开发服务器，端口 3001（dev 脚本已设 NODE_OPTIONS V8 堆上限 3GB）
pnpm build        # 生产构建
pnpm start        # 生产运行（端口 3001）
pnpm lint         # ESLint
pnpm typecheck    # TypeScript
pnpm test         # vitest 单元/组件测试
pnpm test:watch   # vitest watch 模式
pnpm test:e2e     # Playwright E2E（需 E2E_ENV=test，独立使用 3101 端口）
pnpm check        # 唯一质量门禁：lint + typecheck + test + 快照/文档检查 + build
pnpm check:full   # 发布前完整门禁：check + 本机 E2E
pnpm generate:api # 从相邻后端源码离线导出 OpenAPI 并生成类型，无需启动服务
```

当前 ESLint 历史基线为 1 个 React Compiler warning，`pnpm lint` 使用 `--max-warnings 1` 作为债务棘轮：新改动不得增加 warning；修复后应将基线降为 0。

**dev server 内存说明：** Next 16 dev 用 Turbopack，会把访问过的路由（尤其 `/threads/create`、`/threads/[id]` 的 Milkdown+Vue 编辑器模块图）编译结果常驻内存，RSS 随访问路由累积（可到 4GB+）。这是 dev-only 的编译缓存，**生产 standalone 构建不会这样**。缓解：`dev` 脚本已加 `NODE_OPTIONS=--max-old-space-size=3072`；若 RSS 仍接近 3GB 或测试/build 因内存不足挂起，**重启 `pnpm dev`** 即可释放（首访会重新编译几秒）。若改动后 dev 首次编译 OOM，可调低/移除该 NODE_OPTIONS。

### 4. API 请求

- 统一使用 `src/api/client.ts` 中的 `apiClient`。
- 不要在页面里直接调用 `fetch`，统一走 TanStack Query hooks。
- 执行 `pnpm generate:api` 从相邻后端源码离线导出 OpenAPI 并生成 `src/api/types.ts`，无需启动后端或连接数据库/Redis。
- 错误码和前端行为按后端仓库 `wenyousite-backend/docs/frontend-guide.md` 与 `wenyousite-backend/src/common/exceptions/error-codes.ts` 对齐。
- **OpenAPI 是 API 结构契约的唯一事实源**：请求、成功响应、错误 envelope、可选字段、nullability 和枚举必须由 Swagger DTO 描述，并通过 `openapi-typescript` 生成。不得重复手写已经存在的生成类型。
- **运行时快照是验证样例，不是类型定义**：用于发现 Swagger 与真实实现不一致、记录关键状态样例；快照缺少某字段不代表字段不存在。
- 抓取快照必须使用专用测试账号和测试环境：`API_SNAPSHOT_ENV=test TEST_EMAIL=... TEST_PASS=... pnpm snapshots:verify -- --module=threads`。远程测试环境还需用 `API_SNAPSHOT_REMOTE_HOST=<hostname>` 精确声明主机；禁止指向生产环境。
- 快照保存前必须脱敏。`pnpm snapshots:check` 会拒绝 token、邮箱、设备信息和稳定标识符；发现历史数据时运行 `pnpm snapshots:sanitize`。

### 5. 认证

- `accessToken` 存在 `localStorage`；`refreshToken` 由后端 httpOnly Cookie 管理。
- 使用 `useAuth()` 获取用户状态：`const { user, isInitialized } = useAuth()`。
- 401 时自动刷新，刷新失败则清除 token 并跳转 `/login`。
- **任何需要登录判断的页面必须等待 `isInitialized` 完成后再做跳转判断**，避免 hydration 期间误判为未登录：

  ```tsx
  const { user, isInitialized } = useAuth();

  if (!isInitialized) return <Loading />;
  if (!user) { router.replace("/login"); return null; }
  // 业务逻辑
  ```

### 6. UI 规范

- 中文界面。
- 使用 `cn()` 合并类名。
- 所有页面先处理 loading / error / empty 三种状态。
- 按钮文案、错误提示文案统一，避免技术术语。

### 7. 表单

- 统一用 `react-hook-form` + `zod`。
- 校验 schema 与后端 DTO 对齐。
- 表单提交按钮显示 loading 状态。

### 8. 编辑器

- 使用 `src/components/editor/milkdown-editor.tsx`。
- 编辑器输出 Markdown 字符串，直接调用后端接口。
- 图片通过预签名 URL 上传后插入为 `![alt](url)`。
- @提及功能通过编辑器候选菜单写入稳定用户链接；候选范围由后端接口和提交时服务端复核共同保证。

### 9. 路由

| 路径 | 页面 |
|------|------|
| `/` | 首页主题帖列表 |
| `/login` | 登录 |
| `/register` | 注册 |
| `/verify-email` | 邮箱验证 |
| `/forgot-password` | 忘记密码 |
| `/reset-password` | 重置密码 |
| `/threads/create` | 创建主题帖 |
| `/threads/[id]` | 主题帖详情 |
| `/threads/[id]/edit` | 编辑草稿；已发布帖兼容进入统一管理界面 |
| `/notifications` | 通知 |
| `/bookmarks` | 我的收藏 |
| `/search` | 全文搜索 |
| `/users/[id]` | 用户主页 |
| `/users/[id]/following` | 用户关注列表 |
| `/users/[id]/followers` | 用户粉丝列表 |
| `/me` | 我的资料 |
| `/me/password` | 修改密码 |
| `/me/email` | 修改邮箱 |
| `/me/security` | 双端登录终端、黑名单与账号注销 |
| `/join/[token]` | 私密帖邀请预览与加入 |
| `/threads/[id]/posts/[postId]/replies` | 独立楼中楼阅读页 |

### 10. 环境变量

| 变量 | 说明 |
|------|------|
| `NEXT_PUBLIC_API_BASE_URL` | 浏览器端 API 前缀，如 `/api/v1` |
| `BACKEND_URL` | 服务端/代理用后端地址，如 `http://api:3000` |
| `NEXT_PUBLIC_APP_URL` | 公网域名，如 `https://wenyou.site` |

### 11. 部署

- Next.js 使用 `output: "standalone"`。
- 生产运行 `node .next/standalone/server.js`。
- Caddy 同域路由：`/api/v1/*` → 后端，其余 → 前端。
- 前端 Docker 服务名为 `web`，监听 `3001`。

#### 当前阶段：公网开发快速迭代

`wenyou.site` 当前是**公网可访问的开发环境**。为避免 Next dev/Turbopack 长时间运行造成高内存，只借用 production standalone 作为稳定运行方式，不按正式生产发布审批处理。

默认交付链路为：**实现 → 相关测试 → `pnpm check` 一次 → 原子提交 → 推送 `dev` → 重启受影响服务 → 最小烟雾验证**。用户明确说“不提交 / 不推送 / 不重启”时才跳过对应步骤。

- 纯前端变化只重启 3001；后端/API 契约变化先切换后端，再切换前端
- 纯文档变化只提交并推送，不构建、不重启
- `pnpm check` 已包含 build；检查后源码未变化时复用 `.next`，只补齐 standalone 的 static/public 目录，不再次 build
- 普通页面/UI 变化以组件测试、`pnpm check` 和公网关键页面 200 为准；认证/权限/核心旅程才补 E2E 或真人验证
- 不默认预构建回滚产物、安排维护窗口或长时间观察；启动失败、持续 5xx 或关键路径失败时优先快速前滚修复
- 项目进入正式生产阶段后，由用户明确更新本节，再恢复严格发布审批、回滚和监控要求

#### 公网生产模式迭代（VPS 手动运行，省内存）

公网访问一律用**生产模式**（后端 `node dist/main` + 前端 standalone），**不用 `next dev` 暴露公网**：dev 的 Turbopack 编译缓存会让 RSS 随时间涨到数 GB 导致机器卡死（见第 3 节），生产模式两者合计仅 ~0.3GB、稳定不涨。

**生产模式没有热更新**——改代码必须「重新构建 → 重启进程」，这是生产模式迭代的唯一代价。

当前公网开发阶段，功能任务完成默认包含提交、推送和受影响服务重启，无需逐次询问；正式生产阶段才恢复发布授权分离。

**发布批次规则：** 一个可交付迭代可以包含多个原子提交，但整个批次只构建、部署和验证一次。纯文档变更不构建、不重启服务。部署前必须完成 `pnpm check`；核心用户旅程或跨端改动还需完成 `pnpm check:full` 或等价烟雾测试。

前端重启（改代码后）：

```bash
cd /root/wenyousite/wenyousite-frontend
pnpm build
cp -a .next/static .next/standalone/.next/         # standalone 需静态资源
cp -a public .next/standalone/                     # standalone 需 public 资源
kill $(ss -tlnp | grep :3001 | grep -oP 'pid=\K[0-9]+')
setsid nohup env PORT=3001 node .next/standalone/server.js </dev/null \
  > /tmp/opencode/wenyousite-frontend.log 2>&1 &
```

后端重启（改代码后）：

```bash
cd /root/wenyousite/wenyousite-backend
pnpm build
kill $(ss -tlnp | grep :3000 | grep -oP 'pid=\K[0-9]+')
setsid nohup env NODE_ENV=production node dist/main </dev/null \
  > /tmp/opencode/wenyousite-backend.log 2>&1 &
```

注意事项：

- 日志：`/tmp/opencode/wenyousite-frontend.log`、`/tmp/opencode/wenyousite-backend.log`
- 杀进程用 `ss` 提取 PID；**不要用 `pkill -f "next start"` 这类会匹配到自身 shell 的模式**
- 后端首次/依赖变更后需 `npx prisma generate` 生成 Prisma Client；`npx prisma migrate deploy` 应用未执行迁移（幂等）
- 验证：`curl -sI https://wenyou.site`（前端 200）+ `curl -s https://wenyou.site/api/v1/health`（后端 database/redis up）
- 切换后验证本次关键页面/接口并查看最近日志；出现持续 5xx、关键路径失败或健康检查失败时优先快速前滚修复。

### 12. 迭代流程（Contract-First + Risk-Based Testing）

每个功能模块按以下步骤推进：

**阶段一：范围与风险**

1. **定范围** → 写清目标、非目标、验收标准和受影响模块；小型内部修复可直接更新现有模块文档，不强制新建文档。
2. **评风险** → 标记是否涉及认证/权限、数据写入、API 契约、数据库迁移、队列、缓存、上传、核心用户旅程或生产配置。
3. **拆行为切片** → 每个切片必须形成可验证的完整行为，可以同时包含 schema、hook、组件、页面、测试和文档；不按文件类型机械拆分。
4. **契约先行** → API 变更先更新后端 DTO/Swagger，并判断为“向后兼容新增”或“破坏性变更”。生成前端类型后再实现消费逻辑。

**阶段二：实现循环**

1. **测试与实现同步** → bug 先写回归测试；高风险逻辑优先测试先行；纯展示调整可说明人工验证范围。
2. **写代码** → 优先复用生成 API 类型和现有组件/缓存模式，处理 loading、error、empty、success 以及权限分支。
3. **同步文档** → 只有公共行为、API、架构、运维方式或用户流程变化时强制更新；内部重构无需制造无意义文档 churn。
4. **本地门禁** → 每个可提交行为切片执行相关测试，迭代完成统一执行 `pnpm check`。
5. **交付公网开发环境** → 一个 commit 对应一个可理解、可验证的完整行为；批次结束默认提交、推送 `dev`，并按影响范围重启和烟雾验证，不按文件类型机械拆分。

**测试映射：**

| 变更类型 | 最低验证要求 |
|----------|--------------|
| bug 修复 | 能复现旧问题的回归测试 |
| Zod/工具函数 | 正常、边界、错误输入单元测试 |
| Query/Mutation hook | 请求参数、成功/失败、缓存更新或失效测试 |
| 业务组件/页面 | 关键状态和用户交互测试 |
| API 契约变更 | OpenAPI 类型重新生成 + 运行时样例核对 |
| 认证/权限/核心旅程 | 组件或集成测试，发布前补 E2E/烟雾测试 |
| 纯展示样式 | lint/typecheck/build + 明确的人工视觉验证 |

**跨端兼容规则：**

- 新字段优先做可选、提供默认值，后端先部署，前端后部署。
- 字段重命名或删除采用“新增新字段 → 客户端迁移 → 移除旧字段”的分阶段流程。
- 前后端分别提交时，在模块文档记录对应仓库 commit SHA 或发布批次标识。
- 破坏性变更必须明确部署顺序、兼容窗口和回滚方案，不允许前后端同时假定对方已部署。

**Definition of Done：**

- 验收标准全部满足，无已知 P0/P1 缺陷。
- `pnpm check` 通过；高风险或发布任务完成相应 E2E/烟雾测试。
- OpenAPI、生成类型、运行时行为一致，快照已脱敏且只作为验证样例。
- 公共行为变化已同步文档，提交中没有 secrets、无关文件或临时调试代码。
- 公网开发环境已按影响范围完成提交、推送、重启和最小烟雾验证；纯文档变更无需重启。

### 13. 模块文档模板

新增功能模块或公共行为发生变化时，创建/更新 `docs/modules/<module>.md`，包含以下章节；纯内部重构无需机械补文档：

1. 目标与范围 — 本次迭代做什么、哪些留到后续
2. 页面与路由 — 路由表、权限
3. 涉及 API — 端点、Method、Guard
4. 状态管理 — 服务端/客户端状态、缓存策略
5. 组件清单 — 每个组件路径和说明
6. 表单与校验 — Zod schema 与后端 DTO 对齐
7. 错误处理 — 错误码 → UI 行为映射
8. 权限与访问控制 — 未登录/无权限的处理
9. 验收标准 — checkbox 列表
10. 子任务 — 按完整用户行为拆分，标明风险、测试范围、跨端依赖和发布顺序

### 14. 开发步骤 Roadmap

按依赖顺序分阶段推进：

| Phase | 模块 | 文档 | 状态 |
|-------|------|------|------|
| 1 | 基础（项目初始化、部署、AuthContext） | AGENTS.md | 已完成 |
| 2 | 认证（登录/注册/忘记密码/重置/验证/导航） | `docs/modules/auth.md` | 已完成 |
| 3 | 首页（主题帖列表、分类、分页） | `docs/modules/home.md` | 已完成 |
| 4 | 创建主题帖（编辑器、草稿、发布） | `docs/modules/thread-create.md` | 已完成 |
| 5 | 主题帖详情与回复（子贴、楼层、楼中楼、帖内角色与订阅） | `docs/modules/thread-detail.md` | 已完成 |
| 6 | 用户（资料、关注、拉黑、草稿箱） | `docs/modules/profile.md` | 已完成 |
| 7 | 通知（列表、未读数、红点） | `docs/modules/notifications.md` | 已完成 |
| 8 | 搜索与收藏 | `docs/modules/search.md` + `docs/modules/bookmarks.md` | 已完成 |
| 9 | PC Web UI 美化（Misskey 风格、动画、桌面端布局） | — | 待开始 |

### 15. Git 提交

与后端保持一致：

**提交信息格式：**

```
<type>: <中文简述>

- 要点 1
- 要点 2
```

**Type：**

| Type | 用途 |
|------|------|
| `feat` | 新功能、新页面、新组件 |
| `fix` | bug 修复 |
| `refactor` | 重构（不改变外部行为） |
| `docs` | 纯文档更新 |
| `chore` | 依赖、配置、脚本 |
| `style` | 纯样式调整 |
| `test` | 测试相关 |

**分支：**

- `dev` — 开发分支，日常开发在此提交（前端当前唯一分支，由 master 改名而来）
- `feat/<模块>` — 可选功能分支，合并到 dev
- （如需可部署主干，后续再从 dev 分离 `main`）

**提交示例：**

```
feat: 实现登录页面

- 新增 /login 页面与登录表单
- 使用 react-hook-form + zod 校验邮箱/密码
- 调用 POST /auth/login 并存储 accessToken
- 同步更新 docs/modules/auth.md
```

**提交/合并前检查：**

- [ ] `pnpm check` 通过
- [ ] 高风险或发布变更完成 `pnpm check:full` 或等价集成验证
- [ ] 相关模块文档 `docs/modules/<module>.md` 已更新
- [ ] 没有混入无关文件或 secrets
- [ ] 提交对应完整行为，部署顺序和兼容性已明确

### 16. 代码规范

#### 文件头部注释

仅在文件职责无法从路径、导出名称或框架约定看出时添加用途说明；注释重点解释约束、原因和非显然逻辑，不重复代码字面含义。

```ts
/** 登录页面：用户邮箱密码登录 */
```

#### 命名约定

| 类型 | 规范 |
|------|------|
| 页面组件 | `page.tsx`（Next.js 约定） |
| 业务组件 | PascalCase，如 `LoginForm` |
| 自定义 hook | `useXxx`，如 `useAuth`、`useCountdown` |
| API hooks | `src/api/hooks/use-xxx.ts`，封装 openapi-fetch |
| 校验 schema | `src/lib/validations/xxx.ts`，遵循 Zod 4 API |
| 工具函数 | camelCase，如 `cn` |

#### 表单规范

- 统一用 `react-hook-form` + `zod`。
- Zod schema 与后端 DTO 对齐。
- 所有 Zod 校验 schema 统一放在 `src/lib/validations/` 下，页面中直接引入。
- 提交按钮显示 loading 状态。

#### 错误处理

- 统一用 `sonner` toast。
- 401 自动处理（apiClient 拦截器），页面不需重复。
- 业务错误按后端 `docs/frontend-guide.md` 的错误码速查和模块文档映射。
- 兜底错误文案："操作失败，请稍后重试"。

#### Zod 4 注意

- `ZodError.errors` → `ZodError.issues`（Zod 4 API 变更）。

### 17. 安全注意

- 客户端不暴露密钥、数据库密码等。
- 渲染用户输入 Markdown 时使用 sanitization。
- 不要长期把 `next dev` 暴露在公网。
- API 快照不得包含 token、Cookie、真实邮箱、设备信息或可关联用户的稳定标识符。
- 任何会写数据的快照/E2E 脚本必须拒绝生产地址，并使用可清理的专用测试账号。

### 18. 测试规范

#### 框架选型

| 工具 | 用途 |
|------|------|
| vitest | 测试运行器 + 断言 + mock（与 Vite 原生集成） |
| @testing-library/react | React 组件渲染 |
| @testing-library/user-event | 模拟真实用户交互 |
| happy-dom | 轻量 DOM 环境（无需完整 jsdom） |
| @playwright/test | E2E 端到端测试（Chromium 真实浏览器，测编辑器/全流程） |

#### 目录与命名

```
src/
  lib/
    __tests__/
      utils.test.ts        # 纯函数测试
  lib/validations/
    __tests__/
      auth.test.ts         # Zod schema 测试
      thread-create.test.ts
  api/hooks/
    __tests__/
      use-threads.test.ts  # hooks 测试
      use-thread-detail.test.ts
  components/thread/
    __tests__/
      thread-card.test.tsx # 组件测试
      floor-card.test.tsx
      floor-form.test.tsx
e2e/
  thread-create.spec.ts   # E2E 全流程测试（真实浏览器）
```

- 测试文件命名：`<被测模块>.test.{ts,tsx}`
- 测试文件放 `__tests__/` 子目录（保持 import 路径简洁）
- E2E 测试放 `e2e/` 目录，Playwright 直接运行

#### 必须测试的模块

| 优先级 | 模块 | 说明 |
|--------|------|------|
| P0 | Zod 校验 schema | 纯逻辑，投入产出比最高，正常/边界/错误三类输入 |
| P0 | 工具函数 | `cn()`、`normalizeThreadDetail()` 等 |
| P1 | API data hooks | `useQuery`/`useInfiniteQuery` 型 hooks，mock apiClient |
| P1 | Mutation hooks | 用 `useMutation` 的 hooks，验证 invalidation 行为 |
| P1 | 核心业务组件 | 含条件渲染、用户交互、表单提交的组件 |
| P2 | Auth 状态管理 | `AuthProvider`、认证守卫逻辑 |
| 可跳过 | 纯展示组件 | 无交互、无分支的静态 UI |
| 可跳过 | 第三方编辑器封装 | Milkdown 等，复杂度过高 |

#### Hooks 测试模式

```ts
// 1. mock apiClient 模块
import { vi } from "vitest";
vi.mock("@/api/client", () => ({
  apiClient: { GET: vi.fn(), POST: vi.fn(), PATCH: vi.fn(), DELETE: vi.fn() },
}));

// 2. 创建 QueryClient wrapper
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

// 3. renderHook 测试
import { renderHook, waitFor } from "@testing-library/react";
const { result } = renderHook(() => useThreads({}), { wrapper: createWrapper() });
await waitFor(() => expect(result.current.isSuccess).toBe(true));
```

#### 组件测试模式

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// 1. mock 子组件或 hooks
vi.mock("@/api/hooks/use-threads", ...);

// 2. 对每种状态（loading/error/empty/data）写独立测试
test("loading 状态显示 spinner", () => { ... });
test("错误状态显示重试按钮", () => { ... });
test("空列表显示空状态提示", () => { ... });
test("正常数据渲染列表项", () => { ... });
```

#### Zod schema 测试模式

```ts
test("合法输入通过校验", () => {
  expect(schema.safeParse(validData).success).toBe(true);
});
test("非法输入列出具体 issue", () => {
  const result = schema.safeParse(invalidData);
  expect(result.success).toBe(false);
  if (!result.success) {
    expect(result.error.issues[0].message).toMatch(/邮箱/);
  }
});
```

#### 运行测试

```bash
pnpm test           # 单次全量运行
pnpm test:watch     # watch 模式（开发时用）
E2E_ENV=test pnpm test:e2e # Playwright E2E；自动启动独立 3101 前端，要求本机后端已启动
```

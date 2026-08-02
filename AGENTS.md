# 温油站前端 — AI 辅助编程上下文

## 项目概述

温油站 Web 端。基于 Next.js 16 + React 19 + TypeScript 5 + Tailwind CSS 4 + shadcn/ui。
与 NestJS 后端共用一套 REST API，通过 OpenAPI 生成类型。

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
pnpm test:e2e     # Playwright E2E 测试
pnpm generate:api # 需要后端已启动
```

**dev server 内存说明：** Next 16 dev 用 Turbopack，会把访问过的路由（尤其 `/threads/create`、`/threads/[id]` 的 Milkdown+Vue 编辑器模块图）编译结果常驻内存，RSS 随访问路由累积（可到 4GB+）。这是 dev-only 的编译缓存，**生产 standalone 构建不会这样**。缓解：`dev` 脚本已加 `NODE_OPTIONS=--max-old-space-size=3072`；若 RSS 仍接近 3GB 或测试/build 因内存不足挂起，**重启 `pnpm dev`** 即可释放（首访会重新编译几秒）。若改动后 dev 首次编译 OOM，可调低/移除该 NODE_OPTIONS。

### 4. API 请求

- 统一使用 `src/api/client.ts` 中的 `apiClient`。
- 不要在页面里直接调用 `fetch`，统一走 TanStack Query hooks。
- 后端运行后执行 `pnpm generate:api` 生成 `src/api/types.ts`。
- 错误码处理按后端 `error-handling.md` 统一映射。
- **API 事实快照**：新模块开发前，运行 `npx tsx scripts/api-verify.ts`（或指定模块 `--module=threads`）抓取所有涉及端点的真实响应 JSON 到 `docs/snapshots/`。**手写 hooks 类型时必须以此快照为依据，不得凭设计文档猜测。** 快照文件随模块文档一起提交，作为类型契约。

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
- @提及功能后续通过 Milkdown 插件实现。

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
| `/threads/[id]/edit` | 编辑主题帖 |
| `/notifications` | 通知 |
| `/users/[id]` | 用户主页 |
| `/me` | 我的资料 |

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

#### 公网生产模式迭代（VPS 手动运行，省内存）

公网访问一律用**生产模式**（后端 `node dist/main` + 前端 standalone），**不用 `next dev` 暴露公网**：dev 的 Turbopack 编译缓存会让 RSS 随时间涨到数 GB 导致机器卡死（见第 3 节），生产模式两者合计仅 ~0.3GB、稳定不涨。

**生产模式没有热更新**——改代码必须「重新构建 → 重启进程」，这是生产模式迭代的唯一代价。

前端重启（改代码后）：

```bash
cd /root/wenyousite/wenyousite-frontend
pnpm build
cp -r .next/static .next/standalone/.next/static   # standalone 需静态资源
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
- 验证：`curl -sI https://wenyou.site`（前端 200）+ `curl -s https://wenyou.site/api/v1/health`（后端 database up）

### 12. 迭代流程（Docs-First + API-First + Test-in-the-Loop）

每个功能模块按以下步骤推进：

**阶段一：模块级准备**

1. **定模块** → 创建/更新 `docs/modules/<module>.md`
2. **拆最小切片** → 在文档里将功能拆为可独立交付的子任务（见下方"切片粒度"）
3. **API 先验** → `curl` 或 Swagger Try-it 跑一遍涉及的所有端点，把**真实响应 JSON 粘到模块文档的"API 响应快照"小节**。这是手写类型的唯一依据——`docs_direct` 是设计意图，API 真实响应才是事实。
4. **后端对齐** → 对照响应发现缺失字段 → 先改后端（include/DTO） → 再回前端写 hooks 类型（后端先行原则）

**阶段二：切片级循环（每个切片独立执行以下步骤）**

1. **写测试**（P0 先写测试再实现；P1 测试与实现同步；P2 实现后补测试）
2. **写代码** → 页面、组件、API hooks、校验 schema（类型一对一对应 API 快照）
3. **同步文档** → 涉及到的接口/字段/行为变化，随实现一起更新到 `docs/modules/<module>.md`
4. **质量检查** → `pnpm lint && pnpm typecheck && pnpm test`
5. **原子提交** → 该切片代码 + 测试 + 文档更新同一次 commit

**切片粒度（一个 commit 的大小）：**

| 切片大小 | 示例 | 提交 Type |
|----------|------|-----------|
| 1 个 Zod schema | `src/lib/validations/xxx.ts` + 测试 | `feat:` |
| 1 个 API hook | `src/api/hooks/use-xxx.ts` + 测试 | `feat:` |
| 1 个纯展示组件 | `src/components/xxx.tsx` + 测试 | `feat:` |
| 1 个表单/业务组件 | `src/components/forms/xxx.tsx` + 测试 | `feat:` |
| 1 个页面集成 | `src/app/xxx/page.tsx`（组合已有组件，不含新组件） | `feat:` |
| 1 个工具函数 | `src/lib/xxx.ts` + 测试 | `feat:` |
| bug 修复 | 含回归测试 | `fix:` |
| E2E 测试 | `e2e/xxx.spec.ts`（在相关切片之后单独提交） | `test:` |
| 文档更新 | 仅文档，无代码变更 | `docs:` |
| 依赖/配置 | 纯 `package.json` / 构建脚本 | `chore:` |

**反例（不合规的切片）：**
- 把 3 个 hook + 1 个组件 + 1 个页面合在一次提交 → 不可独立回滚
- 先提交代码、后补测试拆分到另一个 commit → 测试应同步提交

**拆分示例（以 thread-create 模块为例）：**

```
├── 切片1：Zod schema         → 测试 + 实现 → feat: 主题帖表单校验 schema
├── 切片2：useCreateThread    → 测试 + 实现 → feat: useCreateThread API hook
├── 切片3：useUpdateThread    → 测试 + 实现 → feat: useUpdateThread API hook
├── 切片4：useDeleteThread    → 测试 + 实现 → feat: useDeleteThread API hook
├── 切片5：uploadImage 工具   → 测试 + 实现 → feat: 图片上传工具函数
├── 切片6：MilkdownEditor     → 编辑区（跳单测）→ feat: Milkdown Crepe 编辑器
├── 切片7：ThreadCreateForm   → 测试 + 实现 → feat: 主题帖创建表单组件
├── 切片8：CreateThreadPage   → 页面集成 → feat: /threads/create 创建页面
├── 切片9：E2E                → 实现 → test: E2E 主题帖创建全流程
└── （每一步 commit 都包含对应文档更新）
```

**铁律：**
- 不写文档不开始编码。
- **不准凭设计文档猜类型——以真实 API 响应为准。**
- 接口/字段/行为变了，必须同步改文档。
- `docs_direct` 与实际 API 冲突时，以真实响应为准修正 docs_direct。
- 一个 commit 只包含一个可独立回滚的逻辑单元（即一个切片）。
- **测试必须在实现代码之前或同步编写，不得后补。**

### 13. 模块文档模板

每个功能模块必须写 `docs/modules/<module>.md`，包含以下章节：

1. 目标与范围 — 本次迭代做什么、哪些留到后续
2. 页面与路由 — 路由表、权限
3. 涉及 API — 端点、Method、Guard
4. 状态管理 — 服务端/客户端状态、缓存策略
5. 组件清单 — 每个组件路径和说明
6. 表单与校验 — Zod schema 与后端 DTO 对齐
7. 错误处理 — 错误码 → UI 行为映射
8. 权限与访问控制 — 未登录/无权限的处理
9. 验收标准 — checkbox 列表
10. 子任务 — 按最小可回滚切片拆分为独立 commit，每个切片独立测试（P0/P1）/ 实现 / 文档更新 / 质量检查

### 14. 开发步骤 Roadmap

按依赖顺序分阶段推进：

| Phase | 模块 | 文档 | 状态 |
|-------|------|------|------|
| 1 | 基础（项目初始化、部署、AuthContext） | AGENTS.md | 已完成 |
| 2 | 认证（登录/注册/忘记密码/重置/验证/导航） | `docs/modules/auth.md` | 已完成 |
| 3 | 首页（主题帖列表、分类、分页） | `docs/modules/home.md` | 已完成 |
| 4 | 创建主题帖（编辑器、草稿、发布） | `docs/modules/thread-create.md` | 已完成 |
| 5 | 主题帖详情与回复（子贴、楼层、楼中楼） | `docs/modules/thread-detail.md` | 已完成 |
| 6 | 用户（资料、关注、拉黑、草稿箱） | `docs/modules/profile.md` | 已完成 |
| 7 | 通知（列表、未读数、红点） | `docs/modules/notifications.md` | 已完成 |
| 8 | 搜索与收藏 | `docs/modules/search.md` + `docs/modules/bookmarks.md` | 已完成 |
| 9 | UI 美化（Misskey 风格、动画、响应式） | — | 待开始 |

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

**提交前检查：**

- [ ] `pnpm lint` 通过
- [ ] `pnpm typecheck` 通过
- [ ] `pnpm test` 通过（新增逻辑必须含测试，不可后补）
- [ ] `pnpm build` 通过
- [ ] 相关模块文档 `docs/modules/<module>.md` 已更新
- [ ] 没有混入无关文件或 secrets
- [ ] 提交粒度合理

### 16. 代码规范

#### 文件头部注释

每个 `.ts/.tsx` 文件顶部加一行用途说明：

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
- 业务错误按 `docs/frontend/error-handling.md` 映射。
- 兜底错误文案："操作失败，请稍后重试"。

#### Zod 4 注意

- `ZodError.errors` → `ZodError.issues`（Zod 4 API 变更）。

### 17. 安全注意

- 客户端不暴露密钥、数据库密码等。
- 渲染用户输入 Markdown 时使用 sanitization。
- 不要长期把 `next dev` 暴露在公网。

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
pnpm test:e2e       # Playwright E2E 测试（需前端 dev server 已启动）
```

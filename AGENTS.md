# 温油站前端 — Codex 工作约定

## 1. 项目边界

- 本仓库是温油站 **PC Web 前端**；移动端由 Flutter 项目承担，不在这里实现响应式移动版。
- 技术主线：Next.js App Router、React、TypeScript、Tailwind CSS、TanStack Query、React Hook Form + Zod、Vitest、Playwright。
- 公网运行拓扑以工作区 [README](../README.md) 为唯一事实源；脚本和依赖命令以 `package.json` 为准。
- 修改前先读受影响模块及其测试、`docs/modules/` 文档；不要为小改动复制新的流程说明。

## 2. 不可破坏的实现约束

### API 与契约

- 页面和组件不得直接 `fetch` 后端。请求统一经过 `src/api/client.ts` 的 `apiClient`，再由 `src/api/hooks/` 暴露。
- `contracts/openapi.json` 是已提交的后端契约快照，生成类型位于 `src/api/types.ts`；不要手改生成文件。
- 后端可观察接口变化必须先更新后端 OpenAPI，再执行契约同步/类型生成，并修正前端调用与测试。
- 浏览器固定访问同域 `/api/v1`。服务端代理使用 `BACKEND_URL`；不要新增代码未读取的 `NEXT_PUBLIC_*` API 地址。

常用契约命令：

```bash
pnpm contract:check
pnpm contract:sync
pnpm generate:api
```

### 认证与安全

- Access token 只保存在内存；Refresh token 只使用后端设置的 HttpOnly Cookie。禁止把凭证写入 localStorage、sessionStorage、日志或错误上报。
- 受保护页面使用现有 `RequireAuth`/认证状态，不自建第二套登录态。
- 所有未信任富文本、Markdown、URL 和上传内容沿用现有清洗与校验链路；不要用 `dangerouslySetInnerHTML` 绕过它。
- 不提交 `.env*`、密钥、测试账号密码或真实会话数据。需要环境变量时同步更新 `.env.example`。

### 数据、组件与交互

- 复用现有 Query Key、失效策略和错误处理；Mutation 必须明确成功后的缓存更新/失效及失败后的 UI 状态。
- 远程数据界面应覆盖 loading、error、empty、success；交互控件应有 disabled/pending 状态，避免重复提交。
- 表单统一使用 React Hook Form + Zod；服务端字段错误映射到对应控件，非字段错误显示为页面或表单级反馈。
- 样式组合使用现有 `cn()`；复用 `src/components/ui/` 与模块组件，避免在页面中堆积重复实现。
- 业务 UI 不得绕过语义 Token、共享 Select/Tabs/Dialog 或 `PageShell` 语义宽度；`pnpm design:check` 是静态门禁。
- 富文本编辑继续使用 Milkdown；除非任务明确要求，不引入第二套编辑器或平行数据格式。
- 保持 App Router 的 Server/Client Component 边界；仅在确需浏览器 API、状态或事件时添加 `"use client"`。
- 可观察行为、契约或运行方式改变时，更新对应 `docs/modules/` 文档；纯重构无需制造文档变更。
- 跨端审美、Token、字体与体验能力以 `foundation.lock.json` 锁定的 `morenk/wenyousite-foundation` 为唯一事实源；`docs/design-system.md` 只记录 Web 接入映射，`docs/modules/` 只描述当前可观察行为与验收约束。

## 3. 测试与质量门禁

按风险选择最小但充分的验证：

- 纯函数、Schema、Hook、缓存更新：Vitest 单元测试。
- 组件状态、表单、乐观更新、可访问性交互：Testing Library 组件测试。
- 路由、代理、认证跳转、跨页面核心旅程：Playwright 或等价端到端验证。
- API 契约变化：契约检查、生成类型编译与受影响模块测试。
- Bug 修复必须增加能复现该问题的回归测试，除非只能由外部基础设施验证；此时在交付说明中写清验证方法。

实现过程中先跑受影响测试；代码任务交付前运行：

```bash
pnpm check
```

`pnpm check` 已覆盖 lint、类型、架构、契约、测试、文档和构建，以 `package.json` 当前定义为准。认证/权限、核心旅程或高风险跨端变更再运行：

```bash
pnpm check:full
```

- `pnpm check:full` 把本次生成的 standalone 候选构建隔离运行在 `127.0.0.1:3101`；Playwright 不复用已部署的 `3001` 进程。
- 完整 Playwright E2E 只连本机 loopback 后端，并使用可清理的专用测试账号。
- 公网开发环境可做**定向写入烟雾测试**，但必须使用专用测试账号、只创建可识别测试数据、验证后清理；禁止批量或不可逆操作。
- 纯文档变更只做链接、格式和差异检查，不运行 `pnpm check`、不构建、不重启服务。
- 不通过降低断言、跳过用例、扩大 lint 警告基线来掩盖失败；修复根因或明确汇报阻塞。

## 4. 公网开发环境交付

`wenyou.site` 当前是**单一公网开发环境**，没有真实用户。它使用 production build 运行以节省资源和保持稳定，但不等同于正式生产发布，不需要维护窗口或发布审批。

代码任务的默认完成链路：

1. 实现并运行相关测试。
2. 运行 `pnpm check`；认证/权限、核心旅程或高风险变更补充带专用账号的 `pnpm check:full`。
3. 自动重启受影响服务，不另行等待部署授权。
4. 检查公网健康、受影响页面/旅程和最近日志。
5. 汇报变更与验证结果。

除非用户明确要求，**不要创建 Git commit，也不要 push**。若明确要求提交，使用 `feat|fix|refactor|test|docs|chore(scope): 中文说明`，且只包含本任务相关文件。

### 前端切换规则

- Next.js 使用 `output: "standalone"`，宿主机进程监听 `3001`；PostgreSQL/Redis 才由 Docker Compose 管理。
- `pnpm check` 已包含 `next build`。源码未再变化时不要重复 build。
- 线上进程必须从 `/var/lib/wenyousite/frontend/releases/` 下的不可变 release 运行，不能直接运行会被 `next build` 重写的 `.next/standalone`。
- 只要运行过 `pnpm check` 或 `pnpm build`，必须使用切换脚本组装 static/public、预检并切换 3001；脚本失败时保留或恢复上一成功版本。
- 纯前端变化只切换前端；后端或契约同时变化时，先切换并验证后端，再同步契约、检查和切换前端。

检查完成后的前端切换：

```bash
cd /root/wenyousite/wenyousite-frontend
bash scripts/deploy-standalone.sh
```

切换后至少验证：

```bash
curl --fail --silent --show-error --head https://wenyou.site >/dev/null
curl --fail --silent --show-error https://wenyou.site/api/v1/health >/dev/null
tail -n 100 /tmp/opencode/wenyousite-frontend.log
```

再验证本次实际受影响页面。启动失败、持续 5xx 或关键路径失败时，优先前滚修复；不要让损坏构建继续在线。

跨前后端的完整检查、迁移和切换可使用后端仓库的 `scripts/deploy.sh`；不要在前端再复制一套全栈部署脚本。

## 5. 参考文档

- [工作区运行拓扑](../README.md)
- [前端 API 与模块文档](docs/modules/api-contract.md)
- [后端前端接入指南](../wenyousite-backend/docs/frontend-guide.md)
- [API 契约说明](../wenyousite-backend/docs/api-contract.md)
- [前端 OpenAPI 快照](contracts/openapi.json)

详细设计放在对应代码和模块文档中；本文件只维护跨任务都必须遵守的约束。

# 温油站前端

温油站 PC Web 客户端，基于 Next.js 16、React 19、TypeScript、TanStack Query 和 Tailwind CSS。

## 实时开发预览

默认使用 VPS 上的任务 Worktree 和 Backend 交互式隔离会话；无需合并、部署或 production build 才能看修改。agent 负责启动并持续复用 Fast Refresh，Windows 浏览器通过治理仓库的 SSH 预览入口访问同端口服务。

```bash
pnpm install --frozen-lockfile
pnpm dev:preview start --task <任务ID> --descriptor /absolute/path/consumer.json
pnpm dev:preview status --task <任务ID>
pnpm dev:preview stop --task <任务ID>
```

`pnpm dev` 是同一安全入口的别名，也必须提供任务和显式描述。`consumer.json` 由已启动的 Backend 预览会话导出，Web 使用其中的 `web.port`；不要手写配置、指向线上 3000/3001 或变更本机转发端口。完整生命周期、媒体和核验说明见 [开发预览模块](./docs/modules/dev-preview.md)。

样式反馈阶段只运行直接相关组件和定向检查，连续反馈复用同一会话。画面确认、反馈收敛后，再对最终源码执行下方交付门禁。

## 常用命令

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:coverage
pnpm check
pnpm check:full
pnpm build
pnpm generate:api
```

`pnpm check` 校验 OpenAPI 生成类型、查询键与 UI/API 分层、覆盖率阈值、文档事实和生产构建。

完整 E2E 与富文本真实 API 统一通过已提交的后端隔离 runner，每轮新建 PostgreSQL、Redis、随机账号和随机端口。按照 [E2E 接入说明](./docs/rich-text-real-api-acceptance.md) 显式配置后端 checkout、提交 SHA 和只读工具后，执行 `pnpm test:e2e`、`pnpm test:e2e:candidate`、`pnpm check:full` 或 `bash scripts/test-rich-text-real-api.sh`。缺少身份立即拒绝，不能用线上地址、`E2E_ENV=test` 或外部账号绕过。

所有浏览器用例统一继承隔离 fixture，登录和实际写入前核验本轮资源进程及候选服务真实 `/api/v1` 代理。候选使用 `.next-e2e`，复制到本轮私有目录运行；生产 `.next` 不受影响，测试产物不能部署。报告只保留脱敏诊断，清理未确认时不报告通过。

线上只允许匿名只读烟雾（健康、登录页、公开阅读），不携带真实登录态。该命令阻断非 GET/HEAD、白名单外 GET、自动签到、上传、发帖、回复和重定向；外部媒体也默认阻断。普通阅读可能产生服务端访问日志和阅读统计。

```bash
pnpm test:e2e:guards
pnpm test:smoke:readonly
# 仅验证已部署 Web 的匿名读取；不表示 3000 后端已隔离。
SMOKE_BASE_URL=http://127.0.0.1:3001 pnpm test:smoke:readonly
```

Web access token 只驻留内存，页面刷新通过 httpOnly refresh cookie 恢复；浏览器存储中不持久化凭证。

项目使用 Next.js standalone 生产构建。模块设计、API 覆盖状态和迭代流程分别见 [开发文档](./docs/README.md)、[API 覆盖审计](./docs/api-coverage.md) 和 [AGENTS.md](./AGENTS.md)。

# 温油站前端

温油站 PC Web 客户端，基于 Next.js 16、React 19、TypeScript、TanStack Query 和 Tailwind CSS。

## 日常开发

Web 在 VPS 任务 Worktree 运行普通 Next.js dev，保留 Fast Refresh；Windows 浏览器通过 SSH 转发查看。开发启动不依赖快照、consumer 描述或专用控制器，也无需合并、部署或 production build。

```bash
pnpm install --frozen-lockfile
# 先确认实际后端与数据环境；端口选择本任务独占的空闲值。
BACKEND_URL=http://127.0.0.1:3000 pnpm dev --port 3101
```

在 Windows 单独保持 SSH 转发：

```powershell
ssh -N -o ExitOnForwardFailure=yes -L 3101:127.0.0.1:3101 wenyou-dev-vps
```

随后打开 `http://127.0.0.1:3101`。上面的 `3000` 是现有真实数据后端示例，不是隔离环境；使用其他后端时显式替换地址。缺少 `BACKEND_URL` 时开发入口会报错，不能默默连接现网。日常手动开发与自动化验收的边界见 [日常开发模块](./docs/modules/development.md)。

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

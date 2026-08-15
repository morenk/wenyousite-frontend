# 温油站前端

温油站 PC Web 客户端，基于 Next.js 16、React 19、TypeScript、TanStack Query 和 Tailwind CSS。

## 本地开发

```bash
pnpm install
pnpm dev
```

开发服务默认运行在 `http://localhost:3001`，后端 API 默认运行在 `http://localhost:3000/api/v1`。

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

`pnpm check` 会校验 OpenAPI 生成类型、查询键与 UI/API 分层、覆盖率阈值、文档事实和生产构建。`pnpm check:full` 在此基础上把刚生成的 standalone 构建复制到临时目录并监听 `127.0.0.1:3101`，Playwright 只测试这份候选构建，不复用 `3001` 上的已部署版本。E2E 会写入测试数据，只允许连接本机后端，运行前按 `.env.e2e.example` 提供专用测试账号：

```bash
E2E_EMAIL=... E2E_PASSWORD=... pnpm check:full
```

Web access token 只驻留内存，页面刷新通过 httpOnly refresh cookie 恢复；浏览器存储中不持久化凭证。

项目使用 Next.js standalone 生产构建。模块设计、API 覆盖状态和迭代流程分别见 [开发文档](./docs/README.md)、[API 覆盖审计](./docs/api-coverage.md) 和 [AGENTS.md](./AGENTS.md)。

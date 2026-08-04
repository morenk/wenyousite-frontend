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
pnpm build
pnpm generate:api
```

项目使用 Next.js standalone 生产构建。模块设计、API 覆盖状态和迭代流程分别见 [开发文档](./docs/README.md)、[API 覆盖审计](./docs/api-coverage.md) 和 [AGENTS.md](./AGENTS.md)。

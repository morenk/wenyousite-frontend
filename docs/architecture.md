# Web 前端架构

## 边界

前端是纯 PC Web 客户端，使用 Next.js App Router 组织路由，但不以 SEO、SSR 或 React Server Components 作为产品目标。页面层负责路由装配；需要浏览器状态和交互的功能保持 Client Component。后端数据仍通过同域 `/api/v1` 与固定 OpenAPI 契约访问。

生产源码按单向依赖组织：

```text
app（路由装配）
  └─ components（业务界面）
       ├─ api/hooks（远程状态与缓存编排）
       ├─ components/ui、components/shared（无业务依赖的界面原语）
       └─ lib（纯规则、展示映射与浏览器基础设施）
api/hooks ──> api/client、api/query-keys、api/types、lib
lib ──> api/types（只允许契约类型），不能反向依赖组件
```

`src/api/hooks/use-admin.ts` 是稳定导出入口，实际按认证、案件、治理和配置拆分在 `src/api/hooks/admin/`。动态评论按列表编排、输入表单、回复线程和评论行拆分；主题帖管理把纯 reducer/基线状态与副作用控制器分开；Milkdown 把外层草稿/计数壳与编辑器宿主集成分开。

## 状态与契约

- 服务端状态由 TanStack Query 管理，查询键只从 `src/api/query-keys.ts` 构造；缓存更新和失效位于 API hook。
- Access token 只驻留内存，refresh token 只使用 HttpOnly Cookie。
- `contracts/openapi.json` 和生成的 `src/api/types.ts` 是响应结构事实源，不维护第二套运行时响应快照。
- Foundation 版本由 `foundation.lock.json` 锁定，Web 映射见 `docs/design-system.md`。

## 自动门禁

`pnpm arch:check` 校验查询键、UI/API 访问方式、通用组件反向依赖、`api`/`lib` 层方向、生产源码循环依赖，以及已拆分热点入口的规模。`pnpm docs:check` 从 OpenAPI、源码、Foundation 锁和模块索引推导文档事实。覆盖率除全局阈值外，对站务 hooks、站务组件、主题帖组件与 `lib` 分域设阈值。

构建和交付语义见根目录 `AGENTS.md`：`pnpm check:full` 在 3101 测试刚生成的候选 standalone，验证通过后才由切换脚本部署到 3001。

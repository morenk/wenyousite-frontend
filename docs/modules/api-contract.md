# 跨端 API 契约

## 1. 目标与范围

本模块固化 Web 与 Flutter 共用的 REST/OpenAPI 契约。后端 Swagger DTO 是源事实，后端评审并提交的 `contracts/openapi.json` 是客户端生成的固定事实源；Web 不维护影子响应类型，也不在构建期间抓取运行中 Swagger。

当前所有用户端模块均由 `src/api/types.ts` 提供请求和成功响应类型；`pnpm contract:check` 会从仓库内固定契约重新生成到临时目录并逐字节比较，同时拒绝 hooks 中的 `as unknown as` 和手写 `*Response` interface。存在相邻后端仓库时还会校验两份审核产物逐字节一致。

契约更新流程是 `pnpm contract:sync && pnpm generate:api`。前者只复制后端已提交产物，后者只读取本仓库固定产物；因此单仓 CI、历史 commit 和客户端发布分支都可重复生成同一类型。

## 2. 页面与路由

不新增页面或路由；影响主题帖创建、详情、楼中楼和编辑器草稿面板中的 API 调用。

## 3. 涉及 API

| 模块 | 端点 |
|------|------|
| 提及 | `GET /users/mention-candidates` |
| 元数据 | `GET /meta`（契约/Markdown 版本与能力开关） |
| 动态分类 | `GET /thread-categories`（管理员配置的启用分类；客户端保存稳定 slug） |
| 媒体 | `POST /media/upload-url`、`POST /media/upload-done`、`GET /media/:id`（具名缩略图/中图 URL） |
| 草稿 | `/drafts`、`/drafts/slots`、`/drafts/:id` |
| 帖子 | `/subthreads/:subthreadId/posts`、`/subthreads/:subthreadId/body`、`/posts/:id`、`/posts/:id/replies` |

成功响应统一为 `{ code, message, data, meta? }`。业务 DTO 位于 `data`，cursor 分页位于 `meta`。

`scripts/check-flutter-contract.mjs` 验证 OpenAPI 3.0、稳定 lowerCamel operationId、具名 2xx 响应、非空查询 schema、移动基线端点、动态分类开放字符串与错误码 schema。这是快速静态门禁；CI 另用固定版本 OpenAPI Generator 的 `dart-dio` 目标执行真实生成烟雾。

契约版本以 `contracts/openapi.json` 的 `info.version` 为准，不在说明文档中复制易过期的版本号。主题帖分类字段是可空字符串而非封闭枚举：草稿可为 `null`，发布必须使用 `GET /thread-categories` 返回的启用 slug。Web 与 Flutter 均消费 `contracts/thread-category-v1-fixtures.json` 黄金用例，不得复制任何现有 slug、名称或颜色作为运行时回退；未知 slug 显示原值，空值显示“未分类”，未知响应字段必须忽略。

## 4. 状态管理

TanStack Query 缓存键统一由 `src/api/query-keys.ts` 构造。领域 mutation 在对应 API hook 内完成缓存更新/失效，页面与组件不编排服务端缓存。

## 5. 组件清单

- `src/components/editor/milkdown-editor-core.tsx`：通过领域 hook 使用生成的提及候选类型。
- `src/lib/upload-image.ts`：使用生成的媒体上传 DTO。
- `src/api/hooks/`：帖子与草稿 hooks 使用生成响应类型。

## 6. 表单与校验

请求 DTO 继续由 `src/api/types.ts` 生成；不新增 Zod 规则。

## 7. 错误处理

HTTP/业务错误由 `src/api/errors.ts` 统一归一化；成功响应不得使用 `as unknown as` 伪造 envelope。

## 8. 权限与访问控制

不改变后端 Guard。Web 继续通过 accessToken 调用相应端点。

## 9. 验收标准

- `pnpm generate:api` 生成的编辑器相关响应均包含强类型 `data`
- 所有生产 API hooks 不再手写成功响应 envelope
- 生成类型、query key、UI/API 分层均有静态门禁
- 动态分类黄金用例与后端副本一致，Flutter 契约门禁拒绝分类枚举化
- lint、typecheck、覆盖率测试和生产构建纳入 `pnpm check`

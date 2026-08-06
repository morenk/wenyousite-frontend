# 跨端 API 契约

## 1. 目标与范围

本模块固化 Web 与 Flutter 共用的 REST/OpenAPI 契约。后端 Swagger DTO 是结构唯一事实源，Web 不维护影子响应类型。

当前所有用户端模块均由 `src/api/types.ts` 提供请求和成功响应类型；`pnpm contract:check` 会离线重新生成到临时目录并逐字节比较，同时拒绝 hooks 中的 `as unknown as` 和手写 `*Response` interface。

## 2. 页面与路由

不新增页面或路由；影响主题帖创建、详情、楼中楼和编辑器草稿面板中的 API 调用。

## 3. 涉及 API

| 模块 | 端点 |
|------|------|
| 提及 | `GET /users/mention-candidates` |
| 媒体 | `POST /media/upload-url`、`POST /media/upload-done`、`GET /media/:id` |
| 草稿 | `/drafts`、`/drafts/slots`、`/drafts/:id` |
| 帖子 | `/subthreads/:subthreadId/posts`、`/subthreads/:subthreadId/body`、`/posts/:id`、`/posts/:id/replies` |

成功响应统一为 `{ code, message, data, meta? }`。业务 DTO 位于 `data`，cursor 分页位于 `meta`。

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

- [x] `pnpm generate:api` 生成的编辑器相关响应均包含强类型 `data`
- [x] 所有生产 API hooks 不再手写成功响应 envelope
- [x] 生成类型、query key、UI/API 分层均有静态门禁
- [x] lint、typecheck、覆盖率测试和生产构建纳入 `pnpm check`

## 10. 子任务

- [x] 重新生成 OpenAPI 类型
- [x] 迁移提及和媒体上传调用
- [x] 迁移帖子与草稿 hooks
- [x] 更新测试与质量检查
- [x] 接入可重复执行的契约门禁

# 跨端 API 契约

## 1. 目标与范围

本模块固化 Web 与 Flutter 共用的 REST/OpenAPI 契约。本次切片重新生成 Web 类型，并移除编辑器链路对成功响应 envelope 的手写猜测。

本次包含：提及候选、媒体上传、草稿、楼层/楼中楼、帖子详情与编辑。其他业务模块的响应 DTO 完善留到后续独立切片。

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

TanStack Query 的缓存键和失效策略不变；本切片只替换响应类型来源，不改变请求时序和 UI 状态。

## 5. 组件清单

- `src/components/editor/milkdown-editor.tsx`：使用生成的提及候选 envelope。
- `src/lib/upload-image.ts`：使用生成的媒体上传 DTO。
- `src/api/hooks/`：帖子与草稿 hooks 使用生成响应类型。

## 6. 表单与校验

请求 DTO 继续由 `src/api/types.ts` 生成；不新增 Zod 规则。

## 7. 错误处理

HTTP/业务错误处理保持现状。成功响应不再使用 `as unknown as` 伪造 envelope。

## 8. 权限与访问控制

不改变后端 Guard。Web 继续通过 accessToken 调用相应端点。

## 9. 验收标准

- [x] `pnpm generate:api` 生成的编辑器相关响应均包含强类型 `data`
- [x] 编辑器、媒体、帖子和草稿链路不再手写成功响应 envelope
- [x] lint、typecheck、单元测试和生产构建通过
- [x] 前端生产服务重启并通过公网健康检查

## 10. 子任务

- [x] 重新生成 OpenAPI 类型
- [x] 迁移提及和媒体上传调用
- [x] 迁移帖子与草稿 hooks
- [x] 更新测试与质量检查
- [x] 提交并重启

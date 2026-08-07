# 温油站前端 — 开发文档

## 概述

本目录包含温油站 Web 端的开发文档。每个功能模块有独立设计文档，所有代码变更必须同步更新对应文档。

## 导航

### 模块设计文档

| 文档 | 模块 | 状态 |
|------|------|------|
| [auth](./modules/auth.md) | 认证 | 已完成 |
| [home](./modules/home.md) | 首页 | 已完成 |
| [thread-create](./modules/thread-create.md) | 创建主题帖 | 已完成 |
| [thread-detail](./modules/thread-detail.md) | 主题帖详情与回复 | 已完成 |
| [profile](./modules/profile.md) | 用户资料与账号安全 | 已完成 |
| [notifications](./modules/notifications.md) | 通知 | 已完成 |
| [direct-messages](./modules/direct-messages.md) | 私聊与统一消息中心 | 已完成 |
| [stickers](./modules/stickers.md) | 用户私有表情收藏、管理与发送 | 已完成 |
| [search](./modules/search.md) | 搜索 | 已完成 |
| [drafts](./modules/drafts.md) | 草稿箱 | 已完成 |
| [bookmarks](./modules/bookmarks.md) | 收藏 | 已完成 |
| [mentions](./modules/mentions.md) | 帖内提及 | 已完成 |
| [api-contract](./modules/api-contract.md) | OpenAPI 契约与生成类型 | 已完成 |
| [image-rendering](./modules/image-rendering.md) | 图片渲染与缩略图规则 | 已完成 |
| [markdown-content-protocol](./modules/markdown-content-protocol.md) | Markdown 跨端内容协议 | 已完成 |
| [api-coverage](./api-coverage.md) | 前后端 API 覆盖审计 | 2026-08-07 已复核 |

“已完成”表示当前产品能力已实现，不表示文档中的数字可永久手工维护。链接、模块索引、OpenAPI 操作数量和未调用端点表由 `pnpm docs:check` 按当前源码校验。

### 参考文档

> 后端契约说明位于同级后端仓库 `wenyousite-backend/docs/`。跨仓库文档以路径标注，避免在单仓 CI 中产生失效相对链接。

| 文档 | 内容 |
|------|------|
| `wenyousite-backend/docs/frontend-guide.md` | 认证、分页、业务流程和错误码 |
| `wenyousite-backend/src/common/exceptions/error-codes.ts` | 可机器识别的错误码定义 |
| `wenyousite-backend/docs/data-model.md` | 数据模型 |
| `wenyousite-backend/docs/api-endpoints.md` | API 端点索引 |

## 迭代流程

详见项目根目录 `AGENTS.md` 中的"迭代流程"章节。简而言之：

1. 定范围与风险 → 写清目标、验收标准、跨端和生产风险
2. 契约先行 → API 变更先更新后端 Swagger，再生成前端类型
3. 按完整行为实现 → 测试、代码和必要文档同步完成
4. 质量检查 → `pnpm check`
5. 提交 → 一个 commit 对应一个可验证、可回滚的完整行为
6. 发布 → 仅在明确要求时按发布批次构建、部署、烟雾测试和观察

> 生产部署与普通提交解耦；纯文档变更不构建、不重启服务。完整规则见 `AGENTS.md` 第 11-12 节。

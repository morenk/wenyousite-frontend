# 温油站前端 — 开发文档

## 概述

本目录包含温油站 Web 端的当前开发约束。可观察行为、契约或运行方式变化时更新对应模块；纯重构不制造文档改动。

模块文档只保留当前事实、稳定边界和可回归验证的行为。Phase、发布批次、完成记录、子任务和未来愿望属于 Git/Issue 历史，不进入长期指导文档；兼容旧数据或旧客户端的现行规则除外。

## 导航

### 设计系统

| 文档 | 内容 | 状态 |
|------|------|------|
| [Web 设计基础接入](./design-system.md) | 中央设计基础的版本锁、Web 实现入口与升级规则 | active |
| [Web 前端架构](./architecture.md) | 分层、状态、契约、模块拆分与自动门禁 | active |

### 验收流程

| 文档 | 内容 | 状态 |
|------|------|------|
| [PC Web 与站务台真人验收手册](./manual-acceptance.md) | 按风险由大到小的发布冒烟、深度验收、停止条件与问题分级 | active |
| [真人验收记录模板](./manual-acceptance-record.md) | 每次执行时复制填写的证据、问题和清理清单 | template |

### 模块设计文档

| 文档 | 模块 | 状态 |
|------|------|------|
| [auth](./modules/auth.md) | 认证 | active |
| [home](./modules/home.md) | 首页 | active |
| [moments](./modules/moments.md) | 动态瀑布流、发布、详情与楼中楼评论 | active |
| [thread-create](./modules/thread-create.md) | 创建主题帖 | active |
| [thread-detail](./modules/thread-detail.md) | 主题帖详情与回复 | active |
| [profile](./modules/profile.md) | 用户资料与账号安全 | active |
| [economy](./modules/economy.md) | 用户等级、温油签到、打赏与钱包流水 | active |
| [notifications](./modules/notifications.md) | 通知 | active |
| [direct-messages](./modules/direct-messages.md) | 私聊与统一消息中心 | active |
| [stickers](./modules/stickers.md) | 用户私有表情收藏、管理与发送 | active |
| [search](./modules/search.md) | 搜索 | active |
| [drafts](./modules/drafts.md) | 草稿箱 | active |
| [bookmarks](./modules/bookmarks.md) | 收藏 | active |
| [mentions](./modules/mentions.md) | 帖内提及 | active |
| [api-contract](./modules/api-contract.md) | 固定 OpenAPI 契约、Web 类型与 Flutter 生成兼容 | active |
| [image-rendering](./modules/image-rendering.md) | 图片渲染与缩略图规则 | active |
| [markdown-content-protocol](./modules/markdown-content-protocol.md) | Markdown 跨端内容协议 | active |
| [internal-references](./modules/internal-references.md) | 站内传送门、稳定子贴 URL 与动态受限解析 | active |
| [admin-station](./modules/admin-station.md) | PC 站务台、用户举报与申诉 | active |
| [api-coverage](./api-coverage.md) | 前后端 API 覆盖审计 | 自动校验 |

`active` 表示该文档是当前实现的事实源，不表示功能停止演进。链接、模块索引、OpenAPI 操作数量、未调用端点表和历史规划用语由 `pnpm docs:check` 按当前源码校验。

### 参考文档

> 后端契约说明位于同级后端仓库 `wenyousite-backend/docs/`。跨仓库文档以路径标注，避免在前端仓库内产生失效相对链接。

| 文档 | 内容 |
|------|------|
| `wenyousite-backend/docs/frontend-guide.md` | 认证、分页、业务流程和错误码 |
| `wenyousite-backend/docs/mobile-client-guide.md` | Flutter 的 API、安全存储、幂等、Markdown 与推送契约 |
| [`wenyousite-foundation`](https://github.com/morenk/wenyousite-foundation) | 跨端审美、共享 Token、字体与 Web/Flutter 平台规范 |
| `wenyousite-backend/src/common/exceptions/error-codes.ts` | 可机器识别的错误码定义 |
| `wenyousite-backend/docs/data-model.md` | 数据模型 |
| `wenyousite-backend/docs/api-endpoints.md` | API 端点索引 |
| `contracts/openapi.json` | Web/Flutter 客户端生成使用的固定机器契约 |

## 维护与交付

详见仓库根目录 `AGENTS.md` 的实现约束、质量门禁和公网开发环境交付章节。简而言之：

1. 定范围与风险 → 写清目标、验收标准、跨端和生产风险
2. 契约先行 → API 变更先更新后端 Swagger，再生成前端类型
3. 按完整行为实现 → 测试、代码和必要文档同步完成
4. 质量检查 → `pnpm check`
5. 差异复核 → 只暂存本任务文件，检查 staged diff、敏感信息和提交边界
6. 提交与推送 → 创建一个可验证、可回滚的原子提交并默认推送 `origin/dev`
7. 切换 → 只从干净且与远端一致的提交组装不可变 release，并验证健康、受影响页面和日志

> Git 提交与代码切换是两个独立门禁：完成切片默认提交并推送，代码任务随后从该精确提交切换；纯文档变更只提交推送，不构建、不重启。完整规则见 `AGENTS.md` 第 3–4 节。

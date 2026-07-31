# 温油站前端 — 开发文档

## 概述

本目录包含温油站 Web 端的开发文档。每个功能模块有独立设计文档，所有代码变更必须同步更新对应文档。

## 导航

### 模块设计文档

| 文档 | 模块 | 状态 |
|------|------|------|
| [auth](./modules/auth.md) | 认证 | 已完成 |
| [home](./modules/home.md) | 首页 | 已完成 |
| thread-create | 创建主题帖 | 待设计 |
| thread-detail | 主题帖详情与回复 | 待设计 |
| profile | 用户资料 | 待设计 |
| notifications | 通知 | 待设计 |
| search | 搜索 | 待设计 |
| drafts | 草稿箱 | 待设计 |

### 参考文档

> 后端已有完整的前端对接文档，详见 `../wenyousite-backend/docs/frontend/`。

| 文档 | 内容 |
|------|------|
| [后端前端文档中心](../wenyousite-backend/docs/frontend/README.md) | API 客户端、全局约定、用户旅程 |
| [后端错误码](../wenyousite-backend/docs/frontend/error-handling.md) | 统一错误码与前端提示策略 |
| [后端数据模型](../wenyousite-backend/docs/data-model.md) | 22 张表 + 8 个枚举 |
| [后端 API 端点](../wenyousite-backend/docs/api-endpoints.md) | 全部 48 个端点 |

## 迭代流程

详见项目根目录 `AGENTS.md` 中的"迭代流程"章节。简而言之：

1. 定模块 → 创建/更新 `docs/modules/<module>.md`
2. 拆任务 → 在文档里列子任务和验收标准
3. 写代码 → 页面、组件、API hooks、校验 schema
4. 同步文档 → 变更回写
5. 质量检查 → `pnpm lint && pnpm typecheck && pnpm build`
6. 提交 → 原子提交，代码 + 文档同一次 commit

# 前后端 API 覆盖审计

## 审计结论

- 审计日期：2026-08-05
- 事实来源：本地生产后端 `/api/docs-json`
- 后端总量：81 个路径、108 个操作
- 本轮明确搁置：举报 3 个操作、管理后台 5 个操作
- 用户端审计范围：74 个路径、100 个操作
- 前端直接调用：86 个操作；其余 14 个操作均由聚合响应、等价端点、兼容入口或部署健康检查覆盖，不构成缺失的用户功能

本轮已补齐认证续期、正确退出、公开主题帖详情、用户点赞状态、THREAD/USER 订阅、双端登录终端、黑名单、账号注销、邀请加入、公开加入、退出玩家身份和子贴标签管理。举报和管理后台按产品决定继续搁置。

## 未单独调用的用户端操作

| 操作 | 不单独调用的原因 | 当前覆盖方式 |
|------|------------------|--------------|
| `GET /search` | 旧客户端兼容聚合搜索，新前端按 Tab 惰性加载 | `GET /search/threads`、`GET /search/users`、`GET /search/posts` |
| `GET /health` | 基础设施健康检查，不是浏览器业务功能 | 构建部署后的服务健康检查直接调用 |
| `GET /users/search` | 通用用户搜索会绕过帖内 @ 权限范围 | 编辑器使用 `GET /users/mention-candidates` |
| `GET /users/following` | “我的关注”是指定用户列表的重复入口 | 使用 `GET /users/:id/following` |
| `GET /users/followers` | “我的粉丝”是指定用户列表的重复入口 | 使用 `GET /users/:id/followers` |
| `GET /threads/:id/tags` | 主题帖详情已内嵌 `topicTags` | `GET /threads/:id` |
| `POST /tags` | 主题帖标签关联接口会按名称查找或创建 | `POST /threads/:id/tags` |
| `GET /tags/:id` | UI 只需搜索候选及详情内嵌标签 | `GET /tags` + 主题帖详情 |
| `GET /threads/:id/subthreads` | 主题帖详情已内嵌完整子贴列表 | `GET /threads/:id` |
| `GET /subthreads/:id` | 主题帖详情已提供管理和阅读所需子贴字段 | `GET /threads/:id` |
| `GET /subthreads/:id/tags` | 子贴详情数据已内嵌标签；编辑后直接刷新主题帖详情 | `GET /threads/:id` |
| `GET /reading-progress` | 页面只写入当前进度并查询当前子贴新增回复数 | `POST /reading-progress` + `GET /reading-progress/new-replies` |
| `GET /drafts/:id` | 5 槽位草稿列表已返回编辑器所需完整内容 | `GET /drafts` |
| `PATCH /drafts/:id` | 槽位保存采用带 slot/version 的幂等 upsert | `POST /drafts` |

`POST /auth/refresh` 由 `src/api/client.ts` 的 401 单飞续期流程直接调用；指定用户关注/粉丝列表通过动态路径常量调用。静态字符串扫描可能漏掉这三项，审计时已人工复核。

## 后续边界

举报与管理后台恢复开发时应重新执行本审计，并分别补模块文档、真实 API 快照、hooks、页面权限和测试。在此之前不在用户端暴露入口。

# 前后端 API 覆盖审计

## 审计结论

- 审计日期：2026-08-06
- 事实来源：相邻后端源码离线导出的 OpenAPI（`pnpm openapi:export`）
- 后端总量：84 个路径、111 个操作
- 本轮明确搁置：举报 3 个操作、管理后台 5 个操作
- 用户端审计范围：103 个操作
- 前端直接调用：88 个操作；其余 15 个操作均由聚合响应、等价端点、兼容入口或部署健康检查覆盖，不构成缺失的用户功能

本轮已补齐认证续期、正确退出、公开主题帖详情、用户点赞状态、THREAD/USER 订阅、双端登录终端、黑名单、账号注销、邀请加入、公开加入、退出玩家身份和子贴标签管理。举报和管理后台按产品决定继续搁置。

## 未单独调用的用户端操作

| 操作 | 不单独调用的原因 | 当前覆盖方式 |
|------|------------------|--------------|
| `GET /api/v1/search` | 旧客户端兼容聚合搜索，新前端按 Tab 惰性加载 | 三个分类型搜索端点 |
| `GET /api/v1/health` | 基础设施健康检查，不是浏览器业务功能 | 部署后的服务健康检查直接调用 |
| `GET /api/v1/users/search` | 通用用户搜索会绕过帖内 @ 权限范围 | 编辑器使用 mention-candidates |
| `GET /api/v1/users/following` | “我的关注”是指定用户列表的重复入口 | 指定用户 following 端点 |
| `GET /api/v1/users/followers` | “我的粉丝”是指定用户列表的重复入口 | 指定用户 followers 端点 |
| `POST /api/v1/threads/{threadId}/members/join` | Web 的加入入口要求先预览邀请 token，避免裸 threadId 猜测入口 | join-by-link 预览与加入端点 |
| `GET /api/v1/threads/{threadId}/tags` | 主题帖详情已内嵌 `topicTags` | 主题帖详情 |
| `POST /api/v1/tags` | 主题帖标签关联接口会按名称查找或创建 | 主题帖标签关联端点 |
| `GET /api/v1/tags/{id}` | UI 只需搜索候选及详情内嵌标签 | 标签列表 + 主题帖详情 |
| `GET /api/v1/threads/{threadId}/subthreads` | 主题帖详情已内嵌完整子贴列表 | 主题帖详情 |
| `GET /api/v1/subthreads/{id}` | 主题帖详情已提供管理和阅读所需子贴字段 | 主题帖详情 |
| `GET /api/v1/subthreads/{subthreadId}/tags` | 子贴详情数据已内嵌标签；编辑后刷新主题帖详情 | 主题帖详情 |
| `GET /api/v1/reading-progress` | 页面只写入当前进度并按子贴/主题帖查询新增回复 | 写进度 + 两个新增回复端点 |
| `GET /api/v1/drafts/{id}` | 5 槽位草稿列表已返回编辑器所需完整内容 | 草稿列表 |
| `PATCH /api/v1/drafts/{id}` | 槽位保存采用带 slot/version 的幂等 upsert | 草稿 upsert |

`POST /api/v1/auth/refresh` 由 `src/api/client.ts` 的原生 fetch 包装器调用，以避免拦截器递归。`pnpm docs:check` 会离线导出 OpenAPI、扫描生产源码中的 `apiClient` 调用，并校验本页数字和上表集合；新增端点或调用方式变化不能只改文字绕过。

## 后续边界

举报与管理后台恢复开发时应重新执行本审计，并分别补模块文档、真实 API 快照、hooks、页面权限和测试。在此之前不在用户端暴露入口。

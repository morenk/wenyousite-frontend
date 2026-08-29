# 前后端 API 覆盖审计

## 审计结论

- 事实来源：仓库内固定且与后端已审核产物一致的 `contracts/openapi.json`
- 后端总量：169 个路径、211 个操作
- 用户端范围外：举报 1 个操作、管理后台 50 个操作
- 用户端审计范围：160 个操作
- Web 源码直接引用：185 个操作（用户端 144 个，举报/站务 41 个）
- 未直接引用：用户端 16 个、举报/站务 10 个；这些操作由聚合响应、等价端点、兼容入口、受限凭据流程或原生移动端覆盖，不构成缺失的 Web 功能

上面的“用户端范围外”是审计分组，不代表缺少 Web 界面：举报和管理后台现由独立 PC Web 路由消费，并与社区用户端分开统计。其余覆盖结论由固定契约与前端调用源码实时推导，不以某次审计日期或发布版本为准。

全部 JSON 操作的成功响应引用稳定 operationId 命名的具名 envelope；CSV 等下载响应显式声明媒体类型和字符串 schema。分页响应包含 cursor meta，每个操作都声明统一 `ApiErrorEnvelope` 兜底错误，业务错误码由 OpenAPI 的 `BusinessErrorCode` 生成。

## 未单独调用的用户端操作

| 操作 | 不单独调用的原因 | 当前覆盖方式 |
|------|------------------|--------------|
| `GET /api/v1/search` | 旧客户端兼容聚合搜索，新前端按 Tab 惰性加载 | 三个分类型搜索端点 |
| `GET /api/v1/users/search` | 通用用户搜索会绕过帖内 @ 权限范围 | 编辑器使用 mention-candidates |
| `GET /api/v1/users/following` | “我的关注”是指定用户列表的重复入口 | 指定用户 following 端点 |
| `GET /api/v1/users/followers` | “我的粉丝”是指定用户列表的重复入口 | 指定用户 followers 端点 |
| `GET /api/v1/users/me/collaborated-threads` | PC Web 当前不提供协作主题入口 | 固定契约与生成类型已同步；原生移动端后续接入 |
| `POST /api/v1/threads/{threadId}/members/join` | Web 的加入入口要求先预览邀请 token，避免裸 threadId 猜测入口 | join-by-link 预览与加入端点 |
| `GET /api/v1/threads/{threadId}/tags` | 主题帖详情已内嵌 `topicTags` | 主题帖详情 |
| `POST /api/v1/tags` | 主题帖标签关联接口会按名称查找或创建 | 主题帖标签关联端点 |
| `GET /api/v1/threads/{threadId}/subthreads` | 主题帖详情已内嵌完整子贴列表 | 主题帖详情 |
| `GET /api/v1/subthreads/{id}` | 主题帖详情已提供管理和阅读所需子贴字段 | 主题帖详情 |
| `GET /api/v1/drafts` | 兼容客户端的独立列表会与槽位请求产生快照竞态 | 原子草稿状态 `/drafts/state` |
| `GET /api/v1/drafts/slots` | 兼容客户端的独立槽位摘要可能与列表不属于同一快照 | 原子草稿状态 `/drafts/state` |
| `GET /api/v1/drafts/{id}` | 原子草稿状态已返回编辑器所需完整内容 | 原子草稿状态 `/drafts/state` |
| `POST /api/v1/moderation/appeal-token` | 被处罚账号无法建立普通会话时使用的受限申诉凭据入口 | 后端受限申诉认证闭环；登录态 Web 面板使用决定与申诉端点 |
| `PUT /api/v1/mobile/devices/current` | 仅原生移动登录终端可注册 FCM token | Flutter 登录与 FCM token 刷新流程 |
| `DELETE /api/v1/mobile/devices/current` | 仅原生移动登录终端可注销 FCM token | Flutter 退出登录与通知权限关闭流程 |

`POST /api/v1/auth/refresh` 由 `src/api/client.ts` 的原生 fetch 包装器调用，以避免拦截器递归。`pnpm docs:check` 会读取固定 OpenAPI、扫描生产源码中的 `apiClient` 调用，并校验本页数字和上表集合；新增端点或调用方式变化不能只改文字绕过。

## 范围边界

举报提交、决定/申诉和管理后台由独立 PC Web 路由消费；移动端当前不提供完整站务 UI，但普通 Bearer 举报/决定/申诉以及管理员前台隐藏契约均保持平台无关。新增调用时继续同步模块文档、固定 OpenAPI、hooks、页面权限和测试。

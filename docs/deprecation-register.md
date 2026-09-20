# Web 弃用与兼容登记

收藏夹管理新增能力继续使用独立的主题帖和动态目录端点，既有共享目录兼容协议不在本次清理范围。Web 不新增该协议消费者，也不修改 Foundation 或数据库迁移。

后端兼容协议的事实源及清理条件见[后端弃用登记](https://github.com/morenk/wenyousite-backend/blob/dev/docs/deprecation-register.md)。当前 Web 行为和验收约束见[收藏模块](modules/bookmarks.md)，已提交契约来源及生成方式见[API 契约](modules/api-contract.md)。

## 普通内容时间展示

Web 通过 Foundation v7.1.0 将普通内容的绝对时间展示收敛为日期，悬停和读屏不再包含时分；账务、安全、审计、预约及到期记录保留精确时刻。该变化只调整展示，不弃用或裁剪 API/数据库的原始时间戳，不新增兼容协议，也不清理旧协议。跨端规则与兼容说明见 [Foundation 弃用登记](https://github.com/morenk/wenyousite-foundation/blob/v7.1.0/docs/deprecation-register.md)，Web 映射见[设计系统](design-system.md)。

## 管理会话与记住设备

Web 消费兼容契约 `5.25.0-dev.20260921.1`（提交 `1e8d19c1492b62a2ff191647bf0f10ead1b0fdfd`）：登录验证显式发送 `rememberDevice`，未选择时保留原有闲置 30 分钟、最长 8 小时策略，选择时使用固定 7 天会话。旧验证请求省略该字段仍由服务端按短会话处理；既有 Cookie、CSRF、二次验证、响应字段和公共登录协议全部保留，不新增旧协议清理条件。

Web 将后台会话与公共 Bearer 身份隔离，只在管理接口明确返回 `40117` / `40118` 时清理后台缓存并返回登录页。会话复核、跨标签通知和安全回跳的可观察行为见[后台模块](modules/admin-station.md)。本次不删除兼容端点，不修改 Foundation 版本或 Mobile 功能；后续协议清理继续遵循[后端弃用登记](https://github.com/morenk/wenyousite-backend/blob/dev/docs/deprecation-register.md)。

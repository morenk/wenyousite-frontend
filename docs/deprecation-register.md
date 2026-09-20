# Web 弃用与兼容登记

收藏夹管理新增能力继续使用独立的主题帖和动态目录端点，既有共享目录兼容协议不在本次清理范围。Web 不新增该协议消费者，也不修改 Foundation 或数据库迁移。

后端兼容协议的事实源及清理条件见[后端弃用登记](https://github.com/morenk/wenyousite-backend/blob/dev/docs/deprecation-register.md)。当前 Web 行为和验收约束见[收藏模块](modules/bookmarks.md)，已提交契约来源及生成方式见[API 契约](modules/api-contract.md)。

## 普通内容时间展示

Web 通过 Foundation v7.1.0 将普通内容的绝对时间展示收敛为日期，悬停和读屏不再包含时分；账务、安全、审计、预约及到期记录保留精确时刻。该变化只调整展示，不弃用或裁剪 API/数据库的原始时间戳，不新增兼容协议，也不清理旧协议。跨端规则与兼容说明见 [Foundation 弃用登记](https://github.com/morenk/wenyousite-foundation/blob/v7.1.0/docs/deprecation-register.md)，Web 映射见[设计系统](design-system.md)。

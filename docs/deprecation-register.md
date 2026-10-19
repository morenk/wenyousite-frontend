# Web 弃用与兼容登记

## 公开 APP 下载

每日限次契约固定 Backend `10b7819ad4a15777490dad5ab9abb7ae961422fc`，版本 `5.32.0-dev.20261003.1`。新增签名浏览器 Cookie、默认浏览器 3 次/IP 10 次的北京时间每日累计限制，以及 429 原因头；信息/HEAD 不消费次数，旧 APP 无 Cookie 仍可 HEAD/GET 并受 IP 限制。Web 保留无原因头和空正文的错误恢复，不读取 HttpOnly 标识，不以本地计数代替服务端原子预占。先升级兼容网关及账本再启用消费者；回滚须保留已用次数、字节账本及 Cookie 签名状态，不通过删除账本或恢复旧快照解除限额。

新增外观菜单直接下载和移动设备提示，消费下载信息 GET 与固定构建文件 HEAD/GET；候选中的独立下载页与二维码已取消，未作为已发布兼容路径。旧 APP 的 `/meta.mobileCompatibility.android.updateUrl` 字段结构与强制更新策略保留，Web 不产生更新资格、不删除旧字段、不回退公开桶。发布顺序为兼容网关与发布工具 → 预热 → meta/Web → 旧 APP 验证 → 独立评审关闭 APK 公共读；不得提前关闭旧兼容路径或修改图片桶权限。Web 回滚只撤销下载入口与提示，不变更历史制品、发布策略或流量账本。行为与已提交来源见 [APP 下载](modules/app-download.md) 和 [API 契约](modules/api-contract.md#公开-app-下载)。

收藏夹管理新增能力继续使用独立的主题帖和动态目录端点，既有共享目录兼容协议不在本次清理范围。Web 不新增该协议消费者，也不修改 Foundation 或数据库迁移。

后端兼容协议的事实源及清理条件见[后端弃用登记](https://github.com/morenk/wenyousite-backend/blob/dev/docs/deprecation-register.md)。当前 Web 行为和验收约束见[收藏模块](modules/bookmarks.md)，已提交契约来源及生成方式见[API 契约](modules/api-contract.md)。

## 普通内容时间展示

Web 通过 Foundation v7.1.0 将普通内容的绝对时间展示收敛为日期，悬停和读屏不再包含时分；账务、安全、审计、预约及到期记录保留精确时刻。该变化只调整展示，不弃用或裁剪 API/数据库的原始时间戳，不新增兼容协议，也不清理旧协议。跨端规则与兼容说明见 [Foundation 弃用登记](https://github.com/morenk/wenyousite-foundation/blob/v7.1.0/docs/deprecation-register.md)，Web 映射见[设计系统](design-system.md)。

## 本人关系管理

Backend 提供兼容的移除粉丝端点与可选关系投影，Web 在本人列表启用回关、取消关注、移除粉丝，并复用既有私聊、拉黑和举报入口；保留原关注接口及关系列表深链。字段缺失按未知处理，不新增旧协议消费者或删除兼容。应先发布兼容后端，再发布 Web；客户端回滚仅恢复旧界面，不恢复已经执行的关系写入。契约来源与行为见 [API 契约](modules/api-contract.md#本人关系管理兼容扩展) 和 [用户模块](modules/profile.md#本人关注与粉丝管理)。

## 管理会话与记住设备

Web 消费兼容契约 `5.26.0-dev.20260922.3`（提交 `92b030a81f8957386e324fed477bd1e46faf65ea`）：登录验证显式发送 `rememberDevice`，未选择时保留原有闲置 30 分钟、最长 8 小时策略，选择时使用固定 7 天会话。旧验证请求省略该字段仍由服务端按短会话处理；既有 Cookie、CSRF、二次验证、响应字段和公共登录协议全部保留，不新增旧协议清理条件。

Web 将后台会话与公共 Bearer 身份隔离，只在管理接口明确返回 `40117` / `40118` 时清理后台缓存并返回登录页。会话复核、跨标签通知和安全回跳的可观察行为见[后台模块](modules/admin-station.md)。本次不删除兼容端点，不修改 Foundation 版本或 Mobile 功能；后续协议清理继续遵循[后端弃用登记](https://github.com/morenk/wenyousite-backend/blob/dev/docs/deprecation-register.md)。

## 全屏图片图集契约

新增图集查询和 `IMAGE_GALLERY_NOT_READY` 错误码仅同步到固定 OpenAPI 及生成类型，来源见 [API 契约](modules/api-contract.md#全屏图片图集契约同步)。Web 本轮不启用新查询、不改变查看器或列表行为；管理登录保留省略 `rememberDevice` 时的短会话兼容，当前 Web 显式发送本次选择，行为见上方管理会话说明；既有 API、上传和 Markdown 协议继续兼容。完整同步包含后端基线已合并的关系管理和管理会话兼容新增，不删除任何旧协议。回滚可恢复原 Web 提交，无客户端数据迁移；后端历史索引回填须独立授权。

## 移动端版本说明

兼容新增移动端版本说明管理入口及审计标签，消费 Backend `99b42dc0f7d25eeb6e49ee87441e206c77cce29a` 的 `5.27.0-dev.20260927.1` 契约。保留 `/meta` 全部既有字段和升级策略，不新增推送、iOS 发版或旧版本文案回填；没有旧协议删除。先部署兼容后端再启用 Web，Web 回滚只移除管理入口，不回滚已保存或已公开文案。详细行为与生成来源见[后台模块](modules/admin-station.md#移动端版本说明)和[API 契约](modules/api-contract.md#移动端版本说明)。

## 私密邀请重复分享

新增 `PUT /threads/{id}/invite-link` 作为获取或原子创建入口，日常复制复用当前 token；旧 `POST` 及 operationId 保留主动轮换语义，旧客户端兼容。Web 当前仅保留复制按钮并调用 PUT，不再提供重置按钮、确认与 UI 编排；旧 POST、operationId 与生成方法继续保留，本次不删除旧协议、无客户端数据迁移。发布顺序为兼容 Backend → Web/Mobile，回滚 Web 可恢复旧分享入口，成员权限不受邀请重置影响；旧邀请失效仍统一拒绝，包括已加入成员通过旧邀请访问。

## 讨论单向分页兼容

长讨论 Web 阅读已消费固定窗口契约（Backend `62083784e27f697af3799e392011bf8f6dd825d2`），旧 `/subthreads/:subthreadId/posts` 与 `/posts/:id/replies` hooks 和嵌入式回复入口继续保留。尚无全体消费者迁移与兼容清理证据，本次不删除旧协议；后续清理必须独立 PR 同时给出无消费者、数据迁移、回归和回滚路径证据。

## 帖内身份兼容

兼容 Backend `fc44ed929edb909ebecec81f3159628509fd20e8` 先行，Web/Mobile 随后；OpenAPI `5.34.0-dev.20261005.1` 的展示字段与写入选择均可选。账号 ID、原 author/account 字段、权限、订阅、Markdown 用户链接和旧请求语义保留。Web 通过可选能力字段识别旧后端；关闭功能不删除资料、快照或必要媒体引用，治理移除仍生效。回滚消费者不回滚已保存的发言快照；本批没有满足「无消费者、数据迁移、回归、回滚路径」的旧协议清理事项，不删除历史或兼容端点。来源见 [API 契约](modules/api-contract.md#沉浸式帖内身份)。

多身份集合增量保留单身份接口与兼容主身份锚点；新增集合角色不会在主身份归档后静默替补旧接口。旧请求缺少 `identityId` 仍按兼容锚点解释，新消费端只在恢复无 ID 旧稿时解析同一锚点；ACCOUNT 忽略角色参数。多角色不改变 Markdown v5、账号提及和筛选/订阅权属。归档与历史快照须保留回滚读取能力，本期不清理旧端点。

### 平级角色提及 v6 的保源兼容

兼容 Backend `6d1228cd8c128f24860ef99747aa923c461a595a` / API `5.36.0-dev.20261005.1` 保持全局 Markdown5。新端读取声明6，八个正文写入声明能力；旧端读取降级安全响应副本，旧写不能覆盖原存 v6。新写开关默认关闭，消费者交付不等于激活批准。旧 bare、single 身份端点及内部兼容锚点保留；账号目录与新空草稿不再使用锚点。回滚优先关闭新写，保留原源读取及拒绝有损写入能力。本批不清理任何旧协议或历史数据。


## RP 资料楼层引用（保留兼容）

Backend `6d1228cd8c128f24860ef99747aa923c461a595a` / API5.36 增加可选能力和绑定字段。旧客户端省略字段保留原绑定；旧后端能力缺失时 Web 不显示输入、不提交新字段。身份顶层仅提供授权状态与可读 postId，本人原绑定供编辑；不保存正文快照。本批不移除旧 single、Markdown5 或任何兼容协议；后端先上线、消费端后上线，回滚消费端仍保留服务端绑定。

## 历史起名静态数据

历史姓名以独立 schemaVersion 1 / dataVersion 2026-10-14.1 数据和生成接口兼容新增，普通姓名 v1、11 国词库与全部嵌入路由继续保留。Mobile 仅从已提交 Web SHA 同步历史数据、固定样例与许可证，旧版 App 仍可使用嵌入页。本次无 Backend/OpenAPI、Foundation 视觉契约、数据库或身份权限变化，不新增在线翻译服务、不删除旧协议。回滚 Web 或原生消费者只撤销进阶入口，不修改业务数据；进阶入口默认折叠。格式、来源与确定性消费规则见[历史姓名数据契约](modules/historical-name-data-contract.md)。


## 进阶起名 v2 兼容

新增独立 schemaVersion 2 的史实参考与文学创作数据、生成 API 和确定性样例。普通姓名 v1、历史姓名 v1、11 国普通能力与全部嵌入路由保留；Mobile 已按已提交 SHA 同步本地数据。Web 仅替换本轮尚未发布的进阶候选交互，不删除已发布兼容协议。无需 Backend/OpenAPI、Foundation、业务数据迁移或在线服务；回滚消费端只撤销新入口。格式及边界见[进阶姓名数据契约](modules/advanced-name-data-contract.md)。

## 音频文件兼容

Backend `7f95563edd8f461ebb7a66d7b458ec0349e39297` / API `5.39.0-dev.20261017.1` 兼容新增媒体 purpose、能力与可选投影，Web 消费 Foundation 正式 v7.4.0。普通无 title Markdown 链接为持久格式，旧端、缺失/无效投影、内联/列表/引用仍保持链接；关闭新上传不禁用已存在合法投影阅读。先兼容 Backend，后 Web/Mobile；回滚消费者只撤销上传/播放增强，不改历史数据与媒体 URL。没有旧协议满足清理四项证据，本次不清理兼容。详见[音频模块](modules/audio.md)。

## 文本颜色 v1 保源兼容

颜色为独立受控 Markdown 扩展，全局 Markdown5、角色提及 v6 和 clipboard v2 均继续保留。兼容 Backend 为无能力端返回安全去色副本并拒绝覆盖存有颜色的原文；Web 声明颜色能力，读取、编辑与草稿始终保源；正式 Foundation v7.6.0 增加正文样式菜单取色入口及显式光标输入，服务器支持与新写双门禁通过后开放。旧客户端不能作为新正文的无损编辑回退目标。回滚优先关闭新增颜色，保留支持读取与覆盖保护的兼容后端和消费者；没有历史数据迁移或旧协议清理。能力字段、错误与发布顺序见[API 契约](modules/api-contract.md#文本颜色-v1-能力协商)，格式见[正文协议](modules/markdown-content-protocol.md#文本颜色-v1)。


## 主题互动总数兼容

Backend `da68203a494c6d0f6d377c23399390c2cee397f3` 的详情 GET 新增 `bookmarkCount` / `subscriberCount`；生成 DTO 保持可选以兼容旧服务和创建/更新响应。Web 直接透传真实零/正数，缺失保留未知，不通过本人收藏状态或通知资格推断总量。本次不改变 Web UI、Foundation 或正文协议，不删除接口、字段与兼容路径；先发布兼容 Backend，消费者可独立回滚，现有业务关系不变。来源、语义及检查见 [API 契约](modules/api-contract.md#主题收藏与订阅总数)。

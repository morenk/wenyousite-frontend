# 跨端 API 契约

## 1. 目标与范围

本模块固化 Web 与 Flutter 共用的 REST/OpenAPI 契约。后端 Swagger DTO 是源事实，后端评审并提交的 `contracts/openapi.json` 是客户端生成的固定事实源；Web 不维护影子响应类型，也不在构建期间抓取运行中 Swagger。

当前所有用户端模块均由 `src/api/types.ts` 提供请求和成功响应类型；`pnpm contract:check` 会从仓库内固定契约重新生成到临时目录并逐字节比较，同时拒绝 hooks 中的 `as unknown as` 和手写 `*Response` interface。存在相邻后端仓库时还会校验两份审核产物逐字节一致。

契约更新流程是 `pnpm contract:sync && pnpm generate:api`。前者只复制后端已提交产物，后者只读取本仓库固定产物；因此本地检查、历史 commit 和客户端发布分支都可重复生成同一类型。

## 2. 页面与路由

不新增页面或路由；影响主题帖创建、详情、楼中楼和编辑器草稿面板中的 API 调用。

## 3. 涉及 API

| 模块 | 端点 |
|------|------|
| 提及 | `GET /users/mention-candidates` |
| 元数据 | `GET /meta`（契约/Markdown 版本与能力开关） |
| 动态分类 | `GET /thread-categories`（管理员配置的启用分类；客户端保存稳定 slug） |
| 媒体 | `POST /media/upload-url`、`POST /media/upload-done`、`GET /media/:id`（具名缩略图/中图 URL） |
| 草稿 | `/drafts`、`/drafts/slots`、`/drafts/:id` |
| 帖子 | `/subthreads/:subthreadId/posts`、`/subthreads/:subthreadId/body`、`/posts/:id`、`/posts/:id/replies` |
| 协作 | `GET /users/me/collaborated-threads`（当前仅同步契约与生成类型，不新增 Web 页面） |
| 主题权限 | `DELETE /threads/:id`、`POST /threads/:id/like`、`DELETE /threads/:id/like`（不可见主题显式声明 404） |

成功响应统一为 `{ code, message, data, meta? }`。业务 DTO 位于 `data`，cursor 分页位于 `meta`。

`scripts/check-flutter-contract.mjs` 验证 OpenAPI 3.0、稳定 lowerCamel operationId、具名 2xx 响应、非空查询 schema、移动基线端点、动态分类开放字符串与错误码 schema，作为 `pnpm contract:check` 的本地静态门禁。

契约版本以 `contracts/openapi.json` 的 `info.version` 为准，不在说明文档中复制易过期的版本号。主题帖分类字段是可空字符串而非封闭枚举：草稿可为 `null`，发布必须使用 `GET /thread-categories` 返回的启用 slug。Web 与 Flutter 均消费 `contracts/thread-category-v3-fixtures.json` 黄金用例；既有线程展示直接读取响应 `categoryInfo.name`，不得再用仅含启用项的发现列表反查。分类是纯文本能力，旧 `icon / mergedIntoId` 只作兼容且不应消费；未知 slug 显示原值，空值显示“未分类”，未知响应字段必须忽略。

主题详情子贴现包含必填 `postingCapability`，通知 payload 可包含协作者任免的 `threadId / oldRole / newRole`。Web 当前只通过生成类型接受这些向后兼容字段，不据此改变发言控件、通知渲染或增加协作列表入口。

主题删除、点赞和取消点赞现显式声明不可见主题的 404 响应：不存在、他人草稿和 PRIVATE 非成员对 Web 都表现为资源不存在。同步仅更新固定 OpenAPI 与生成类型；现有详情错误态、缓存失效和界面文案保持不变。

主贴权限管理消费后端提交 `6fdfa00eaf1f3056ba30f2ffbc529d12eed1c823` 的固定 OpenAPI。`PATCH /threads/{id}/aggregate` 可选 `defaultSubthreadPostingPolicy` 使用现有三种子贴发言策略；省略保留原值，和默认子贴标题一起原子更新且只递增一次子贴版本。该客户端必须在兼容后端上线后启用；不改变创建流程。

收藏夹管理消费后端提交 `df4682548e3fc0291fc2cd19c7111b5f0fa53746` 的完整已提交 OpenAPI；相对 Web 基线仅新增两个目录资源路径上的四个 PATCH/DELETE 操作及七个 Schema，既有路径和 Schema 语义不变。PATCH 提交 `{ name }`，DELETE 返回 `{ deletedFolderId, destinationFolderId }`；接口须先随兼容 Backend 部署，Web 再上线。主题帖和动态仍使用各自独立端点，不消费旧共享目录协议。

该后端提交中的媒体展示夹具保留旧 `contractVersion`，因此全量 `contract:sync` 的同版本校验拒绝执行。本次用 `git show <SHA>:contracts/openapi.json` 直接导出已提交原件，再运行 `pnpm generate:api`；不手改生成类型或其他契约。用 `WENYOUSITE_BACKEND_ROOT=/srv/wenyousite/wenyousite-backend BACKEND_CONTRACT_REF=<SHA> pnpm contract:check` 校验与指定提交逐字节一致。OpenAPI 原件的导出顺序造成较大文本差异，不包含额外接口行为变更。

## 4. 状态管理

TanStack Query 缓存键统一由 `src/api/query-keys.ts` 构造。领域 mutation 在对应 API hook 内完成缓存更新/失效，页面与组件不编排服务端缓存。

## 5. 组件清单

- `src/components/editor/milkdown-editor-core.tsx`：通过领域 hook 使用生成的提及候选类型。
- `src/lib/upload-image.ts`：使用生成的媒体上传 DTO。
- `src/api/hooks/`：帖子与草稿 hooks 使用生成响应类型。

## 6. 表单与校验

请求 DTO 继续由 `src/api/types.ts` 生成；收藏夹重命名表单使用 Zod，按服务端规则 trim 后校验 1–24 个 Unicode 字符。

## 7. 错误处理

HTTP/业务错误由 `src/api/errors.ts` 统一归一化；成功响应不得使用 `as unknown as` 伪造 envelope。

## 8. 权限与访问控制

不改变后端 Guard。Web 继续通过 accessToken 调用相应端点；主题权限判断仍完全以后端响应为准。

## 9. 验收标准

- `pnpm generate:api` 生成的编辑器相关响应均包含强类型 `data`
- 所有生产 API hooks 不再手写成功响应 envelope
- 生成类型、query key、UI/API 分层均有静态门禁
- 动态分类黄金用例与后端副本一致，Flutter 契约门禁拒绝分类枚举化
- lint、typecheck、覆盖率测试和生产构建纳入 `pnpm check`

本轮契约同步自后端实现 `c87966dd4644be7d3c2769245d2e0581fffd4154`，策略、基准和移动端 Windows 待办见 [后端交付记录](https://github.com/morenk/wenyousite-backend/blob/c87966dd4644be7d3c2769245d2e0581fffd4154/docs/backend-hardening-20260905.md)。

列表封面通过 ThreadCoverMediaResponseDto 返回 url、可空 animated 和可空 posterUrl，不按后缀推断；旧后端缺字段保守占位。可选 nullable previewVariants 最多两项，每项包含 url、width、height、bytes；列表按实际显示框和 DPR 选档，缺档沿可信原动画路径兼容。黄金用例为 contracts/thread-cover-media-v1-fixtures.json，与 OpenAPI 一起从后端已提交产物同步并生成类型。

跨仓候选验证可设置 BACKEND_CONTRACT_REF=<完整40位Backend提交SHA>，用于 contract:sync、contract:check 和 check；同步与校验都通过 git show 读取同一已提交产物，日志记录精确来源。未设置时保留相邻后端工作区比较。本次来源为后端已合并提交 0ee2c0de1d9c570e495e778be6661b074b7a4bef；同步产物与此前候选契约逐字节一致。使用 pnpm contract:sync、pnpm generate:api、pnpm contract:check 验证固定产物，不切换或修改后端主 checkout。后端先行发布时，尚未更新的公网 Web 继续消费 coverImages，本候选的可见封面同时播放与预览选择须在 Web 发布后生效。

## 完整媒体展示

`display` / `avatarDisplay` 为可选可空的完整WebP描述，`mediaDisplays` 为已授权正文的来源映射；使用同一生成DTO，不维护运行时第二套响应快照。正常同步及严格来源检查包含 `media-display-v1-fixtures.json`。展示资源不改写来源URL、媒体ID、草稿内容或收藏引用；旧响应缺字段仍可兼容，加载新display失败不能隐式退回昂贵GIF。

## 本人关系管理兼容扩展

关系管理兼容扩展来源于 Backend 已提交 `ea1ff7e2c6baeae6bf0316e87812ba37bc823d7a`，随后随下方图集同步整合至 `92b030a81f8957386e324fed477bd1e46faf65ea`：新增 `DELETE /users/me/followers/{id}`（`usersFollowRemoveFollower`），本人关系列表可选 `viewerIsFollowing` / `viewerIsFollowedBy` 表示两个关注方向。已通过精确 SHA 的 `contract:sync` 与 `generate:api` 生成；媒体展示夹具版本同步，不手改生成类型。Web 先等待兼容后端，再启用本人列表管理；旧端点保留，不清理兼容协议。行为见 [用户模块](profile.md#本人关注与粉丝管理)。

关注／粉丝计数说明同步自 Backend 已提交 `e807a3aa0cb15a626e5601eedc93f23c72d2e6c4`：`UserSocialCountResponseDto.following` / `followers` 统计当前查看者可见且未注销的账号，与各自列表口径一致；游客资料可能命中最长五分钟缓存。该次同步仅更新 OpenAPI 版本及两条 description、媒体展示夹具版本和生成类型注释，字段、类型及 Web 运行时代码不变。使用 `WENYOUSITE_BACKEND_ROOT` 指向包含该提交的后端仓库，固定 `BACKEND_CONTRACT_REF` 为上述 SHA，经 `pnpm contract:sync`、`pnpm generate:api` 同步，并以同一来源运行 `pnpm contract:check`。消费者回归覆盖本人和公开资料刷新后采用服务端计数，以及本人列表页签同步更新；Web 不根据列表长度重算计数或为计数补发列表请求。

## 全屏图片图集契约同步

固定契约同步自 Backend 已合并提交 `92b030a81f8957386e324fed477bd1e46faf65ea`。该合并提交与已完成隔离验收的功能提交 `1f6a65e15dd66f88841bc80502f726804a07fa99` 具有相同 Git tree；重新按合并 SHA 同步后，OpenAPI、媒体夹具与生成类型均无差异。来源 SHA 用于构建期契约核验，不是浏览器运行时对服务端 BUILD_SHA 的约束。新增可选认证的 `GET /image-gallery`，按子贴、楼层回复、动态正文、一级评论和评论回复五类范围，从点击锚点进行双向游标分页；来源身份、版本、内容内图片位置和媒体描述由生成 DTO 提供。排序、权限、索引未就绪及游标绑定语义见 [Backend 图集契约](https://github.com/morenk/wenyousite-backend/blob/92b030a81f8957386e324fed477bd1e46faf65ea/docs/image-gallery.md)。

Web 的图集接入范围是固定 OpenAPI、配套媒体展示夹具及生成类型，不新增图集 Hook、网络调用或跨楼层查看 UI。既有线程详情、回复、动态与查看器继续使用原入口；图片出现位置夹具供新的图集消费者使用，Web 尚无该消费者，因此不复制未使用的解析夹具。完整快照同时包含后端基线已合并的关系管理端点 `DELETE /users/me/followers/{id}` 与相关能力说明，以及管理会话 DTO 的兼容更新；这不表示本次新增 Web 关系管理或管理会话界面。

复现同步与验证时将 `WENYOUSITE_BACKEND_ROOT` 指向包含该提交的 Backend 仓库，并设置 `BACKEND_CONTRACT_REF=92b030a81f8957386e324fed477bd1e46faf65ea`，依次运行 `pnpm contract:sync`、`pnpm generate:api`、`pnpm contract:check` 和 `pnpm check`。所有产物来自已提交事实源，不读取后端在办修改，也不手改生成类型。上线仍遵守兼容后端先行及明确批准的合并、部署门禁。

同步的管理登录验证请求含默认 `rememberDevice=false`，生成工具把有默认值的字段生成为必填。既有管理登录 Hook 因此显式发送 `false`，保持后端原来省略该字段时的短会话行为，不增加记住设备控件、不延长登录期限；原升权验证请求仍只发送挑战与验证码。消费者回归检查实际请求和登录后的旧账号导航状态清理。

## 移动端版本说明

固定 OpenAPI、媒体展示夹具版本和生成类型同步自 Backend `99b42dc0f7d25eeb6e49ee87441e206c77cce29a`，契约版本 `5.27.0-dev.20260927.1`。使用 `WENYOUSITE_BACKEND_ROOT` 指向包含该提交的后端仓库，设置 `BACKEND_CONTRACT_REF` 为上述 SHA，经 `pnpm contract:sync`、`pnpm generate:api` 生成；检查使用同一来源。

Web 通过独立管理 Cookie/CSRF 会话消费 `/admin/mobile-releases` 列表、详情、创建、编辑和确认接口，直接使用生成的 `AdminMobileReleaseDto`。列表按构建号倒序、不透明游标分页；平台和构建号不可更改，仅从未确认的版本名允许修正。编辑和确认携带最后核对的 `revision`，409 保留输入并重新核对；40007 返回第一页重新读取。`confirmed`、`published` 和 `hasUnconfirmedChanges` 分别决定确认快照、公开快照和待修订提示，不能仅由 `PUBLISHED` 推断新稿已公开。

摘要上限 200 个 Unicode 字符；内容 1–30 项，每项上限 500 个 Unicode 字符。表单遵循已提交 DTO 校验，不使用 HTML 或 Markdown 渲染。审计新增 `MOBILE_RELEASE_UPDATED` / `MOBILE_RELEASE` 中文标签。公开查询由 Mobile 消费，Web 后台不提供发包或修改 `/meta` 策略入口；行为见[后台模块](admin-station.md#移动端版本说明)。

## 楼层编辑时间

固定契约同步自 Backend 已提交 `dc62a36dcf016f58fadcf53672215bb5fa66e618`（`5.28.0-dev.20260929.1`）。使用 `WENYOUSITE_BACKEND_ROOT` 指向包含该提交的 Backend 仓库，并设置 `BACKEND_CONTRACT_REF` 为该完整 SHA，执行 `pnpm contract:sync`、`pnpm generate:api`，检查使用相同来源。完整快照同时包含已合并的关注/粉丝计数口径说明，不改变 Web 关系界面行为。

`PostResponseDto`、`FloorResponseDto`、`ReplyResponseDto` 与 `PostDetailResponseDto` 新增可选、可空 `editedAt`，覆盖保存结果、主楼层、内嵌回复、回复分页及深链定位。它表示规范化正文实际改变且事务成功的最后服务端时间；历史与未编辑记录为 `null`，旧响应可省略。客户端直接透传生成类型，不从 `updatedAt`、版本号或置顶状态推断编辑。展示范围及缓存刷新见[主题帖详情](thread-detail.md)。兼容 Backend 先行，消费者随后；本次不移除旧字段、不更改 Foundation 格式化 API 或依赖版本。

## 私密邀请重复分享

固定 OpenAPI 与生成类型通过 `pnpm contract:sync`、`pnpm generate:api` 同步自 Backend 已提交 `4db0cdf2c079fc8b66545c67849053cd74945f8a`（`5.29.0-dev.20261001.1`，相较 `cfe9621` 仅指南与说明变化，机器契约不变）；同步、契约和文档检查均指定同一 `WENYOUSITE_BACKEND_ROOT` 与 `BACKEND_CONTRACT_REF`。新增 `PUT /threads/{id}/invite-link`（`threadsEnsureInviteLink`），无请求体，200 返回现有 `InviteLinkResponseDto`。楼主日常复制使用原子获取或创建，当前界面不提供重置，POST 与原 operationId/生成方法仅保留旧客户端兼容。消费响应校验 threadId 与 16 位 URL-safe token，错误响应绝不作为邀请复制；凭据仅在当前身份/路由控件内存驻留，mutation 不重试、不保留离开后的缓存，POST 在认证刷新后也不自动重放。行为和回滚边界见[帖子模块](thread-detail.md)与[弃用登记](../deprecation-register.md#私密邀请重复分享)，兼容后端须先发布。

## 讨论定位窗口

固定契约来自兼容后端提交 `62083784e27f697af3799e392011bf8f6dd825d2`，由正式 `contract:sync` 和 `generate:api` 同步，附带 `contracts/discussion-navigation.v1.json`。新增 `GET /subthreads/:subthreadId/posts/window` 与 `GET /posts/:id/replies/window`，`number / postId / cursor` 互斥，响应 `data` 自带双向游标、`items / pinnedItems / total / maxNumber / target`。空范围 `maxNumber` 为 null，作者筛选为空也可能仍有可跳转上界。`40010` 仅表示作者筛选排除目标；删除及不可见继续使用 404，不降级扫描旧分页。详情见 [主题帖详情](thread-detail.md)。兼容后端先发布，消费者随后发布；旧协议不在本次移除。

## 公开 APP 下载

固定契约来源为 Backend `10b7819ad4a15777490dad5ab9abb7ae961422fc`。新增 `GET /app-downloads/android` 及固定构建 `GET/HEAD /app-downloads/android/{buildNumber}/file`；生成的 `AndroidDownloadInfoDto` 明确返回 `status`、仅 available 非空的 `release` 和 `retryAfterSeconds`。Web 消费信息 GET 和点击时 HEAD，正文 GET 交由浏览器下载；状态与交接边界见 [APP 下载](app-download.md)。

固定 OpenAPI、媒体展示夹具与生成类型通过标准 `pnpm contract:sync`、`pnpm generate:api` 完整同步。检查指定 `WENYOUSITE_BACKEND_ROOT=/srv/wenyousite/wenyousite-backend` 与上述完整 `BACKEND_CONTRACT_REF`，只读取 Git 已提交产物。媒体夹具版本与 OpenAPI 均为 `5.32.0-dev.20261003.1`，不手改生成类型或降低同步校验。

该版本显式声明下载 HEAD，共 238 个 HTTP 操作；现有 GET/POST/PUT/PATCH/DELETE 审计口径仍为 237。下载 429 的 `X-Download-Limit-Reason` 与 `Retry-After` 直接消费生成类型；Cookie 由服务端签发及浏览器同源管理，Web 不自行生成标识或维护额度。每日限制与原生 GET 边界见 [APP 下载](app-download.md#每日次数与-cookie)。

## 沉浸式帖内身份

固定 OpenAPI、全部共享夹具与生成类型由标准同步入口读取 Backend 已合并提交 `eb9ff12c770b14501eb1d9daa19f4d823728eba6`（`5.36.0-dev.20261005.1`；与已验候选 `6d1228cd8c128f24860ef99747aa923c461a595a` 源码树一致）。检查与同步均指定该 `BACKEND_CONTRACT_REF` 和真实 Backend 仓库的 `WENYOUSITE_BACKEND_ROOT`；新增 `contracts/thread-identity.v1.fixtures.json` 随版本逐字节核验。Foundation 维持 v7.2.1 依赖，本批语义规范由治理汇总。

多身份集合与单角色 GET/POST/PUT/DELETE 经 `use-rp-identities.ts` 消费，PUT/DELETE 携带打开表单时的版本。本人单身份 GET/PUT/DELETE、指定账号兼容主身份 GET 与楼主开关 PATCH 保留；开关和共同失效策略仍使用 `use-thread-identity.ts`。作者可选 `rpIdentity` 是局部展示，绝不覆盖通用 User 的账号字段；结构化提及通过 `sourceHref + label` 匹配 `mentionIdentities`。创建楼层及首次 BODY 发 `identityMode=ACCOUNT|RP`，RP 带所选角色的 `identityId` 和 `identityToken`。旧编辑不发送新身份，旧服务省略能力字段时关闭新控件。历史/关闭投影、冲突与幂等行为见 [主题帖详情](thread-detail.md#帖内身份与逐次发表)。

### 平级角色提及的能力协商

全局 Markdown 仍为5；独立 `capabilities.roleMentionsV6Supported` 确认可保源读写，`roleMentionsV6WriteEnabled` 控制新增源。所有 `apiClient` 读取（SSR、认证重放与导出 POST）声明 `X-Markdown-Contract-Version: 6`，代理保留后端 Vary。八个正文写入 DTO 在 supported 时始终携带整数6，包括新主题正文、删除全部旧提及的编辑和云草稿。旧后端不发送未知字段；能力未读取完成时不抢先查询旧候选。

新后端候选始终传 `includeIdentities=true`，即使新写关闭；空列表不得回退兼容主身份，`@全体玩家` 独立。显式 ACCOUNT 和各 RP 使用 `candidateKey`，插入 `mentionHref`/`mentionLabel`，不按账号合并同名角色。旧 bare 历史节点保留。`40014`/`40015` 保留草稿并刷新能力/候选。

固定语料 `contracts/markdown-v6-role-mentions-fixtures.json` 随 OpenAPI 同步校验。源语法、复制与显示边界见[正文协议](markdown-content-protocol.md#平级角色提及-v6-扩展)。

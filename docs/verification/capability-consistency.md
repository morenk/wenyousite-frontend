# Web 与后端能力一致性盘查

## 历史盘查基线与证据边界

- Web 固定基线：`7a074ae138597f1836218bd9c440c7c15ca97d9a`；Backend：`fc88ea09a808af9c54c1f5b971e116b3be4a471b`，运行 /meta 与后端 SHA 一致，契约 `5.24.0-dev.20260920.1`。
- Web 契约 SHA-256：`229b294ae773d85c41c10fdc775834ffde92d84a77f657cf2f269dec5957d5dd`。Foundation 保持已发布 `v7.1.0` / `dcf75d385e39cc0c55d550a6f35921cd9a7aa508`。
- 本次只修改 VPS Web；未修改 API、数据库、Foundation、生成类型，也未部署。运行版本通过 `readlink /var/lib/wenyousite/frontend/current` 检查，不能以本工作树的修复状态代表线上已修复。
- 以下223入口盘查固定于2026-09-21的后端与Web快照；本轮UI修正合入新开发基线后契约已有225入口，未重新审计新增入口，不能视为当前全部入口覆盖。
- [223 个后端入口的 Web 消费索引](./capability-endpoints.json)覆盖 35 个后端模块，其中 196 个有直接静态路径或已核对的特殊认证调用引用；动态构造路径、被聚合接口替代和未实现平台能力不能因缺少直接引用判为缺陷。入口级实际后端验证仍保留“待验证”，下表只陈述已核对的具体规则。
- 后端依据为固定提交的 DTO、Service、OpenAPI 和本次治理盘查产物。Unicode 使用 `class-validator/validator` 的码点规则，不是 UTF-16 长度，也不是用户感知字形数；例如 `👩‍💻é` 为 5 个码点。编辑器选区偏移仍保持 DOM/ProseMirror 的 UTF-16 语义。
- Sentry 指定 Mobile 事件和近 7 天查询由治理/Mobile 任务交付；没有把 Web 单图状态修复解释为该历史事件的已证实根因。

## 已证实偏差与修复候选

| 编号 | 触发、后端依据与旧行为 | 修复与回归 |
| --- | --- | --- |
| W01 | 评论只接收单个 `mediaId`；已选图仍显示“图片”，选择器和异步确认期间缺少同步防重入；取消后较晚完成的压缩/上传可能继续提交并清理新状态 | 依据后续确认交互，入口固定“图片”且不常驻限制文案；已有图再点只提示先移除，保留原图正文、不打开选择器。移除后可选同图；无图选择器打开即锁定，cancel/change释放，每次清空文件输入。请求按 AbortController 归属，旧结果及旧 finally 不影响新请求；进入评论提交后同步禁止移除。新增组件竞态回归及隔离浏览器用例 |
| W02 | 媒体请求403与评论目标403被统一当成动态不可访问，导致错误清空正文/附件 | 仅评论提交返回不可访问时清目标；媒体失败保留附件和文字。失败重试继续复用当前压缩 File、已上传媒体和同一幂等ID；替换附件后重新绑定。组件覆盖403、相同文件元数据不同内容、更换、取消和卸载 |
| W03 | DTO文本限制按码点，Web Zod/native maxlength/editor多处按UTF-16；500个emoji评论、40个emoji动态标题等被提前拒绝；后台理由实际最小1而Web要求4 | 动态发布/编辑/评论、主题标题/正文/子贴、私聊、资料、收藏夹、举报申诉及后台文本对齐码点；管理正文保存入口拦截10001码点并保留草稿。覆盖上下界、ZWJ/组合字符、实际提交；标签/用户名受明确BMP白名单限制，未放宽 |
| W04 | 标签服务 `tags/tag-name.ts` 仅接受1–20字符且限定ASCII字母数字、中文、下划线和#；输入组件曾允许emoji、斜杠和超长标签进入请求 | 标签组件即时提示并拒绝，主题Schema和后台标签创建同步校验。保留既有“去除输入内部空白”交互规范化。组件与Schema回归 |
| W05 | 经济服务 `parseAmount` 使用BigInt，范围2–9223372036854775807；Web只校验整数下限 | 十进制字符串长度/字典序精确比较；最大值发送原字符串，最大值+1及更长整数不请求。三个边界组件用例 |
| W06 | Auth/AdminLogin密码DTO为8–100码点；旧前端UTF-16 min8且无上限。换邮箱旧密码例外为1–100，邮箱/登录账号上限254 | 注册、登录、重置、修改密码、邮箱及站务入口校验对齐；不trim/归一化密码，不给登录旧密码追加新密码的字母数字要求。覆盖5码点但UTF-16长度8、100/101边界、换邮箱例外、首尾空格保留和站务发请求前拦截 |

以上均为修复候选；负责人验收前不关闭 Mobile 原问题或 Sentry。

## 全模块规则覆盖

“已验证一致”只覆盖该行点名规则及本仓测试；不代表已穷举权限组合或全部运行时响应。

| 模块 | 核对的后端规则与消费者证据 | 状态 / 覆盖 |
| --- | --- | --- |
| Auth / Admin Auth | 普通内存Bearer、HttpOnly refresh；站务Cookie/CSRF与两阶段认证隔离；密码/邮箱边界W06 | 已证实偏差已修复；`validations/auth`、`station-login`、`admin-hooks`测试。隔离真实账号登录已通过；注册/改密/改邮完整真实凭证旅程待验证 |
| Users / 资料 / 安全 | 简介1–255，界面不允许清空已填写简介；隐私分区独立提交；头像/背景走裁切与媒体校验，背景3:1与2:1 | 简介计数W03已修复；`profile-edit-form`、`profile-cover-uploader`、`avatar-uploader`、安全/改邮/改密测试覆盖。并发权限变更待验证 |
| Moments | 标题2–40、正文1000、最多9图、cover属于集合；提交UUID、编辑version；评论500、单媒体与表情互斥、replyTo语义；注销作者禁止新增互动但允许撤销既有点赞/收藏 | W01–W03已修复；`moment-composer/comments/detail-view/card`及hooks测试；canInteract撤销规则静态一致 |
| Threads / Subthreads / Posts | 主题/子贴标题100、Markdown线传正文10000、最多5标签；版本冲突保留编辑状态；BODY发布要求非骰子可见正文，FLOOR/回复允许纯骰子 | W03/W04已修复；`thread-create`、`thread-edit-form`、`management-panel`、floor/reply、aggregate hooks测试；未泛化BODY约束 |
| 编辑器 / 草稿 Drafts | 正文草稿5槽消费服务端maxSlots，主题草稿独立10配额；序列化值计数；持久化先flush，不回退旧值；冲突不覆盖 | W03已修复；`use-editor-submission`实际管理保存回归、草稿控制器/面板与draft hooks现有测试；主题配额竞争与跨设备覆盖待验证 |
| Media | 10MB、MIME白名单、普通GIF容器规则，拒绝动画WebP/APNG；预签名→直传→确认→查询；中断保存reservation，内容摘要及账号/用途隔离 | 现有`upload-image`、`image-container`测试验证；本次评论入口补W01/W02。真实存储断网/处理服务异常待验证 |
| Stickers | 单个stickerAssetId；收藏来源与用途不可混用；缩略与动图展示不同 | `use-stickers`、picker/source/display测试；后端额度、来源失效全矩阵待验证 |
| Direct Messages | 单图/表情互斥、文本1000、陌生请求首条后禁止继续、canSend服务端驱动、撤回10分钟、重试保持clientRequestId | 文本W03已修复；composer/conversation panel/actions/hooks测试；真实双方拉黑/注销竞争待验证 |
| Bookmarks / 收藏夹 | 名称1–24、默认夹不能改删、分类私有、分页包含folder维度 | 新建与管理的码点不一致W03已修复；folder form/management/picker/hooks及bookmark page测试 |
| 社交 / Subscriptions | 关注/拉黑幂等切换、请求中disabled，成功失效对应缓存；订阅实体类型来自契约 | follow/block/subscription hooks及组件现有测试；双向拉黑瞬态完整后端矩阵待验证 |
| Notifications | 服务端不透明cursor、未读数及全部已读；目标删除/隐藏不能继续跳转，评论上下文403/404清理失效目标 | notification-item/list/actions、moment-comments上下文现有测试；历史版本通知载荷待验证 |
| Search / Tags / Thread Categories | 搜索至少2码点、limit20、不透明cursor；动态分类slug服务端下发；标签白名单 | 标签W04已修复；use-search/tag-input/thread-category等测试；后端未被UI暴露的通用search不新增页面 |
| Wallet | 金额十进制字符串、最小2最大BigInt、重试幂等与不同金额换ID；流水cursor | W05已修复；wenyou-tip-button/wallet-history/use-economy测试；隔离数据库加油正例、越界拒绝且余额不变已通过；并发余额竞争待验证 |
| Reports / Moderation Appeals / Client Moderation | 举报details1000、OTHER需要说明、申诉10–2000且一次；客户端处置仅有权角色可见 | W03已修复；report-form/moderation-decisions-panel/admin-content-moderation-dialog测试；真实角色/撤销实时矩阵待验证 |
| Admin / Accounts / Appeals / Campaigns / Cases / Content / Dashboard / Moderation / Operations / Reports / Taxonomy | 站务session/CSRF、角色门禁、分类/标签注册约束、内容version与处置理由；公告60/1000、维护60/500、分类50/200、理由500 | 文本与tag边界W03/W04已修复；15个后台字段边界回归及现有后台面板/hooks测试；高权限真实写入不在公网执行，隔离mock浏览器验证与实后端测试分别记录 |
| Meta / Health / Mobile Devices | /meta运行能力与版本、/health；设备推送注册为Mobile职责，Web不伪造设备 | Meta/Health仅只读核对；Mobile Devices为有依据的平台差异 |

### 有依据的平台差异

Web动态/评论的普通图片入口依现有[动态模块文档](../modules/moments.md)只允许静态图片，GIF通过收藏表情展示；正文发布预处理使用Canvas，贸然放开GIF会丢帧。后端普通Media及阅读层支持GIF不等于本次授权扩展编辑器。当前拒绝GIF保留为“有依据的平台差异”，不把GIF转静态后伪称支持动画。

## 验证与待验收

- 新增回归必须在旧实现失败、修复实现通过；最终日志、计数与浏览器结果见本节交付追加记录。
- 隔离候选使用 `FRONTEND_E2E_PORT=3102 pnpm test:e2e:candidate`，不复用已部署3001，不写真实业务数据。
- 真实操作系统文件选择器“取消”无法由Playwright直接点击；自动化验证选择器打开及浏览器cancel事件处理路径，同图重选用真实文件输入。Windows/macOS原生取消仍需负责人手验。
- 手工复验：首次选图→再次点击仅提示→移除→取消→非法文件→同图重选；上传期间移除并换表情；断网恢复；发送失败重试；切页/关闭后旧请求完成；每次只附一个媒体且失败正文保留。
- 所有入口均已建立索引，但未对223个入口逐一执行真实后端角色/并发/故障矩阵；不将契约生成或模块测试通过称为这些场景全部通过。

### 未直接映射的27个入口

以下逐项按源码解释；“未实现”只表示当前没有入口，不自动新增能力。

| Method / Path | 核对结果 |
| --- | --- |
| `GET /api/v1/users/search` | 公开用户搜索实际通过 /search/users；use-search.ts。未使用该同类端点。 |
| `GET /api/v1/users/me/collaborated-threads` | docs/modules/api-contract.md明确仅同步契约，不新增Web页面。 |
| `GET /api/v1/users/following` | use-user-follow-list.ts统一使用指定用户 /users/{id}/following，包含当前用户。 |
| `GET /api/v1/users/followers` | use-user-follow-list.ts统一使用指定用户 /users/{id}/followers。 |
| `PUT /api/v1/mobile/devices/current` | Mobile推送设备注册/解绑，不属于PC Web职责；本仓无对应设备状态。 |
| `DELETE /api/v1/mobile/devices/current` | Mobile推送设备注册/解绑，不属于PC Web职责；本仓无对应设备状态。 |
| `POST /api/v1/threads/{threadId}/members/join` | 未找到直接入口；thread access hooks使用角色申请/邀请专用接口，是否需要普通join页面待产品确认。 |
| `GET /api/v1/threads/{threadId}/tags` | 主题详情已有topicTags；前端use-thread-detail消费聚合信息。 |
| `POST /api/v1/tags` | TagInput添加名称并随主题aggregate提交；独立管理创建走admin/tags，未使用普通POST tags。 |
| `POST /api/v1/stickers/imports/moment-image` | moment画廊没有收藏来源入口；use-stickers仅实现media/post-image/direct-message来源，未实现能力登记。 |
| `POST /api/v1/stickers/imports/moment-comment-image` | moment-comment-row仅展示与灯箱，无评论来源收藏入口；未实现能力登记。 |
| `GET /api/v1/threads/{threadId}/subthreads` | thread detail聚合返回subthreads供管理面板消费，无独立列表请求。 |
| `GET /api/v1/subthreads/{id}` | 管理面板选中主题详情内的subthread，未发独立detail请求。 |
| `GET /api/v1/drafts` | 正文草稿查询统一GET /drafts/state；use-content-drafts.ts。 |
| `GET /api/v1/drafts/slots` | 正文草稿容量统一GET /drafts/state的slots；use-content-drafts.ts。 |
| `GET /api/v1/drafts/{id}` | 正文草稿详情使用/drafts/state中缓存项；修改/删除仍调用本路径相应method。 |
| `GET /api/v1/admin/reports` | 后台使用moderation/cases案件工作台；未找到旧admin/reports列表入口。 |
| `GET /api/v1/admin/reports/{id}` | 后台使用cases详情/报告关联；未找到旧reports详情入口。 |
| `POST /api/v1/admin/reports/{id}/resolve` | 后台通过moderation case resolution处置；未找到旧reports resolve入口。 |
| `POST /api/v1/moderation/appeal-token` | 未找到被封禁账号免登录申诉token入口；普通申诉走/me/moderation-decisions；未实现能力登记。 |
| `GET /api/v1/admin` | 站务入口按dashboard/session定向查询，没有根/admin API消费。 |
| `POST /api/v1/admin/notifications/system` | 通知后台使用campaigns计划发布，未找到旧system发送入口。 |
| `POST /api/v1/admin/notifications/system/preview` | 通知后台使用campaigns接口，未找到旧system预览入口。 |
| `GET /api/v1/admin/notifications/system/history` | 通知后台使用campaigns列表，未找到旧system历史入口。 |
| `PATCH /api/v1/admin/users/{id}/role` | 管理账号使用admin/accounts专用授权流程，未找到该角色变更端点直接调用。 |
| `GET /api/v1/admin/audit-logs/export` | 可见审计列表存在，未找到导出入口；未实现能力登记。 |
| `GET /api/v1/search` | 使用/search/threads、posts、moments、users等分类查询；未使用通用search。 |

后端独立实测：固定安装环境对LoginDto/CreateMomentCommentDto运行plainToInstance+validateSync，500个emoji评论通过/501失败；密码a1+3个emoji（5码点、8UTF-16单位）失败，a1+98个emoji（100码点）通过，a1+99个emoji失败；仅DTO校验，无数据写入。


### 最终门禁与证据

- 最终源码冻结后完整 `pnpm check` 通过：314 个测试文件、3390 个测试；依赖审计 0 漏洞，lint/typecheck、契约、架构、设计、coverage、部署预检、文档和构建全部通过。此前一次检查与新增草稿测试同时执行，出现 2 个失败；该结果作废，修复流程后从头重跑本条完整门禁，不用增量结果拼接。
- 同一构建 `ppHvu_VOHOlzhnh0JuxmT` 执行完整 `pnpm test:e2e:candidate`：33 个文件、173 个发现用例，168 passed / 5 skipped，耗时 8.5 分钟。构建期 routes-manifest 已断言仅代理到隔离 API `127.0.0.1:3003`；前端 `3102`、新 PostgreSQL `55434`、新 Redis `56381`。未调整真实限流或复用旧任务数据。
- 5 个跳过均是既有可选场景：`discussion-target-pages.spec.ts` 的 4 个负责人原地址场景依赖未提供的 `DISCUSSION_REPRO_FILE` 只读快照；`s5/rich-text-real-api.spec.ts` 的 1 个历史 S5 场景需要显式开启且硬绑定历史候选 SHA，不能冒称本候选通过原场景。
- 完整浏览器套件同时包含 API 拦截用例及隔离真实 API 的登录、主题创建/编辑/管理/删除；不将所有 168 项称为真实后端权限矩阵。本次评论附件浏览器回归使用拦截媒体/评论 API，真实压缩文件及文件选择事件；真实 COS 与媒体处理服务断网仍待验收。
- [6 项独立真实 HTTP 边界证据](./capability-http-boundaries.json)全部通过：密码100码点接受、101拒绝；评论500个emoji接受、501拒绝；加油正例成功、超过BigInt上限拒绝且余额/流水不变。只使用全新隔离数据库与合成账号，原始证据位于本任务隔离目录，未记录凭据。
- 旧实现反证：保持新用例不变，将31个生产文件临时还原为基线执行14个相关测试文件，31 failed / 170 passed；生产文件随后完整恢复。最终全量门禁覆盖恢复后的全部源码。该实验用于证明回归可以识别旧行为，不作为最终通过结果。
- 持久日志目录：`/srv/wenyousite/artifacts/capability-audit-20260921/web/`；包含冻结完整检查、完整 E2E、隔离路由断言、旧实现反证及补充真实草稿结果。运行日志不提交仓库；检查后仅更新本报告和证据文档。
- 对应回归：W01/W02 [评论组件](../../src/components/moment/__tests__/moment-comments.test.tsx)与[浏览器附件替换](../../e2e/comment-attachment-replacement.spec.ts)；W03 [管理保存入口](../../src/components/thread/__tests__/management-panel.test.tsx)、[草稿持久化](../../src/api/hooks/__tests__/use-save-draft.test.tsx)、[后台字段](../../src/components/admin/text-boundaries.test.ts)；W04 [标签输入](../../src/components/forms/__tests__/tag-input.test.tsx)；W05 [加油金额](../../src/components/economy/__tests__/wenyou-tip-button.test.tsx)；W06 [认证边界](../../src/lib/validations/__tests__/auth.test.ts)与[站务请求入口](../../src/components/admin/station-login.test.tsx)。

- [补充真实私密富文本草稿证据](./capability-rich-text-real-api.json)：临时复制既有 S5 测试，仅将历史身份约束绑定本次 baseline、冻结 diff SHA-256 与构建 ID，并用 route 记录 PATCH body 后继续真实 API；业务断言保持不变。首轮 response.request().postDataJSON() 为 null 导致取证失败，第二轮改用请求阶段取证后 1/1 通过：PRIVATE、未发布、保存正文等于请求、重开后粗体/标点/emoji/NBSP 原样。临时复本已移出工作树，仅保留在证据目录；这不等于原历史 S5 用例通过。


### 评论交互后续修正

本轮按负责人确认，取消常驻单图文案与“更换图片”入口：已有图片再点原“图片”入口只提示先移除，既不打开选择器也不上传或替换；保留正文、原图、失败重试状态。移除后选图仍重置媒体及幂等标识，原有取消/旧请求保护不变。补充两次点击与程序性迟到change回归，浏览器验证顶部提示与底部附件面板层级、正常及缩短visualViewport下的可见性。

前文2026-09-21的完整检查、真实API与临时隔离记录属于历史证据，不代表新规则下本轮重新执行完整写入E2E。本轮只运行纯前端模拟API浏览器验证，所有API/上传由拦截响应；不复用旧runtime、不连接线上或真实数据源。真实系统软键盘与原生选择器取消仍需人工验收。


- 本轮合入 `origin/dev`：`81aff9a`，普通 merge 提交 `8eb3869`，保留已共享历史。当前契约 `5.26.0-dev.20260922.3`、225操作，OpenAPI SHA-256 `d8818762b144f2b3fdb60f2a1f77c78e7ecbdf68a543f3aafdb171c83a93cf15`。旧223操作JSON只作固定历史索引。
- 最终冻结源码 `pnpm check` 全部通过：320文件 / 3442测试，审计0漏洞；最初测试写法的类型错误已修正后完整重跑。本轮代码检查、构建均不使用真实后端。
- 同一评论实例使用稳定提示ID，连续点击只保留一条；移除/切换表情/收起/卸载时清除。全局横栏继续使用Sonner顶部布局，Web接入层监听visualViewport的scroll/resize，将offsetTop与顶部safe-area计入提示位置；默认桌面24px/窄屏16px不变，卸载移除监听。

- 纯前端模拟API浏览器回归两轮通过：runId `c31d59b0-0c79-44d3-ae1b-448878bb0520` 和补充安全区轮 `c8a3f19f-b1d0-42d3-a16c-6437e672e42e`；同一 `.next-e2e` build `e2e-c31d59b0-0c79-44d3-ae1b-448878bb0520`，构建代理固定不可连接的 `127.0.0.1:9`、无私有env/凭据，所有API与上传均模拟响应，其余非必要请求拒绝。原正式测试保留统一隔离fixture，未改动正式runner身份门禁。
- 浏览器覆盖1280×800、1280×480、visualViewport.offsetTop=160；第二轮通过CDP设置顶部44px/底部34px安全区。断言提示在可视区内且高于底部面板层级、重复点击只有一条提示、chooser与上传请求不新增、附件正文保留；移除后取消/同图重选与发送失败重试继续通过。偏移+安全区截图确认提示top=204px，未被底部评论/附件面板遮住。此为桌面Chromium模拟，不等于真机软键盘验收。
- 两轮各自的候选进程/浏览器均已关闭，监听端口释放，登记的候选运行目录删除；结果与截图保留在 `/srv/wenyousite/artifacts/comment-single-image-20260923/<runId>/`，两轮cleanup均passed。未启动数据库/Redis/API、未使用旧9/21 runtime、未发送真实业务写入。完整 `check:full`/真实写入E2E本轮未执行。


### 合并前整合验证

整合最新dev `01104bd73c3881b15f8ff8798abc0899f393f1ae` 时解决3处冲突：Provider同时保留站务会话/查询隔离和ViewportToaster；站务登录同时保留账号/密码码点边界与rememberDevice；站务文档保留两项行为说明。最终完整 `pnpm check` 通过325文件/3482测试和全部门禁。

补充纯模拟API浏览器共6项通过：评论单图提示/偏移/安全区/重试，以及站务亮暗rememberDevice、安全回跳、跨标签退出、过期隐藏和业务403不退出。runId `3626d26d-01d0-4daf-bb02-a76c8f797c1a`，build `e2e-940219dd-f42d-4af8-ab3a-24f02b3e3cfb`，cleanup passed。临时harness首轮使用默认5秒断言，业务403重试场景超时；按仓库正式配置对齐15秒后同一构建全部通过，未改生产代码或放宽业务断言。两轮失败/成功及清理证据均保留在 `/srv/wenyousite/artifacts/web-capability-merge-20260923/`。未执行真实写入E2E或部署，真机键盘待验收项仍保留；日志、截图与已合并代码足以继续验收，不依赖此临时Worktree。

# 帖内身份 Web 验收记录

## 候选与契约

- 功能提交：`62ffc7fb0e1329baa3949969def4f2d398f11e12`，分支 `codex/20261004-rp-identity-web`；本记录为后续纯文档补充。
- Backend 业务契约固定 `5ab9767ff8ddce917ddb2560ea655bb58a2408a3`，版本 `5.33.0-dev.20261005.1`，Web OpenAPI 与该提交逐字节一致。Foundation 维持 `7.2.1`。
- 隔离运行及私有预览来源标记使用 Backend `bc00ae8a86ba35fe9f1b2aad942db59477496cb9`；该提交业务 OpenAPI 字节未变。
- 文档检查的 242 操作只统计 GET/POST/PUT/PATCH/DELETE；完整 OpenAPI 243 操作另含 `/api/v1/app-downloads/android/{buildNumber}/file` 的 HEAD。此为既有统计口径，无缺失契约。
- 当前只交付 Draft PR，不合并、部署 Web 或清理旧兼容。用户另行授权的兼容 Backend 发布由治理协调。

## 自动检查

`pnpm check` 各阶段分段完成：audit、预览协议 4 项、lint、typecheck、固定契约、架构/设计、完整覆盖率、发布源、文档及 Next 构建/字体。首轮有旧测试 Provider 和契约 fixture 清单遗漏，两项测试问题修正后完整覆盖率复跑为 **356 套、3,900 项全通过**，另 42 项定向回归通过。未修改覆盖率门槛。

Thread 覆盖率：statements 91.58%、branches 86.67%、functions 91.50%、lines 93.83%。文档核对 44 文件、242 操作、211 消费调用。日志保留于 VPS `/tmp/rp-web-check.log` 与 `/tmp/rp-web-gate-final.log`。

最终视觉检查发现作者组件抽取导致头像占位字号缩小，已恢复原字号。修正后 58 项作者/楼层/BODY 回归、22 项楼中楼回归，以及 lint、typecheck、design、Next 构建/字体通过。按本次低影响样式风险补定向检查，未重复整个长正文性能矩阵。日志为 `/tmp/rp-web-avatar-final.log` 和 `/tmp/rp-web-visual-verify.log`。

## 一次性隔离 E2E

下列三轮均通过独立数据库、Redis、上传路径及后端/候选身份核验；与反馈预览资源分开。报告保存在 Worktree 的忽略目录 `.e2e-results`。

| runId | 结果 | 清理证据 |
| --- | --- | --- |
| `e2e_2d0e97f2596be012cc0ef673` | 253 项：238 通过、13 条件跳过、2 张浅深色视觉图失败 | resourcesRemoved=true；外层 cleanupVerified=false（要求整体 passed），额外核验后端登记为空，未发现残留 |
| `e2e_3849422b6e41a35e876a95f0` | 两张基线采集因缺少旧基线按预期失败；实际检查新图 | 资源目录已移除，后端登记为空；不报告该轮通过 |
| `e2e_79189cfcdbc1183ad30ad00a` | 最终修正源码候选，两项视觉 E2E 通过 | resourcesRemoved=true、cleanupVerified=true、residualCleanup=false |

完整首轮仅上述两张截图失败。原 expected/actual/diff 已保留；恢复头像字号后，新旧图差异仅位于 `(335,0)-(502,32)` 的已确认“全部发言者”文案。更新此两张基线后，最终新候选复验通过。

最终 candidateId 为 `5889080c-518e-4f2c-9f2a-53698206fc02`，buildId 为 `e2e-5889080c-518e-4f2c-9f2a-53698206fc02`。对应报告：

- 首轮：`.e2e-results/ef545954-d138-4128-8a58-b75c5e909bf4.json`
- 基线采集：`.e2e-results/8b6dda8c-2a9d-4314-8665-c0a021c2004a.json`
- 最终复验：`.e2e-results/6e565eef-c53c-4cfb-9c40-6cff8e003ff9.json`

## 合成交互与实际画面

反馈批次 `rp-identity-v1`，runId `preview_0f496fe47ba12aa584db24b5`，明确为 `synthetic-thread-identities` 合成样本。专项 Chromium 验证七步通过：历史卡与当前名称、同账号混合身份筛选、RP/ACCOUNT 发表、24 Unicode 码点昵称与 1024px 深色、其他客户端关闭时保留草稿及确认、关闭/重新开启、普通读者资格；越界请求为 0。早期完整专项画面与后续核心画面按各自源码摘要记录，不混称同一候选。

字号恢复后的两个核心图为 1440×1000 浅色，包含常规“主持人”昵称、两种发表选项以及“全部发言者”。截图开始和结束时源码摘要一致：

`eb5255ef5625cb28cef9c1f6dfdc7d39813dda7715640728cf70ee22e58550cc`

| 忽略目录中的图片 | SHA-256 |
| --- | --- |
| `.dev-preview/rp-publication-mode-light.png` | `1497eee62fdfe533f78ce1533dec1dc1371623b64194b3e7d49c125dc1c48cf7` |
| `.dev-preview/rp-historical-card-light.png` | `b231d498dce692e23ed6142da1625baa380db8e40e81427d65656bf1ad0310a2` |

私有报告 `.dev-preview/rp-core-visual-report.json` 记录 passed=true、browserClosed=true。以上摘要为捕获当时的源码集合，不以本次证据文档加入后的摘要替换。治理已实际查看此前的历史卡、长昵称明暗与常规发表选择图片；最终字号恢复图保留为独立产物及上述精确哈希，不冒充已再次人工查看。

用户随后取消隔离交互预览：治理停止 Mobile 与 SSH 桥接，Backend 停止自身会话，Web 经标准 `dev-preview.mjs stop --task rp-identity-web --json` 返回 stopped。数据库、媒体、Worktree、截图与日志保留，未把反馈批次称为一次性 E2E 已清理；不再进行共享预览交互。

## 已知边界

- 本轮为合成样本，尚无真实快照验收。Windows IAB 停留于骨架，不能计为业务通过；隔离 Chromium 登录与匿名页面可实际交互，两者分别报告。
- Web 沿用内存编辑会话及云端正文草稿。页面内重挂载保留选择与冻结请求，强制刷新或关闭不能恢复完整 pending；已有离开保护，不新增浏览器永久正文存储。
- Foundation 只读复核已确认首次 BODY 冻结、身份卡 fresh disabled/403 遮蔽和身份查询缓存清理三组问题闭环。旧正文编辑不改变历史作者，ACCOUNT 发表不因 RP 开关变化被迫切换。

## 后续 UI 复用候选（待视觉确认）

沿用本 PR 的局部改善：身份摘要只在 RP 模块复用，编辑栏将「本次发表」与长期资料设置分开；普通读者不显示无意义 RP 选项，旧 RP 草稿失效保留提示。表单区分「保存昵称」与头像面板单独保存；历史卡同时展示当前昵称和头像，清除后标明当前使用站内资料。提交守卫、API、权限与原 Markdown 均不变。

本轮局部验证为 6 套 40 项测试，typecheck、改动文件 eslint、design 与差异格式检查通过；尚未运行新的全量门禁、构建或业务 E2E，未提交该视觉批次。实际组件由私有本地 fixture 渲染，Next 导航适配使用惰性桩，不连接业务后端。独立 Vite 与 Chromium 捕获结束后关闭，共享隔离预览保持 stopped。

画面均为 1024×1000；浅色为正常字号，深色为根字号 24px（150%）及 24 个码点长昵称。检查无页面错误、无横向溢出或越界请求。组件样例并非完整页面/业务验收，仍待负责人视觉确认。捕获时源码摘要（早于本证据段落加入）为 `2e66955ab2f1e8c03548039bf67f41701600352a4c67a6da09464ad0377d3d6e`。报告及截图在 `.dev-preview/ui-candidate`：

| 图片 | SHA-256 |
| --- | --- |
| `rp-choice-light-1024.png` | `5a70ffc7c86cb4b4482b1c644f23924ed4807538fb64567175ecfc2d74141330` |
| `rp-editor-light-1024.png` | `984173f8da485ce449f733b7447d3234c862cf6c0034e3c20ad54e58053ee498` |
| `rp-card-light-1024.png` | `e644241bf3b3ded026940d9b23945d29eb2a1d879ac61d90b9d0aa9f4a8b2167` |
| `rp-choice-dark-large-1024.png` | `6162e1c9c0c7d27af79b909a38b114aa10cd6aca3038ec61b66c6bf40e6cbeef` |
| `rp-editor-dark-large-1024.png` | `3caf15c20e3fa4fe4822d09088a705fa129027ba14ee8c43a4494eca3bbd81fe` |
| `rp-card-dark-large-1024.png` | `d5b77b0d1e0a7d252b5d55286be88048a50ee4cda6265e5b0dc313cfd0ab81fe` |

### 后续反馈：精简设置与移除重复入口

主题顶部更多菜单已删除帖内身份入口，保留编辑器入口；主题管理的 RP 项复用个人设置的 SettingsGroup 与 StackListRow，仅显示「帖内身份」及开关状态。身份表单移除常驻说明段落，保留错误、未保存、身份冲突与清除确认。桌面管理工作台的内容/发布分栏不扩大重做。

本轮 8 套 107 项组件、表单与身份守卫测试通过；typecheck、改动文件 eslint、design、差异检查及预览专项脚本语法检查通过。专项脚本入口与文案选择器已同步，但未执行脚本或业务写入；不恢复共享隔离预览，不运行全量门禁，不提交/推送视觉候选。

更新的 9 张组件截图保留为 `*-v2.png`，报告 `.dev-preview/ui-candidate/report-v2.json`。明暗视口均 1024×1000，深色表单含 24 码点昵称及 150% 根字号；无页面错误、横向溢出或越界请求，fixture 服务及浏览器已关闭。捕获时源码摘要（早于本段记录）为 `78aa309b1344083d35e54e4b47cf3d2f767acfb9b1f0abf24fa76c3e20568157`。

| 主要反馈图 | SHA-256 |
| --- | --- |
| `rp-editor-light-1024-v2.png` | `dab8db3ad0b03044b0c0da20b10df7fa351a02d17aef20c76aed6fd358978643` |
| `rp-editor-dark-large-1024-v2.png` | `c892ca88ac4ebdd946d764ff34f4e01bc01750c2badef82176f2295a1a8cd406` |
| `rp-settings-light-1024-v2.png` | `e8e70576eac8f7164b307990bd2bd9a074d214d7b82d7c234c2fc28dacfa878e` |
| `rp-more-light-1024-v2.png` | `06bd6f28b5c5615ae18a29c9768a444be8674485c59e35f735ce3f95ca27552d` |
| `rp-settings-dark-large-1024-v2.png` | `ad4804f52d99cf743b1bc9b17966dcd914de04a98cb923cb871096b41978dd21` |

### 后续反馈：头像右下角编辑入口

移除独立头像文本按钮和头像摘要的内嵌背景卡，复用 UserAvatar 与 Button，将整枚头像设为修改入口，右下角使用笔形图标。RP 身份摘要只增加头像插槽，不建立全局编辑框架。入口具有「修改帖内头像」读屏名称、键盘操作与禁用状态，上传、裁切及保存回调均未改变。

本轮 5 套 30 项相关组件测试，以及 typecheck、改动文件 eslint、design 通过；fixture 检查头像点击区域至少 48×48 CSS px。明暗两图分别为正常字号及 150% 根字号/24 码点昵称，均无溢出或页面错误，无业务网络请求，服务及浏览器已关闭。Web 标题现有结构是单一表单标签，未扩大桌面工作台改造。仍为未提交视觉候选。

捕获源码摘要（早于本段记录）：`432f6d90cc7d9bd7dadd888d98970cb5b11bc3119b41b2954485cd09141cb47b`；报告 `.dev-preview/ui-candidate/report-v3.json`。

| 图片 | SHA-256 |
| --- | --- |
| `rp-editor-light-1024-v3.png` | `d566f9f918b7e7117508f279cf60dd43b8a0f3a046eb3f15ff29c3f9b6a5e927` |
| `rp-editor-dark-large-1024-v3.png` | `0508d65b709be121336e270bb95324b11cb88ba66f75031ee427cb4231bb957d` |

### 后续反馈：自己的资料不重复强调站内账号

自己的 RP 编辑摘要不再传入站内账号辅助行，仍复用现有头像入口；昵称留空回退不变。未修改发表模式选择器、他人的身份卡或选人候选中的账号辨识。

本轮仅复验编辑器与资料入口两套 10 项组件测试，全通过；改动文件 eslint 与差异检查通过。未重复完整流程、构建或业务验收。`v4` 浅色与深色 150% 根字号/24 码点昵称的真实组件截图已检查，均为 1024×1000、无横向溢出及页面错误；头像点击区仍至少 48×48 CSS px。fixture 浏览器及服务已关闭，无业务网络请求，候选未提交推送。

捕获源码摘要（早于本段记录）：`60bd8f1b313b93270abd33d023d92b0447679a8d99ac7d409e548e975172bfee`；报告 `.dev-preview/ui-candidate/report-v4.json`。

| 图片 | SHA-256 |
| --- | --- |
| `rp-editor-light-1024-v4.png` | `5cbdc16f364210aefc93e03046ef9d877afb88bf7cadf14b88f987ed66b2feb0` |
| `rp-editor-dark-large-1024-v4.png` | `3d4c3db72cee77afcb71e778d34d9d86e1494b977968b827a14544f704e24974` |

### 后续反馈：身份入口替代普通标题，编辑动作留在选项内

编辑器左上角以身份入口替代普通「发表回复」标题，回复对象、编辑正文等必要上下文保留。复用现有 Base UI Menu 原语：选择行与笔形按钮为同一视觉行中的独立可访问操作，避免把按钮嵌入选择项。已配置 RP 不再新增编辑行；有资格未配置时显示加号设置占位，普通读者没有无意义设置。点笔只打开资料，不改变本次身份。

本轮 5 套 42 项测试通过，覆盖菜单键盘操作、同名区分、点笔不切换、旧草稿与未知结果守卫；typecheck、定向 eslint、design、差异及专项脚本语法检查通过。v5 组件实图及报告保留在忽略目录，捕获源码摘要为 `2af35c68064d46996e95df2ed06c7304da508ab00558df4ff494a76ad62641e0`。fixture 实际验证 ACCOUNT 选择打开编辑后仍保持 ACCOUNT，服务与浏览器已关闭。

### 后续反馈：移除常驻变化说明，缺少 RP 时使用账号头像

顶部仅在当前选择 RP 且存在可用 RP 时展示当前帖内头像与名称；没有可用 RP 时只显示账号头像与用户名，不显示类型副标题或变化说明。失效的 RP 不再作为禁用候选；原草稿 mode/token 保留，身份变化仍由发表前的确认处理。没有修改提交 hook、未知结果冻结或历史正文身份。

本轮 4 套 27 项测试通过，覆盖账号头像回退、无常驻说明、当前资料展示、编辑入口与提交确认守卫；typecheck、定向 eslint、design 及差异检查通过。未重复全量门禁、构建或业务 E2E。v6 实际组件样例仍无后端连接，7 张图片均为 1024×1000；深色覆盖 150% 根字号与长昵称。已逐张查看，无横向溢出、页面异常或越界请求；fixture 的服务和浏览器均已关闭。普通账号头像在样例中使用本地 data URI，验证使用真实传入头像而非字母占位，不冒充线上账号画面。

捕获源码摘要（早于本段证据写入）：`7319a2966287d20ef56df279422b8609e2126a309e961cfe9408c22c7fde78d8`；报告 `.dev-preview/ui-candidate/report-v6.json`。实图为未提交视觉候选，待负责人确认；未恢复共享预览或进行公网写入。

| 图片 | SHA-256 |
| --- | --- |
| `rp-menu-light-1024-v6.png` | `1142e92d3ee32351c63e86d104f101fe5f796770d3b7b952972433806408b622` |
| `rp-editor-light-1024-v6.png` | `aa16541a9e997b860499e46c164b6fbef36f2735f4c9c7eddbe0c915fef29919` |
| `rp-menu-unconfigured-light-1024-v6.png` | `cb878efe219e0d3d156d54ab7ccddfc57f0d6493be34bad9fa1d43f6d18c1011` |
| `rp-menu-dark-large-1024-v6.png` | `f02e74a48401dab4209865521681293e85a53e36e35e42544a7c560e7226fdd0` |
| `rp-editor-dark-large-1024-v6.png` | `7e096e604ffc110bb54be2ae8832fa21c091a8241b46aae8d053c473c4d0eaa8` |
| `rp-stale-account-light-1024-v6.png` | `cffebe0f6d4f6ced868a9c443b10a908abf713f5202f29c264ba9ceaaa75c770` |
| `rp-stale-account-dark-large-1024-v6.png` | `942c8fe0279090bcab3edeec63702b34bc65f0ec7d4e7af0983d3def617142d6` |

### 后续反馈：作者卡只保留身份与账号主页入口

卡片移除「提及」「只看此人」动作与独立「查看站内主页」按钮，删除仅用于这些动作的 props、编辑会话和筛选回调。主区展示该条发言身份；站内头像、用户名和右箭头组成可键盘访问的账号链接，按稳定作者 ID 跳转。账号发言去重为单行，不套用当前 RP。当前 RP 的昵称或头像发生变化时才追加紧凑「现为」行；清除当前资料不堆叠账号回退卡。其他编辑器提及和列表作者筛选保持原有入口。

系统标记复用 Badge 与 LevelBadge。楼主由已加载主题的 ownerId 准确识别；Author 与身份接口未返回协作者角色，本轮不额外加载全员列表、不猜测标记。关闭态遮蔽、403/404 清理与网络错误重试均保留。

本轮 7 套共 87 项相关回归通过；首次 typecheck 发现原楼层入口遗留已删除 props，修正后 typecheck 通过。定向 eslint、design、脚本语法与差异检查通过。专项业务脚本仅同步了账号行和列表筛选入口，未执行或访问后端；未运行完整构建、全量门禁或业务 E2E。

5 张真实组件截图已逐张查看，1024×1000（PC 最窄受支持视口）、浅色与深色 150% 字号，含 24 码点长昵称、纯账号去重、纯头像变化。未见横向溢出，脚本验证唯一账号链接、账号单行及头像变化可见；无页面异常或越界请求。fixture 服务与浏览器已关闭。仍为未提交视觉候选，不等同完整页面或真实账号验收。

捕获源码摘要（证据追加前）：`6ae2387630698fdfb179d9c9a6727609616a58c10dde2eace6afe475a48ab3a8`；报告 `.dev-preview/ui-candidate/report-v7.json`。

| 图片 | SHA-256 |
| --- | --- |
| `rp-card-light-1024-v7.png` | `6fcc0285ece3e80a3ddd7219c78ff8b8ffcfe56ced6b03f316a2719e8edf57c5` |
| `rp-card-dark-large-1024-v7.png` | `098101e9619d333bb52b79aa048db798b7c73aa15d50f8e49544b756ac6666b3` |
| `rp-card-account-light-1024-v7.png` | `5a7294135e3d2961e35cb11bd46f3c62f0ebe18bdaad4cfb87151e0eb21ff13f` |
| `rp-card-account-dark-large-1024-v7.png` | `9fee1ddc2aaf40c057b3f0ecde94eef894cc94037016b9622df4de654fa6a935` |
| `rp-card-avatar-only-light-1024-v7.png` | `3f3a68bcda948be3c337a169f271164b71e368439c85a74144140400552906d3` |

### 后续反馈：站内身份发言直接进入账号主页

共用作者入口只按该条发言的 RP 快照及当前开关判断导航。站内身份发言、旧响应没有 RP 快照或功能关闭时，头像与用户名直接链接真实账号主页；不查询作者的当前 RP 来决定旧楼层入口。已有 RP 卡读取到关闭后立即卸载并回账号链接；403/404 仍清除缓存并隐藏不可访问内容。楼层、楼中楼、原楼层讨论与正文均消费该共用组件。

本轮 6 套 90 项定向回归、typecheck、定向 eslint 和差异检查通过。组件 fixture 实际点击站内头像并验证同源样例路径跳转到 /users/fixture-user、未弹卡；RP 发言仍打开精简卡。4 张 1024×1000 明暗图片（深色 150% 字号与 24 码点长昵称）已逐张查看，无横向溢出、页面异常或越界请求。使用纯本地组件和模拟身份读取，不连接后端；浏览器与服务均已关闭。

捕获源码摘要（证据追加前）：`65d60cad959b46e155f5ae05a8c36a7572af0e88d8931157b2a683095cd71da6`；报告 `.dev-preview/ui-candidate/report-v8.json`。保持未提交视觉候选，未构建、推送、部署或恢复共享预览。多身份范围另已确认为每账号每主题最多 10 个，当前只准备消费影响与纯展示，等待已提交的新契约接线，不把本轮称为多角色业务实现。

| 图片 | SHA-256 |
| --- | --- |
| `rp-author-navigation-light-1024-v8.png` | `4a2c068ddceb89e80cf42e8d97884da82183bab7407919fe0a089eb7bc39a34e` |
| `rp-author-card-light-1024-v8.png` | `1eebea7d38708898cf6d282dba944478b80e821cc6d68c26444511689b57194a` |
| `rp-author-navigation-dark-large-1024-v8.png` | `fc92d41e8c24a43a5e6602df846208bc396b1217996ea7d42e8c868f4a236ed2` |
| `rp-author-card-dark-large-1024-v8.png` | `c91b0611dfef79b0a96f3842c6cdedc1823d4252e705f56a72a4fc08befcfcfa` |

### 多身份菜单展示准备（尚未接入新业务契约）

按已确定的「每账号每主题最多 10 个」准备纯展示模型：选择值使用角色稳定 ID，站内身份独立一行，每个 RP 的笔形按钮编辑该行，少于 10 个才显示加号入口。菜单不增加角色管理页、独立编辑行或满额说明；同名角色不按名称作为选择键。当前业务适配器仍只向该组件传入旧已提交接口的唯一身份，不发送新接口或多角色字段；不得把组件样例称为多角色功能已完成。提及、Markdown 与查询协议未变。

3 套 23 项菜单、适配器与提交守卫测试通过，覆盖同名角色按 ID 选择、编辑不改变发表选择、0/9/10 个边界及失效草稿展示。typecheck、定向 eslint、design、脚本语法及差异检查通过。首次 fixture 在 portal 尚未挂载时过早统计菜单项，已保留失败报告 report-v9-initial.json；补充等待实际菜单项出现后复验通过，产品源码未因此变更。

4 张 1024×1000 明暗实图已查看，深色含 150% 字号与长昵称，覆盖 3 个和满 10 个角色。满额长菜单在视口内滚动，深色满额图为滚到最后一项的状态。实际点击夜渡行的笔打开对应资料且保留 ACCOUNT 选择。无页面异常、横向溢出或越界请求，fixture 浏览器及服务已关闭。

捕获源码摘要（证据追加前）：`d6e7ad4ca1a1115076dd096d109f623e83226044edc5f9216733a41ec53ca9e3`；报告 `.dev-preview/ui-candidate/report-v9.json`。保持未提交候选，等待 Backend 新契约提交后接入角色集合、发表 ID 和同角色历史对照。

| 图片 | SHA-256 |
| --- | --- |
| `rp-multiple-menu-light-1024-v9.png` | `07b2774beaa5efb392415190626945ac1ddc000ab218607f1b61976e1f6b7801` |
| `rp-multiple-menu-dark-large-1024-v9.png` | `e37a6f5819c0c2c437d1f7b9f60af2316d31bd3655cb6fc1ac63ddb7fa852adf` |
| `rp-multiple-full-light-1024-v9.png` | `bc07f2397b2f4f930de1699a05cc4d00c69807f5bc61f608748d388545ed0e1d` |
| `rp-multiple-full-dark-large-1024-v9.png` | `3e0d86b7c0873cbae18ea7b0146dc7a356147e68995e94dafac16b9130261cb3` |


## 多身份消费与同批 UI 收敛（2026-10-05）

- 本轮固定 OpenAPI/共享夹具来源 `fc44ed929edb909ebecec81f3159628509fd20e8`，API `5.34.0-dev.20261005.1` / Markdown5。Backend 最终交付 `3c82ed15532c99a42b7b88c003d2be5fdf4b587a` 的契约字节相同；Foundation 仍为已锁定 v7.2.1，未发布新包。
- 每账号每主题最多10个未归档身份，空角色保留可配置/删除行并占名额。新空稿采用服务端默认；恢复稿固定所选ID，无ID旧RP稿只解析兼容主身份。新建成功显式选中新ID；编辑其他角色及ACCOUNT稿不切换选择。
- 发表及首次BODY冻结mode/identityId/token/原文和原请求版本（楼层另有UUID）。角色归档/资格撤销/关闭时，确认后才回账号；历史卡按快照同一ID查询。提及、筛选与订阅仍按账号。
- 新角色POST无幂等保证：结果不明保留输入和上传引用，必须成功读取集合供核对，再明确确认才能再次新建。已确认成功的返回角色先进入本地集合并交回调用者，后台刷新失败不会伪装成创建失败。
- UI 沿用本反馈批次的同一菜单、行内笔和加号占位；账号发言直接主页，RP发言使用精简历史卡。自己的表单不重复账号或模式辅助行。满10个菜单滚动时站内账号行固定顶部，不增加独立操作项。

### v11 组件画面

仅运行断网限制的本地组件fixture，没有恢复共享交互预览，也没有公网写入。实际导入发表身份、资料表单及提交选择组件，hook替身只在fixture内存读写。1024×1000，浅色及深色150%字号，含长名、空角色和满10个名额。

截图时完整源码摘要：`52d754a0c3e40fca5d76ec63f0b3f87b8c02b997e64fd039c4876aa94ae87ca0`；基线提交为 `e5e578a0a6bfc72e48f0bbadb890a2ca2cbe2eee` 加本轮未提交候选。之后补充API覆盖数字、交付记录和隔离测试，不改变上述组件源码；不把新的全树摘要伪装为原截图源码。8张画面无水平溢出、无浏览器错误、无外部请求；浏览器与fixture服务均已关闭。初次展开、滚至角色10、再次点固定账号行的可达性已实际验证。治理任务实际查看满10个首屏/末项和编辑表单，并确认本视觉反馈批次收敛；这不代表真实账号数据或公网验收。

| 截图 | SHA-256 |
|---|---|
| `rp-multiple-menu-light-1024-v11.png` | `2d08d3bddf00b81fbc7ebdb66c631055b2ec77b0b57a37dfe64c666abd042e3f` |
| `rp-multiple-editor-light-1024-v11.png` | `31a9331157c6325fb3841ad508b817a7bbc215c9f68d5f272e58746672d857fb` |
| `rp-multiple-menu-dark-large-1024-v11.png` | `395be9d95d78e91a332334e877a59ed2a5e691931887a69745fea6be4dfec4b4` |
| `rp-multiple-editor-dark-large-1024-v11.png` | `117ac02a11033f1c69305df60d07d6e6bacb60785d1379725ca61772fb6ef51b` |
| `rp-multiple-full-initial-light-1024-v11.png` | `d164ce8df1894748ddf18aeacd03236c7cf61670c42af6200ad0c70024fd7566` |
| `rp-multiple-full-last-light-1024-v11.png` | `ba760f8da51c561f9ffc7de1296656bc8c6f90f47be23ea04aaa34fea8167f5b` |
| `rp-multiple-full-initial-dark-large-1024-v11.png` | `f2c7c322eebd4f640c02b2b064583b3a315df566379eb4b175d64295655bfa66` |
| `rp-multiple-full-last-dark-large-1024-v11.png` | `074471d8f2eb184f1d76d4915c6459d6eacd4c86c6dda289292547f102165c88` |

### 检查过程保留

首轮定向12文件162项：158通过，4项为新测试的失效键及头像回调签名断言失配；修正后对应3文件38项通过。新增成功创建后刷新失败、清空/归档名额处理、固定菜单及表单回归为5文件42项通过。上述集合存在重叠，不叠加为独立通过总数，最终全量以实际唯一测试集合报告。

完整门禁首轮发现文档覆盖审计计数仍为旧版，真实门禁正确拒绝。修正为194路径、247个GET/POST/PUT/PATCH/DELETE操作（包含HEAD的完整spec为248）、216个Web直接调用后，真实文档检查通过。首轮358文件3947项中3946通过，只有上述文档门禁失败。保留初次失败记录；本应只复验文档，但 Vitest 默认在失败时未输出覆盖率且清理原始数据，因此需要以2个worker及 reportOnFailure 重新完成覆盖率集合，补齐阈值证据，不重跑已通过的静态链。


### 最终门禁与隔离结果

覆盖率恢复轮为 **358个测试文件、3947项全部通过**，不与前述重叠定向用例累加。全仓 statements 87.05%、branches 79.87%、functions 84.97%、lines 90.67%，原阈值通过。安全审计、预览协议4项、lint、typecheck、固定契约/生成一致性、架构/设计/字体静态门禁均在首轮通过；随后部署源预检、文档45文件/247操作/216调用、Next生产构建及3187文件字体扫描通过。仅修正文档统计后补跑覆盖率与余下检查，合起来完成 `pnpm check` 全链，不声称首条整链命令直接成功。

最终独立隔离 E2E 使用 Backend `3c82ed15532c99a42b7b88c003d2be5fdf4b587a` 的已提交入口，新建 PostgreSQL/Redis/上传目录与隔离账号，登录前核验后端资源及候选实际代理。结果 **254项：241通过、13跳过、0失败**。13项为未启用专项长讨论夹具及负责人原地址夹具的既有条件用例；本轮没有把这些算作通过。

- runId：`e2e_7692b8863961424eef7a9613`
- candidateId：`2d9204e5-022e-4b97-bb7d-690547a52446`
- buildId：`e2e-2d9204e5-022e-4b97-bb7d-690547a52446`
- 完整源码摘要（路径和内容的SHA-256，验收前后一致）：`4cca09e8f9b4dbf75731734ebe59f679760afdabd7baf93b7220d9d982a883a6`。之后仅追加本验收记录；截图摘要另见v11段。
- `resourcesCleaned=true`、`resourcesRemoved=true`、`cleanupVerified=true`、`residualCleanup=false`；资源目录已移除，两个现有E2E登记目录均为0项。本轮浏览器/服务/证据监听已退出。
- 私有脱敏报告：`.e2e-results/86ef7fee-6341-4b84-828e-13c9895ca377.json`。不把隔离构建用于部署，不提交账号、环境文件或私有报告。

新增真实旅程逐步验证创建A/B、B创建成功而集合返回503时仍保留并发表B、ACCOUNT草稿编辑B不改变选择、B旧发言只与同一ID当前资料对照、归档B后正文保留且经确认才以ACCOUNT发表。既有长正文性能矩阵及浅深色视觉基线亦通过；没有为了通过而更新本轮基线。

### 交付边界

API5.34需要先交付兼容Backend PR44，再合并/发布消费者。旧单身份协议、账号级提及和Foundation7.2.1依赖均保留；本Web候选仅提交推送和更新Draft PR54，没有合并或部署，没有恢复已取消的共享预览或执行公网业务写入。

v11为本地组件fixture画面，已经治理实际看图确认该反馈批次；本次真实交互证据来自一次性隔离合成数据，不代表真实账号快照验收。Web继续沿用会话内编辑状态和云正文草稿：页面内重挂载保留身份与冻结请求，强制刷新或关闭无法恢复完整pending请求，离开保护仍生效。Firefox/WebKit矩阵及上述13项专项夹具未在本轮覆盖。

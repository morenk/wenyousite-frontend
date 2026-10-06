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


## RP 平级与角色提及：契约前准备（2026-10-05）

本批次继续原Worktree/PR54，基线 `1ce103b1c360c2ac2c3ae7f23654c7ad3b3229d2`。已独立改为新空稿默认ACCOUNT，不从兼容角色、首个角色或上次发言推断；明确恢复的RP草稿与未知结果冻结请求不变。成员、账号订阅和作者筛选忽略旧兼容RP投影，使用站内资料。角色级候选、源语法、版本协商及角色卡实际接线仍等待Backend已提交契约，本段不代表角色级提及已实现。

现有提及候选菜单只补视口内滚动及键盘选中项可见性，不新增平行选择器。5文件70项定向测试通过（去重后的集合），独立默认/账号展示的typecheck与定向eslint通过。此前65项测试断言通过但SSH执行包装的退出码转发出现shell错误，后改为Python子进程记录并重跑上述70项，实际exit0；不将包装错误列为业务失败。

v12仅为断网本地组件fixture，实际使用现有候选菜单；账号加10个角色、同名条目、1024×1000浅色和深色150%字号。初次账号行完整、键盘末项可达，无横向溢出、页面error或越界请求。浏览器及临时fixture服务已关闭，共享交互预览未恢复，没有API写入。源码摘要（追加本记录前）`1b39e729dc2a9851752a50a7c1655e82f8cb5107c27de29972ec2aed50c26fad`，仍为视觉候选；角色语义和最终能力状态将在契约接入后验证。

| v12 图片 | SHA-256 |
|---|---|
| `rp-peer-mention-initial-light-1024-v12.png` | `102bced742ead3dd8cb65b6c3cc982e6a3c80c5b421e8be847ed8120b5cb083c` |
| `rp-peer-mention-last-light-1024-v12.png` | `2f2495e647bee5dacb28870ae32b9adb3df5c3a1810223ee593b8bc19e7b1764` |
| `rp-peer-mention-initial-dark-large-1024-v12.png` | `6a46160d69d183bd8b17877e56c70768d13eeb8fb11c379112e584b8ef36f86a` |
| `rp-peer-mention-last-dark-large-1024-v12.png` | `50fbe94b117da1f47842f142a8734246b7f72c4e4a1bcf514c9a7388ac15722e` |

### 角色级提及接入与定向反馈

已固定 Backend `62142042b76e2f15a92794337316bd4c1e3dd659` 的 API5.35/Markdown6可选能力；全局 Markdown 契约仍为5。候选按稳定 `candidateKey` 和 `mentionHref` 选择账号或任一角色，同账号同名不合并；新编辑器始终ACCOUNT。读请求（含SSR与导出）声明header6，八种正文写入只在服务端支持时声明整数6。新服务关门禁时继续请求平级候选且接受空集合，不回退兼容主身份。

真实Milkdown发现昵称中的星号和反引号被默认链接序列化器转义，已用窄范围原子解析/序列化修复。角色标签原字符包括 `*白鸦*`、反引号和 `&amp;` 保留，格式只作用完整节点外侧；普通链接继续默认规则。阅读、摘要、编辑装饰和HTML复制按 `sourceHref+原label` 投影，配对HTML属性携带原源，纯文本使用当前安全展示。角色@只读同一稳定角色ID的卡片，账号@直达账号主页。旧服务不支持v6时，本地恢复或粘贴的显式目标在编辑器写出出口被阻止并保留正文；未知结果的能力字段（含原本未声明）随请求一起冻结。

定向检查保留真实过程：初轮141项140通过、1项旧未知版本断言需要从6更新为7；第二轮102项98通过、4项新测试fixture/DOM查询错误，随后修正。实际昵称诊断3项中1通过、2项错误转义为真实业务缺陷，以上修复后6文件53项全部通过（包含真实Milkdown、候选、卡片、预览、源解析和四发表入口冻结）。Typecheck先发现新fixture字段与插件options类型错误，修正后最后一次exit0。定向集合有重叠，不累加为最终唯一测试总数；完整门禁与一次性隔离结果待下段记录。

同账号同名且最终安全头像也相同的候选显示简短序号，读屏包含“同名身份1/2”；异头像不加序号。此前v12截图早于该序号改动，保留为历史候选证据，不能代表最终界面。共享交互预览继续停止，全部新写入验收只允许已提交runner新建的一次性隔离资源。


### v13 画面与全量首轮

v13实际复用提及候选组件，仅连接本机fixture：1024×1000浅色与深色150%字号、11个平级候选、同账号同名同头像短序号、账号首行与键盘末项可达，0水平溢出、0页面错误、0越界请求。fixture浏览器及服务已退出。Vite仅报告既有CSS导入顺序警告；没有共享预览或业务API连接。治理主任务已实际核看浅/深初始图，确认账号、头像和短序号可辨，长名省略及滚动边界合理。

截图源摘要：`79412860a78c72c1bbd1d5cf9762e51e503b9c31f2c645c44d6e993908833a46`。随后只将三个UI入口读取能力快照移入领域Hook以符合架构规则，候选组件未变化；不将之后全树摘要当作截图版本。

| v13 图片 | SHA-256 |
|---|---|
| `rp-peer-mention-initial-light-1024-v13.png` | `4bf19f65de55d8f010b3351ca3ef4112ccd71c03f094e24f4497d6d1dd7a9701` |
| `rp-peer-mention-last-light-1024-v13.png` | `dab87f38048d5120ce58999b134c6679b4d9ccebf856011de64d4f092e7aae6d` |
| `rp-peer-mention-initial-dark-large-1024-v13.png` | `f8afdc926ab3b520d671718f0457297dc229618124af863ea0db966686c973e7` |
| `rp-peer-mention-last-dark-large-1024-v13.png` | `b58cba370f564cb4cb487c2cada8b84517cc1281dcb62f7b7b899485c258789d` |

完整门禁首条在架构层正确拒绝UI直接使用QueryClient；安全审计、预览4项、lint、typecheck、固定契约已先通过。改为领域Hook后静态、契约、架构、设计全部通过。随后全量361文件3986项：3978通过、8失败；7项是旧楼层/表单测试提供的不完整QueryClient替身，1项是契约来源测试漏复制新增v6语料。已去掉多余QueryClient替身，复用测试已有的真实Provider，并补齐语料，受影响3文件46项全部通过；应用源码没有再修改。

Vitest失败时未生成覆盖率报告，所以保留此轮失败记录并以2个worker及reportOnFailure补齐完整覆盖率集合，然后继续部署源、文档、构建与一次性隔离E2E。最终唯一计数以恢复轮报告为准，不与上述定向数量相加。隔离候选固定干净Backend `8642045725ad90c9b98f1189ce46f928e1ecae33`；机器契约与本仓导入的 `62142042b76e2f15a92794337316bd4c1e3dd659` 逐字相同。


### 平级角色最终静态与覆盖率门禁

恢复轮 **361个文件、3986项全部通过**；全局 statements 87.20%（14153/16229）、branches 80.06%（11364/14193）、functions 85.07%（3484/4095）、lines 90.77%（12548/13823），原模块阈值均通过。受影响测试文件lint、部署源预检、文档45文件/247个GET·POST·PUT·PATCH·DELETE操作/216个直接调用、Next构建和3183文件字体扫描均exit0。完整OpenAPI包含HEAD时为248个操作，文档审计有意排除HEAD。加上已通过的安全审计、预览协议4项、lint、类型、契约、架构与设计检查，完成规定check链；保留前述失败及修复，不宣称首条命令直接通过。

后端兼容发布由独立Backend任务负责，PR44合并提交 `58f4526e3d4d293770428d92b332e02bb6b3fddd` 与隔离固定源 `8642045725ad90c9b98f1189ce46f928e1ecae33` 源码树一致。本Web没有合并或部署；该发布不代替Web隔离验收，也不把生产关闭的新角色提及写入门禁声明为已开放。

## 平级提及隔离旅程的修复记录

完整矩阵 `e2e_e5254fa99af4bb021a22ef73` 共 255 项：241 通过、13 项既有条件跳过，新增平级提及旅程 1 项失败。失败始于测试上下文 API 读取未取得 JSON，尚未发生该旅程的登录与写入。其余长正文矩阵不因后续定向修复重复执行。

后续均只运行新增旅程，固定 Backend `8642045725ad90c9b98f1189ce46f928e1ecae33` 的一次性隔离入口并显式开启 v6 写门禁。失败证据保留，未把部分通过报告为旅程通过：

| runId | 实际结果 |
| --- | --- |
| `e2e_4db516ae1e46d2ebb09d084e` | 超时；关闭浏览器时的二次异常覆盖了首个等待，修正诊断 |
| `e2e_f7481f3f8f80acbe2ba6e8d1` | 连续选择后的 ACCOUNT 候选未出现 |
| `e2e_63067640afbbaa467512a2a6` | 确认查询误含已完成的角色文字；修复连续插入后的查询范围与无 mark 空格 |
| `e2e_544691ed105fcf144df84a58` | A/B/ACCOUNT 三目标发表 201；流式 Request 的 CDP 正文为空，改为浏览器内只观测发言请求体 |
| `e2e_7f3aa2470eadcae33f0d3ec2` | 三目标发表、同 ID 卡片、新旧读取、通知去重、关闭投影与复制通过；打开旧正文编辑失败 |
| `e2e_d7b0d9809b3743fb47071e5b` | 原文 GET 保持三个源目标；编辑器打开后页面无响应 |
| `e2e_22bed3fe1ca64d1871364956` | 确认浏览器渲染线程循环，非接口等待 |
| `e2e_7709882cba4819a3bc654a47` | 仅将 DOM 属性写入改为幂等不足以消除循环 |

上述失败运行均记录 `resourcesRemoved=true`，对应资源目录已移除，登记清单为空。失败消费者不会发出 passed 事件，因此报告的 `cleanupVerified/resourcesCleaned` 仍为 false；这里区分已核验的物理资源移除与整个验收未通过，不改写原报告。

接着将故障缩小为无后端连接的真实 MilkdownHost 浏览器样例。应用 observer 只观察 childList、characterData 与 href；编辑显示属性经 ProseMirror 默认 MarkView 回读，可能重新生成 DOM 并再次触发投影。为自有显示属性增加窄范围 ignoreMutation，保留真实 href 与正文变更。首次局部浏览器已能显示三目标及关闭后的账号投影，页面响应恢复；末尾原子实体的光标输入还在核验，尚不宣称完整修复。同期类型检查与 3 套 18 项相关测试通过；此前新增测试的 MutationRecord 类型断言错误已修正，该失败链未启动隔离运行。


### 编辑器闭环与精确旅程通过

真实 MilkdownHost 已证明 DOM 回读循环来自 ProseMirror MarkView 对显示专用属性的重新解析；仅忽略本节点自有展示属性，href 与正文变化仍读取。末尾提及增加零字符 widget 让原生编辑器生成外侧光标支点；普通输入清除链接 mark，IME 使用原生 composition 并在边界清除 stored mark，不改文档或 Markdown 源。保留原 display:none，没有把实验性字号隐藏当作修复。

真实 Chromium 样例普通输入 6 字、3 次 MarkView 创建、6 次文档变化后空闲稳定；中文组合输入 3 次创建、1 次提交，A/B/ACCOUNT 三个原称呼及 href 完整保留，0 页面错误和外部请求。强制刷新不能恢复内存 pending 的既定边界不变。

精确隔离 `e2e_5135a847342936bc1f526b9d` **1/1 通过**，固定 Backend8642045；candidate `dd2a308a-9162-4451-901b-30d29133f95f`，报告 `.e2e-results/7cf3ef30-0858-4c6f-897d-5c77492a95c7.json`。A/B/ACCOUNT 连续选择发表、B 同 ID 卡、v6 原源/旧读降级/Vary、账号通知去重、关闭投影、HTML 复制保源及纯文本投影、旧正文中文追加、粘贴与 gate-off 无回退全部通过。`resourcesRemoved/cleanupVerified/resourcesCleaned` 均 true，三处登记目录均空。

### 资料引用与候选行（API5.36）

固定已提交 Backend `6d1228cd8c128f24860ef99747aa923c461a595a`，新资料契约与批准的60273e5逐字一致，OpenAPI SHA-256 `a3a572443cebb7254770ec8d5c33ca07089dfd78fce1553804c6a5234a7f78fe`。该后端仍为 Draft PR45，本批没有合并或部署 Web。已部署58f/API5.35不提供资料能力，消费端隐藏输入。

资料定向首轮类型与架构通过，66项65过1项旧「当前角色名称」断言失败；按批准三段结构修正测试。后续57项56过1项旧菜单绝对left断言失败；真实浏览器可计算CSS clamp/min而jsdom不支持，布局定位由实际截图断言，单元保留width与resize回归。受影响菜单9项通过。新增E2E辅助文件的正则转义类型错误在运行前修正，未启动隔离资源。

v14 被治理实际核看拒绝：提及弹层裁边、可见 X、夹具字面换行。v15 资料四张顶部/末尾浅色与深色150%图已实际核看，原生引用、列表、图片、骰子、账号入口及单一滚动符合结构。v15/v16 提及仍受根元素 stable scrollbar gutter 裁切；v17 使用 clientWidth 与根元素矩形宽度的较小值约束，真实360px视口可用345px，浅色x49/width288、深色x8/width329，右侧均止于337px。治理已实际复看明暗两张，无新增视觉阻断；均为无后端合成组件候选，不代替负责人验收。所有 fixture 浏览器/服务已关闭，未恢复共享预览。

v15 sourceDigest: `a18b876154242ddcff9308b56f9948fe34459ffbc0d19b9e4168acbcc9555d1d`.

| 图片 | SHA-256 |
| --- | --- |
| `rp-profile-top-light-360-v15.png` | `bebf0fd5ab14cc8329c330ab823ec0b57b86f06487cbf6c1e85bd66374cdb84f` |
| `rp-profile-bottom-light-360-v15.png` | `c9ce5a0ff485dcfa44cdfb83cfa03b1903203ef52ee1968deb8d5a784ff936d9` |
| `rp-profile-top-dark-large-360-v15.png` | `48c8fdd090964bbb0d5b89ffbe9efc70196de43d152dc07a482d5cdf4951072c` |
| `rp-profile-bottom-dark-large-360-v15.png` | `8473fe622bd7a91e8e3f0c864315515c9a799b717c625c9c02d8b7490f2a0130` |

v17 sourceDigest: `9c2006fd15d11766da6b3f96bfa70c4f1113eeade3bb926d2188dfb70658bef3`.

| 图片 | SHA-256 |
| --- | --- |
| `rp-peer-mention-initial-light-360-v17.png` | `9a43dd985fe5a644288f4c29a97a6ce218a946a396a8a5931db4f1dfc45c23be` |
| `rp-peer-mention-initial-dark-large-360-v17.png` | `671d357d7557ffb5a76a00bcf2950fb009f70ef4b549c1aa0110802a4335f908` |


### 资料隔离结果与最终完整门禁

新资料引用与既有多身份操作两个旅程 **2/2 通过**：`e2e_bc7e9712c3efbb5c9a90410e`，Backend `6d1228cd8c128f24860ef99747aa923c461a595a`，candidate `00db993c-7473-406a-958d-31004cb86bc5`，报告 `.e2e-results/bf0d1a49-2ff7-46a5-a217-3db6d5f4bfdf.json`。绑定验证、非法链接保留、token 不变、多角色同绑定、当前正文修改、骰子/提及、网络失败局部重试、另一子贴楼中楼坐标、目标删除后的统一不可用、owner 原绑定编辑和明确清空、旧能力隐藏均通过。三项清理标记全部 true，三个登记清单均为空；没有复用生产或已停止共享预览。

Backend agent 独立只读审查未发现阻断，覆盖 owner 原绑定、version 固定和冲突保稿、能力缺失、授权刷新遮蔽、viewer/query 缓存与纯绑定 token 语义；审查不代替上述实际执行。

最终完整 check 首轮安全审计、预览4项、lint、类型、精确契约、架构、设计和字体通过；覆盖率集合364文件/4020项中4019过、1项旧测试仍以「@小明」定位新候选。按本轮已批准的去重复 @ 展示更新该测试，并继续校验稳定 user-2 目标和输出 原称呼「@小明」与路径 `/users/user-2` 原 Markdown。受影响真实编辑器34项与该文件lint通过；应用源码保持冻结。恢复完整覆盖率及后续门禁的最终计数以下方记录为准，不把定向次数相加。


恢复全量 **364文件、4020项全部通过**；覆盖率 statements87.31%（14336/16419）、branches80.19%（11568/14425）、functions85.15%（3523/4137）、lines90.87%（12685/13958），所有原阈值通过。发布源门禁通过。文档检查一度把验收记录里的行内提及示例识别为本地文件链接；改为分开描述原称呼与路径，只复验文档及后续构建，不再跑已通过的覆盖率和隔离旅程。


最终文档复验 exit0：45个文件，247个 GET/POST/PUT/PATCH/DELETE 操作、216个直接调用；完整 OpenAPI248另含HEAD。Next生产构建与3182个产物字体扫描 exit0。合并原静态检查及恢复覆盖率，规定 check 各阶段全部完成；检查过程中的旧断言和文档示例失败如上保留。最终源码不再改动，之后只整理交付记录。Web保持Draft、未合并未部署；没有真实账号快照或负责人完整业务验收，Firefox/WebKit及既有13个专项条件场景仍未覆盖。


### 2026-10-06 授权发布前核验

负责人明确批准合并、部署 Backend PR45 与 Web PR54，并在兼容后端及 Web 上线后开启角色提及写门禁；本次不发布正式 Mobile APK、不强制用户升级，不清理旧 Markdown 协议。该授权替代此前仅交付 Draft 的发布边界，不代替真机观感验收。

Backend PR45 已合并为 `eb9ff12c770b14501eb1d9daa19f4d823728eba6`，源码树与已验 `6d1228cd8c128f24860ef99747aa923c461a595a` 完全相同。Web 在原工作树重新以已合并完整 SHA 执行标准 `contract:sync`、`generate:api`、`contract:check`，全部通过，机器契约和 SDK 零差异。本次只更新精确来源及发布记录，复用上节 364 文件／4020 项和 2+1 隔离旅程证据，不将旧候选报告改写为重新执行。

Web 须等兼容 Backend 实际上线确认后，再由干净且等于 `origin/dev` 的管理源构建及使用 `deploy-standalone.sh` 切换不可变 release。公网只运行匿名只读烟雾和静态资源检查，不登录、不发帖、不回复。Web 上线后仍由 Backend 发布任务最后启用门禁并确认；单独部署 Web 不代表门禁已开启。精确 Web 合并 SHA、release 元数据及只读结果记录在 PR 和治理交付记录中。


### 发布前依赖安全审计补丁

本轮发布前重新执行生产依赖审计发现 3 high／1 low，已保留 `.dev-preview/release-security/audit-before.json`；这只表示本轮新发现，不推断公告的首次生效日期。原代理访问官方 npm Registry 发生 TLS reset，检查进程对 `registry.npmjs.org` 加入 `NO_PROXY/no_proxy` 后正常；固定 Foundation 的官方 GitHub 下载同理，不修改全局代理或审计源。

| 实际锁定依赖 | 修复版本与范围 | 官方依据 |
| --- | --- | --- |
| source-map-js 1.2.1 | 1.2.2；在 PostCSS／Vue compiler 的 `^1.2.1` 范围 | [GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q) |
| prosemirror-view 1.42.2 | 1.42.3；在 Milkdown prose 的 `^1.41.3` 范围 | [上游安全公告](https://github.com/ProseMirror/prosemirror-view/security/advisories/GHSA-c8x8-7fp4-3x9w) |
| Vue／server-renderer 3.5.40 | Vue 及锁步子包统一 3.5.42；在 Milkdown 的 `^3.5.20` 范围 | [GHSA-g2v6-rqmx-r4w6](https://github.com/advisories/GHSA-g2v6-rqmx-r4w6) |
| KaTeX 0.16.47／0.17.0 | 统一 0.18.2；跨现有 0.x 次版本范围，使用精确受影响版本 override | [上游安全公告](https://github.com/KaTeX/KaTeX/security/advisories/GHSA-238p-pmpm-9mq7) |

只在原 PR54 增加锁定版本 override，没有批量升级 Milkdown、Next、React 或 Foundation。Vue compiler 更新带来的 Babel parser/types 新子依赖是该锁步升级的一部分。KaTeX 0.18 的[内部类名前缀变更](https://github.com/KaTeX/KaTeX/releases/tag/v0.18.0)已核对：本仓没有针对旧内部类名的选择器或白名单；Milkdown 导入该依赖自己的 CSS，实际 `renderToString` 公式和配套 CSS 通过包级定向检查。全仓 `src` 审查确认真实编辑器采用 `CrepeBuilder` 并未启用 LaTeX feature，阅读器也没有数学插件；本次不新增公式功能，不将包级检查冒称为真实公式编辑／阅读 UI 或视觉验收。实际使用的编辑、阅读和提及路径由后续完整门禁及隔离旅程覆盖。

官方 Registry 的修复后生产审计为零漏洞，`pnpm install --frozen-lockfile` 成功。新增真实依赖行为回归覆盖 Vue SSR 丢弃回车属性名、KaTeX 不继承原型 trust 及常用公式/CSS、source-map 解析时拒绝巨大 section 偏移；旧 main 依赖只读探针分别复现保留恶意属性、生成不可信链接、未拒绝巨大偏移，新依赖三项通过。首轮新增测试中两项正常输入预期写错（并非所有内部类名都加前缀，indexed map 原有零列行为也不能按 flat map 预期断言），修正正例后 3/3 通过，原失败日志保留。`pnpm peers check` 的既有 `@emnapi` 四项范围警告与未修改的 main 相同，不属于本补丁新增。

因为真实依赖已变化，原 4020 项及隔离证据只保留为补丁前历史，最终完整检查和新隔离结果在后续记录，不冒称沿用为新依赖已验。后端安全发布修复仍先行，尚未合并或部署 Web，也未启用角色提及门禁。


### 安全补丁最终完整检查与隔离结果

本轮 `pnpm check` 原入口一次 exit0：生产依赖审计零漏洞、预览协议4项、lint、类型、精确契约、架构、设计／字体、完整覆盖率、部署源预检、文档和 Next 生产构建均通过。覆盖率 **365文件／4023项全过**，statements 87.31%（14336/16419）、branches 80.19%（11568/14425）、functions 85.15%（3523/4137）、lines 90.87%（12685/13958）；原阈值未改。文档45文件／247操作／216直接调用、产物字体3182文件通过。证据：`.dev-preview/release-security/check.log`、`check.exit=0`，新增安全测试首轮自身正例失败及修复保留在前文，不混写为 check 首轮失败。

随后执行 `check:full` 的标准后半段 `pnpm test:e2e:candidate`，因 ProseMirror 依赖变化完整重跑 Chromium 候选集合，包含长文CPU1／CPU4输入性能、真实Markdown往返、剪贴板、阅读、@角色、资料引用和既有核心旅程。**256项：243通过／13既有条件跳过／0失败**，exit0。runId `e2e_265e5c4add58ba06f76e4ccd`，候选 `8d719b7b-f98a-4fb7-9d18-04a81839f1e4`，固定干净 Backend 安全补丁提交 `c7718ad980e9166643071e26e55fecfa68606d88`；报告 `.e2e-results/acfc1474-3c80-424a-97d1-08c28abb3793.json`。`resourcesRemoved`、`cleanupVerified`、runner `resourcesCleaned` 全为 true，`residualCleanup=false`，已核实本轮 `/tmp/wenyousite-e2e-8zQTCM` 被移除。未使用线上资源或已停止的共享预览。

负责人后续明确批准 Backend 新增安全 PR46，该 PR 合并后的最终提交为 `a624bed0eb2b118701bd593fbce2aabf3dea7321`，树与本轮隔离来源 `c7718ad980e9166643071e26e55fecfa68606d88` 完全一致。Web 再次从最终已合并 SHA 标准同步契约、生成 SDK 并核验，机器契约和生成文件仍零差异；只更新来源元数据和文档，不机械重跑未变化的应用全量。旧格式读取和写入保护继续保留，角色提及门禁只在两端实际发布健康后由 Backend 发布任务最后开启。

以上是自动化验收：Firefox／WebKit、13项有专项前提的条件场景及负责人真机观感未覆盖。KaTeX仍是未启用公式功能的传递依赖，仅核验包级安全和配套样式；不将其称为真实公式UI验收。Web 工作树和视觉候选保留，最终合并／部署 SHA、只读烟雾、不可变 release 元数据在本 PR 与治理交付记录续记。

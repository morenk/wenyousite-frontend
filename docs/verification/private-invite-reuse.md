# 私密邀请重复分享验收

## 行为与契约

日常“复制邀请链接”每次调用 PUT 获取当前邀请，首次无链接时原子创建；关闭页面或跨端再次获取复用服务端当前链接，不依赖客户端持久化。当前界面只有一个复制按钮；不再显示邀请卡片、标题、说明、重置按钮或确认。旧客户端 POST 兼容保留，其轮换后旧链接对所有访问者失效，已加入成员从帖子入口继续阅读。

Backend 固定文档/契约来源提交 `4db0cdf2c079fc8b66545c67849053cd74945f8a`（相较上一轮 `cfe9621c39f9d9c8c7f764bf45293be43bab1af7` 仅文档变化），OpenAPI `5.29.0-dev.20261001.1`，新增 `threadsEnsureInviteLink`；旧 POST operationId 不变。契约经仓库同步入口和生成器产生，运行时再次检查 threadId 与 token 格式。共享说明见 [Foundation 共享规范](https://github.com/morenk/wenyousite-foundation/blob/c7af81120c147f19f0c88d3fe491a703f9f6a87d/docs/interaction.md#私密主题邀请重复分享)，本功能不要求发布 Foundation 包。

本界面只调用 PUT；请求锁覆盖取链与剪贴板全过程。成功仅短 toast，接口失败提示重试且不自动调用 POST。只有剪贴板失败才在按钮下展开手动复制提示与共享只读 Textarea，URL 完整换行、可全选，不打开 Sheet。路由、身份与帖子变化清理例外状态，服务端 PRIVATE→PUBLIC 直接隐藏邀请并抑制迟到响应。旧 POST 的兼容方法与防自动重放策略保留，没有协议清理。

旧邀请页面有已加入缓存时，仍须本次挂载复核成功才能跳转；404 显示失效，不会因旧缓存永久加载或自动进入帖子。

## 本轮简化候选与定向检查

继续原 PR #46、分支与 Worktree，未改造 Web 整页、标签或发布设置。新单按钮回归在上一版实现失败，记录 `/tmp/web-invite-simple-red.log`；新实现5文件/87用例通过，记录 `/tmp/web-invite-simple-targeted.log`。手动链接改为共享多行控件后，直接相关2文件/47用例通过，记录 `/tmp/web-invite-simple-multiline.log`。

官方 `contract:sync` 与 `generate:api` 已针对新固定来源执行，OpenAPI/生成类型没有差异。Foundation 正式依赖仍 v7.2.1，本次共享规范只更新文档，无版本/API变更。本轮定向隔离 E2E 仅选两条变化旅程（单按钮真实 API 重复分享/重开/原生剪贴板与模拟拒绝、管理页只读单按钮与失败展示），2/2 通过：runId `e2e_f934e3bc7afc0519b5306370`，Backend 固定 `4db0cdf2c079fc8b66545c67849053cd74945f8a`，报告 `.e2e-results/1af2acd4-cb9a-416e-94fd-8962798a7be6.json`，`resourcesRemoved=true`、`cleanupVerified=true`。定向 ESLint、typecheck、docs与固定来源 contract检查通过。

负责人已确认本轮视觉候选，并明确授权合并及核验后的分支清理；未授权部署。下述首轮检查作为历史记录，最终交付结果单独列出。

## 最终交付门禁

- 本轮实际运行 `pnpm check:full`，首步安全审计 exit1，原始日志 `/tmp/web-invite-final-simple-checkfull.log` 保留；既有依赖例外说明见下一节，不宣称组合命令通过。
- 其余10个子项依次执行：`test:preview`、`lint`、`typecheck`、`contract:check`、`arch:check`、`design:check`、`test:coverage`、`test:deploy-preflight`、`docs:check`、`build` 全部 exit0，日志 `/tmp/web-invite-final-simple-subchecks.log`。最终全量单测336文件/3652用例通过，statements 86.23%、branches 78.42%、functions 84.03%、lines 89.94%，覆盖率门槛通过。
- 负责人确认单按钮候选后，通过原受控 runner 采集原1440测试的实际图，经人工查看再更新同名expected；测试身份及容差不变。采集轮 `e2e_488e8e77d7621f78d2740d81` 因旧视觉预期失败（1条），报告 `778df0a7-0874-441f-be62-1d05950ba9ee.json` 保留 `resourcesRemoved=true`、`cleanupVerified=false`。
- 该 false 的具体原因是 Web runner 将 `cleanupVerified` 定义为“目录已移除且Backend发出passed事件”；消费者截图断言失败阻止passed事件。独立只读核验确认该runId的登记条目、同UID进程环境及owned资源目录均不存在；未进行额外删除，未改原报告。证据 `.dev-preview/invite-final-collector-cleanup.json`。
- 最终完整 `pnpm test:e2e:candidate` exit0：`e2e_1edea2c21cd2e269e8d7129f`，192条记录中188 passed、4条既有原地址用例 skipped、0 failed。报告 `.e2e-results/ad9751a1-33a2-4bde-9917-f8687806d7db.json`，正式 `resourcesRemoved=true`、`cleanupVerified=true`。额外核验事先登记的 `/tmp/wenyousite-e2e-5Wztpi` 已不存在，登记条目和同runId进程均不存在，证据 `.dev-preview/invite-final-e2e-cleanup.json`。
- 这轮完整套件使用已合并历史中的 Backend `4db0cdf2c079fc8b66545c67849053cd74945f8a`。Backend #38、Foundation #28 已合并；机器契约与正式Foundation依赖未再变化。没有部署或接管正式服务。

## 首轮基线与检查（历史）

初始从更新后的 `origin/dev` 提交 `2f110c0a3e2c3289c7157f72f3a2f18242a91e46` 建立独立 Worktree。完整隔离回归结束并清理后，按仓库提交门禁快进至 `4f526ee5515e1fc3a3c168ef77711fbae416dc86`，无冲突恢复本目标差异。该上游包含 Foundation 正式 `v7.2.1` 与编辑器双对齐按钮；本目标没有修改 package 或 lock。

- 原实现对新“复制邀请链接”入口回归失败，记录 `/tmp/web-invite-red.log`；新实现相同入口通过。
- 阶段性全量 `pnpm test:coverage`：336 文件、3642 用例通过，覆盖率门槛通过，记录 `/tmp/web-invite-coverage.log`。这轮早于后续可见性刷新与旧邀请缓存修正，不冒充最终源码全量单测。
- 最终基线定向单测：邀请链路与上游编辑器相关共 9 文件、181 用例通过，包含请求失败、响应丢失恢复、接口缺失不回退 POST、剪贴板失败、重复操作锁、切号/卸载/路由迟到响应，以及 PRIVATE→PUBLIC 刷新和缓存→404。记录 `/tmp/web-invite-rebased-targeted.log`。
- 最终 `pnpm lint`、`pnpm typecheck`、`pnpm design:check`、固定提交 `BACKEND_CONTRACT_REF` 的 `pnpm contract:check`、`pnpm docs:check`、`pnpm build` 通过。契约为 233 操作、203 前端调用；Foundation 7.2.1 检查通过。日志 `/tmp/web-invite-rebased-lint.log`、`/tmp/web-invite-rebased-contract.log`、`/tmp/web-invite-rebased-build.log`。
- 本轮未改动的架构、预览生命周期、部署预检分别经 `pnpm arch:check`、`pnpm test:preview`（3 项）、`pnpm test:deploy-preflight` 通过。

## 依赖审计阻塞

本轮实际 `pnpm check:full` 的安全审计首步报告2项既有依赖问题：Next.js `16.3.3` critical [GHSA-vcvr-r3jv-pc5j](https://github.com/advisories/GHSA-vcvr-r3jv-pc5j)（审计标示修复版 `16.3.6` 起），以及 DOMPurify low [GHSA-p98j-92pf-mc4p](https://github.com/advisories/GHSA-p98j-92pf-mc4p)（修复版 `3.4.16` 起）。首轮单独审计日志 `/tmp/web-invite-audit.log` 和本轮完整命令失败 `/tmp/web-invite-final-simple-checkfull.log` 均保留，没有关闭审计、增加豁免或混入独立依赖升级。

最终 package/lock 与 `origin/dev` 的 `4f526ee5515e1fc3a3c168ef77711fbae416dc86` 字节一致，SHA-256 分别为 `e64337bc09f06c10fad479b56c9ad06c5f3ee637af8db18970f05ef800dc5ffb`、`b6a6d205cc835f8b2d0129a71bf7c822e700ac6155c3f8da3638fcfb896329da`；相同 `pnpm audit --prod` 依赖输入同源，核验记录 `.dev-preview/invite-final-audit-baseline.json`。按本仓库 AGENTS 第4节“外部环境或无关既有失败只能在提供定向等价验证并明确记录后例外处理”登记；其余子项与最终完整隔离结果见上节，不将其改写为 `check:full` 整体通过。

## 首轮正式隔离 E2E（历史）

通过仓库 `pnpm test:e2e:candidate` 入口运行，Backend 固定首轮运行提交 `cfe9621c39f9d9c8c7f764bf45293be43bab1af7`；独立 PostgreSQL、Redis、上传目录、会话与随机测试账号，启动前核验本轮登记和候选实际代理。真实业务写入只在一次性登记资源中进行，没有向持续预览或线上执行邀请重置、成员写入。

| runId | 结果 | resourcesRemoved / cleanupVerified | 报告（Worktree 的 .e2e-results） |
| --- | --- | --- | --- |
| `e2e_669a8d2644785bd4a308585f` | 首轮定向 6/8；旧界面截图预期与用例等待发布 URL 的匹配错误失败 | true / false | `ffa5222e-4e80-417b-a1f3-d1eb43c79536.json` |
| `e2e_46ae0868c8698198a2e7a143` | 完整候选 passed：188 passed、4 条既有原地址用例 skipped、0 failed | true / true | `e8b95252-2f2e-4488-a49f-956c6682da04.json` |
| `e2e_02e8d36be4fe9e2264b04bf2` | 同步最新基线后定向 25/25：邀请、管理台与两份编辑器 spec | true / true | `171f16d0-cbb7-405a-8bd6-eaec8b0cf936.json` |

首轮 failed 与 cleanupVerified=false 原样保留；resourcesRemoved=true 不替代正式清理验收。后两轮独立完整清理均通过。没有中断完整运行或操作共享资源。首轮视觉差异由受控 runner 留存实际候选，经查看后明确更新原 1440px 基线，保持测试身份和容差；没有使用被禁止的 `--update-snapshots` 或重命名测试绕过。

真实隔离邀请用例覆盖连续 PUT 相同值、重新加载再次获取相同值、未经确认不发送 POST、确认后只 POST 一次、新旧链接不同、旧链接失效、直接帖子入口正常与新链接正常。断言仅比较凭据是否相同，不把 token 写入报告或截图。并发原子创建、多身份与成员记录不变由 Backend PR 的隔离回归交叉覆盖。

## 实际界面候选

共享合成预览批次 `private-invite-reuse`，runId `preview_ff8b5b1777fb76889132036a`；Web 任务 `private-invite-reuse-web`，负责人通过治理桥接访问 `http://127.0.0.1:43931`。这是合成数据候选，不是线上或当天真实账号数据验收。

`.dev-preview/invite-simple-preview-report.json` 记录本轮来源 HEAD/脏工作区摘要与同批次 UI 结果，运行 Backend 仍为 `cfe9621`，没有为文档提交重启或重建隔离数据。截图为 `.dev-preview/invite-simple-light-1440.png`、`invite-simple-dark-1024.png`、`invite-simple-manual-light-1440.png`、`invite-simple-manual-dark-1024.png`，以及 `invite-simple-normal-320.png`、`invite-simple-normal-360.png`、`invite-simple-manual-320.png`、`invite-simple-manual-360.png`。320/360是实际邀请控件局部证据：仅取景时将同一 React 控件临时置于窄宿主并隐藏其他页面可见层，之后恢复；未复制控件或更改产品样式，不代表 PC Web 改为移动整页布局。

界面脚本核验身份后只用随机合成账号读取管理页，拦截自动签到和所有邀请 PUT；成功与剪贴板失败返回固定示例 token（没有读写真实邀请），接口错误同样由浏览器拦截模拟。检查复制成功仅toast、失败原地显示完整URL、全选、320/360不产生控件横纵内容滚动；没有重置按钮/Sheet或其他业务写入。

上轮确认框候选已被本轮单按钮方向替代；负责人已确认本轮画面并明确授权合并清理。按治理顺序合并后再核验清理；正式部署及独立安全依赖升级不在本轮授权范围。

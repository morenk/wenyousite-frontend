# 私密邀请重复分享候选验收

## 行为与契约

日常“复制邀请链接”每次调用 PUT 获取当前邀请，首次无链接时原子创建；关闭页面或跨端再次获取复用服务端当前链接，不依赖客户端持久化。独立“重置邀请链接”确认后调用旧 POST 一次，旧链接对所有访问者失效，已加入成员从帖子入口继续阅读。

Backend 固定提交 `cfe9621c39f9d9c8c7f764bf45293be43bab1af7`，OpenAPI `5.29.0-dev.20261001.1`，新增 `threadsEnsureInviteLink`；旧 POST operationId 不变。契约经仓库同步入口和生成器产生，运行时再次检查 threadId 与 token 格式。共享说明见 [Foundation 候选规范](https://github.com/morenk/wenyousite-foundation/blob/c21e1fd318c75b659da94f896a2c38b5b154f112/docs/interaction.md#私密主题邀请重复分享)，本功能不要求发布 Foundation 包。

POST 不自动重试，也不在认证刷新后重放；结果不明仅以 PUT 取回当前值，并明确提示未确认重置。获取失败与剪贴板失败分开，后者保留手动复制输入框。确认、请求、恢复与剪贴板阶段共用互斥锁。邀请只存当前楼主、帖子和路由绑定的内存；切号、卸载及服务端可见性变化销毁旧状态并抑制迟到响应。

旧邀请页面有已加入缓存时，仍须本次挂载复核成功才能跳转；404 显示失效，不会因旧缓存永久加载或自动进入帖子。

## 基线与检查

初始从更新后的 `origin/dev` 提交 `2f110c0a3e2c3289c7157f72f3a2f18242a91e46` 建立独立 Worktree。完整隔离回归结束并清理后，按仓库提交门禁快进至 `4f526ee5515e1fc3a3c168ef77711fbae416dc86`，无冲突恢复本目标差异。该上游包含 Foundation 正式 `v7.2.1` 与编辑器双对齐按钮；本目标没有修改 package 或 lock。

- 原实现对新“复制邀请链接”入口回归失败，记录 `/tmp/web-invite-red.log`；新实现相同入口通过。
- 阶段性全量 `pnpm test:coverage`：336 文件、3642 用例通过，覆盖率门槛通过，记录 `/tmp/web-invite-coverage.log`。这轮早于后续可见性刷新与旧邀请缓存修正，不冒充最终源码全量单测。
- 最终基线定向单测：邀请链路与上游编辑器相关共 9 文件、181 用例通过，包含请求失败、响应丢失恢复、接口缺失不回退 POST、剪贴板失败、重复操作锁、切号/卸载/路由迟到响应，以及 PRIVATE→PUBLIC 刷新和缓存→404。记录 `/tmp/web-invite-rebased-targeted.log`。
- 最终 `pnpm lint`、`pnpm typecheck`、`pnpm design:check`、固定提交 `BACKEND_CONTRACT_REF` 的 `pnpm contract:check`、`pnpm docs:check`、`pnpm build` 通过。契约为 233 操作、203 前端调用；Foundation 7.2.1 检查通过。日志 `/tmp/web-invite-rebased-lint.log`、`/tmp/web-invite-rebased-contract.log`、`/tmp/web-invite-rebased-build.log`。
- 本轮未改动的架构、预览生命周期、部署预检分别经 `pnpm arch:check`、`pnpm test:preview`（3 项）、`pnpm test:deploy-preflight` 通过。

## 依赖审计阻塞

`pnpm security:audit` 命中既有 Next.js `16.3.3` critical [GHSA-vcvr-r3jv-pc5j](https://github.com/advisories/GHSA-vcvr-r3jv-pc5j)，审计标示修复版本为 `16.3.6` 起。完整审计输出留在 `/tmp/web-invite-audit.log`。安全审计是 `pnpm check` / `pnpm check:full` 的首步，因此两个组合门禁未通过；未重复执行已知受阻的完整组合命令，实际完成的独立子项列于上文和下文。

没有关闭审计或扩大安全升级范围。最终 package/lock 与上述最新 `origin/dev` 字节一致，SHA-256 分别为 `e64337bc09f06c10fad479b56c9ad06c5f3ee637af8db18970f05ef800dc5ffb`、`b6a6d205cc835f8b2d0129a71bf7c822e700ac6155c3f8da3638fcfb896329da`。仅交付 Draft PR，安全阻塞解决与负责人验收前不能宣称可合并。

## 正式隔离 E2E

通过仓库 `pnpm test:e2e:candidate` 入口运行，Backend 固定上述提交；独立 PostgreSQL、Redis、上传目录、会话与随机测试账号，启动前核验本轮登记和候选实际代理。真实业务写入只在一次性登记资源中进行，没有向持续预览或线上执行邀请重置、成员写入。

| runId | 结果 | resourcesRemoved / cleanupVerified | 报告（Worktree 的 .e2e-results） |
| --- | --- | --- | --- |
| `e2e_669a8d2644785bd4a308585f` | 首轮定向 6/8；旧界面截图预期与用例等待发布 URL 的匹配错误失败 | true / false | `ffa5222e-4e80-417b-a1f3-d1eb43c79536.json` |
| `e2e_46ae0868c8698198a2e7a143` | 完整候选 passed：188 passed、4 条既有原地址用例 skipped、0 failed | true / true | `e8b95252-2f2e-4488-a49f-956c6682da04.json` |
| `e2e_02e8d36be4fe9e2264b04bf2` | 同步最新基线后定向 25/25：邀请、管理台与两份编辑器 spec | true / true | `171f16d0-cbb7-405a-8bd6-eaec8b0cf936.json` |

首轮 failed 与 cleanupVerified=false 原样保留；resourcesRemoved=true 不替代正式清理验收。后两轮独立完整清理均通过。没有中断完整运行或操作共享资源。首轮视觉差异由受控 runner 留存实际候选，经查看后明确更新原 1440px 基线，保持测试身份和容差；没有使用被禁止的 `--update-snapshots` 或重命名测试绕过。

真实隔离邀请用例覆盖连续 PUT 相同值、重新加载再次获取相同值、未经确认不发送 POST、确认后只 POST 一次、新旧链接不同、旧链接失效、直接帖子入口正常与新链接正常。断言仅比较凭据是否相同，不把 token 写入报告或截图。并发原子创建、多身份与成员记录不变由 Backend PR 的隔离回归交叉覆盖。

## 实际界面候选

共享合成预览批次 `private-invite-reuse`，runId `preview_ff8b5b1777fb76889132036a`；Web 任务 `private-invite-reuse-web`，负责人通过治理桥接访问 `http://127.0.0.1:43931`。这是合成数据候选，不是线上或当天真实账号数据验收。

`.dev-preview/invite-preview-report.json` 记录实际来源 SHA/源码摘要、Backend 身份与同批次 UI 结果；图像留存在 `.dev-preview/invite-settings-light-1440.png`、`invite-settings-dark-1024.png`、`invite-reset-confirmation-light.png`、`invite-failure-dark-1024.png`。界面脚本只允许随机合成账号认证、只读管理页、打开并取消确认；自动签到被浏览器拦截，错误状态由拦截 PUT 模拟，未发送邀请业务写入。

负责人已查看确认和错误状态的早期候选，最终画面和原问题仍待负责人验收。合并、部署与后续安全依赖修复另按仓库门禁执行。

# 移动端版本说明 Web 验证记录

本记录对应实现提交 `05d610b30b37504c0f29a4a7e337319f1af2cdfa`，入口与行为见[后台模块](../modules/admin-station.md#移动端版本说明)。[PR #41](https://github.com/morenk/wenyousite-frontend/pull/41) 保持 Draft：功能及定向验收已完成，完整浏览器门禁未全绿，视觉候选仍待负责人验收。未合并、部署或正式发布。

## 来源与检查

- Web 基线：`fb52886ddf543c869b4c654c9bc9bc9c4a9ff845`。
- OpenAPI 来源：Backend `99b42dc0f7d25eeb6e49ee87441e206c77cce29a`，版本 `5.27.0-dev.20260927.1`。
- 隔离 runner：Backend `72d3658d32a089fcfabdea30225d87b960033c5b`，使用已提交的 `--admin-fixtures --mobile-release-fixtures`。
- Backend 最终交付：`9e25b4562dfd9229b0d306b5374c018c3e43f65c`（[PR #32](https://github.com/morenk/wenyousite-backend/pull/32)）；后续脚本与证据修正未改变上述 API，Web 契约和 runner 来源分别保留精确提交。
- Foundation 展示规范：`d9001265030a52d5255c7cd52dc841833cc7afbb`（[PR #23](https://github.com/morenk/wenyousite-foundation/pull/23)），未升级包版本。

`pnpm check` 完整通过：335 个测试文件、3581 项测试，包含 lint、类型、契约、架构、设计、覆盖率、文档、发布源门禁和 production build。测试后只调整了浏览器截图取景、候选文案和两张新增导航涉及的站务截图基线；补充定向 lint 与下述浏览器复验，没有更改业务实现。

| 轮次 | runId | 结果 | 清理证据 |
| --- | --- | --- | --- |
| 更新说明首次真实联验 | `e2e_a7a5bccc81c12e23f3a7317c` | 1 通过 | `resourcesRemoved=true`、`cleanupVerified=true` |
| 全套浏览器回归 | `e2e_4960dd3a8d4b8b35fac759c1` | 173 通过、12 失败、4 跳过，共 189 项 | 资源目录已移除；整轮失败，`cleanupVerified=false`，不计通过 |
| 基线对照 | `e2e_4ac1eeb4b47288a33bb33c99` | 原 12 项中 2 通过、10 失败 | 资源目录已移除；整轮失败，不计通过 |
| 最终定向复验 | `e2e_d0fc4fabf2b4d2325d65e0c5` | 5 通过 | `resourcesRemoved=true`、`cleanupVerified=true` |

全套的 4 项跳过来自 `discussion-target-pages.spec.ts` 原有的 `DISCUSSION_REPRO_FILE` 缺失条件，均需要原始正文的只读快照。本任务未新增跳过、降低断言或扩大差异阈值。

## 全套失败逐项对照

基线应用和原测试断言来自 Web `fb52886`。旧隔离入口不识别新版 runner 的样本描述，首次在登录前被门禁拒绝；因此仅从已提交 `05d610b` 取入 `scripts/e2e-backend-runner.mjs`、`scripts/e2e-isolation-gate.mjs`、`scripts/e2e-safe-reporter.ts` 三个脚本，保留全部资源归属、实际代理和私有文件检查。在相同 Backend 提交、工具与 Chromium 下复验；其余基线文件未变化。这是“基线应用 + 已提交兼容测试入口”的对照，不是未经修改的整个 Git 树。

| 用例 | 全套失败 | 基线对照 | 当前提交定向复验／处理 |
| --- | --- | --- | --- |
| `editor-alignment-compatibility`：right 手动 Enter、自动折行、保存重开 | 原段落失去 right 属性，出现 `Next` 与原文合并 | 通过 | 通过；未改编辑器或测试，初始失败未稳定复现，保留可靠性风险 |
| `markdown-divider-visual`：light | 649×446 与 649×493 不符，3317 像素差异 | 相同尺寸和像素差异 | 保留原基线，未重跑或修改该断言 |
| `markdown-divider-visual`：dark | 同上尺寸差异，34118 像素差异 | 相同尺寸和像素差异 | 保留原基线 |
| `media-display`：全局正文草稿恢复 | `.ProseMirror img[src]` 同时匹配两个编辑器中的图片 | 通过 | 通过；未改产品或测试，初始失败未稳定复现，保留可靠性风险 |
| `moment-detail-layout`：固定图片舞台 | `moment-detail-1440` 差异 89 像素 | 相同 89 像素差异 | 保留原基线 |
| `station-layout`：1600px 用户台账与弹窗 | 712 像素差异，包含新增导航及下方菜单位移 | 原导航截图另有 34 像素差异 | 已审阅实际画面并更新本次导航涉及的基线；通过，阈值仍为 20 |
| `station-layout`：1920px 通知台账与弹窗 | 712 像素差异，包含新增导航及下方菜单位移 | 原导航截图另有 34 像素差异 | 同上；通过，阈值仍为 20 |
| `thread-detail`：作者编辑楼层正文 | 找不到 `.rounded-xl.border` 中指定正文 | 同一定位器失败 | 未扩大本次范围 |
| `thread-detail`：作者删除楼层 | 找不到 `.rounded-xl.border` 中指定正文 | 同一定位器失败 | 未扩大本次范围 |
| `visual-home`：亮色 1440px | `home-1440` 差异 15 像素 | 相同 15 像素差异 | 保留原基线 |
| `visual-home`：宽屏社区壳 | `home-1920` 差异 15 像素 | 相同 15 像素差异 | 保留原基线 |
| `visual-home`：黑夜 1440px | `home-dark-1440` 差异 186 像素 | 相同 186 像素差异 | 保留原基线 |

最终定向复验的 5 项为更新说明真实流程、上述 right、媒体草稿和两张站务布局。余下 8 项已在基线复现，未通过更新原产品截图或编辑器改动掩盖失败。此证据用于 Draft 审查，不宣称 `pnpm check:full` 已通过。

## 真实流程与视觉候选

实际站务密码／本地验证码登录建立 Cookie 会话，再由内存 CSRF 完成写入。覆盖普通管理员创建、确认和已发布修正越权拒绝、409 保留输入与读取最新修订、超级管理员确认、未发布详情返回 404、已发布修正确认前保留旧公开快照及确认后替换，同时保持发布时间。所有登录与写入前核验本轮资源和候选真实代理；样本只存在隔离 PostgreSQL、Redis 与上传目录。

最终候选属于 `05d610b`，源码摘要 `c913985d62e7900adb9aebe48fc9c84b68908694ffc44f9621446def3451d71f`，候选编号 `e7774ab6-ceb2-470e-8b8e-b9d4e711943e`，截图时间 `2026-09-26T21:19:43.228Z`。视口为 1024×768、1366×768，各含 light/dark 的列表、编辑弹窗和公开说明，共 12 张。弹窗截图不包含账号区域；列表使用中性色遮盖账号，提示消息消失后再截图。全部为本轮合成数据，未声称负责人已完成视觉验收。

本任务私有 `.e2e-results/` 保存脱敏报告与图片，不提交账号或会话材料：

- 全套：`7f53e8ed-2cf6-43ca-a108-5c12041e56a2.json`。
- 基线：`baseline-468f7a3e-a46e-4674-9adb-c92262cec1da.json`、`baseline-source.json`。
- 最终定向：`f02e5420-67ad-4780-8860-7e8e7bbeb4b0.json`。
- 图片及源码、视口记录：`mobile-releases-e2e_d0fc4fabf2b4d2325d65e0c5/` 下的 PNG 与 `evidence.json`。

实时开发预览保留在任务 `mobile-release-notes-web`，复用隔离会话 `mobile-release-notes`，runId `preview_705231a26b764b7cd53eed8e`。状态使用 `pnpm dev:preview status --task mobile-release-notes-web --json` 查询；预览是合成数据会话，不是公网部署或真实快照验收。

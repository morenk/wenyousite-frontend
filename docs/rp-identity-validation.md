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

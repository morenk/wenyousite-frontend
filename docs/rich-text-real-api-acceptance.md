# 富文本真实 API 验收入口

本入口的 Web 运行源码固定为已合并 PR #13 的 `6859f00c305b7c63a62fc2d3f709d811c55f2dc0`。S5 分支已整合该提交；相对这个基线仅增加验收工具、测试和说明。预检逐字比较运行源码，报告分别记录运行源码基线 `candidateSha` 与实际验收工具提交 `harnessSha`，不会把整合后的构建标为原候选。

原 S1–S4 回执与 S5 预览仍属于 `c3cd6b905e2b0158adf643dba25b144e7bb9d647`，不能作为新整合源码已验收的证据。合并准备时保留的旧预览在 `127.0.0.1:3105`，build 为 `OmoCE2jGXsemjJNpQW1Lk`；其独立目录与进程记录在 `/tmp/rich-text-web-s5-preview.json`。本轮未重建或替换该预览，也未改变原 APK/双端验收基线；后续验收必须记录实际使用的各端 SHA。

原预览准备时，目标 API 的 `/api/v1/meta` 为 `6bfb818df4ccf5333df7b62018a9f519d91e935b`、Markdown v5。每次执行必须指定并复核期望 SHA；合并记录不能代替 API 实际运行版本。Backend PR #12 已合并为 `2a2847a829b24227b8b6e0930ef63af9b6436546`，本次没有部署它。

## 配置与运行

本轮合并验证时，进程没有可用的 `E2E_EMAIL` / `E2E_PASSWORD`。原预览准备时检查主仓库和 S1–S4 worktree，仅发现 `.env.e2e.example` 占位值，未发现实际 `.env.e2e`；系统 `/etc/wenyousite/backend.env` 不可读，不将其作为测试账号来源。工具不创建账号、不读取应用令牌、不打印凭据，也不自动加载示例文件。

负责人通过现有安全方式将专用账号的两个变量导入执行环境后，在本 S5 worktree 运行。先把下例 SHA 占位符替换为本次批准验收的实际后端提交，不能直接沿用历史观测值：

```bash
export RICH_TEXT_EXPECTED_API_SHA='replace-with-approved-40-character-api-sha'
export BACKEND_URL=http://127.0.0.1:3000
export FRONTEND_E2E_PORT=3106
bash scripts/test-rich-text-real-api.sh
```

预检缺凭据时退出 2，发生在构建或写入前。实际运行先检查运行源码与固定候选一致，再按目标 API 构建独立 standalone；Next 的 API rewrite 在构建时固化，不能只修改测试进程的 BACKEND_URL。候选脚本只启动和清理自己的临时服务，不重启共享的 3000/3001 服务。自动测试默认端口为 3105；原预览占用期间使用上例 3106。入口不会替换已有预览，候选端口已占用时拒绝启动。

只运行 [S5 独立用例](../e2e/s5/rich-text-real-api.spec.ts)：真实 UI 登录、新建未发布草稿、选择私密、通过工具栏设置粗体并输入字面符号/Emoji/NBSP、经真实 API 保存、从草稿列表重开验证。没有 API 响应替身，不发布、删除或修改已有内容。创建界面的初始草稿沿用产品默认可见性，保存时明确设为私密；若中途失败，新建草稿会保留供负责人处理。

普通 Playwright 运行不会自动执行这个用例；需由上述入口明确启用。原有 15 项受账号限制的测试分布在 `e2e/thread-create.spec.ts` 和 `e2e/thread-detail.spec.ts`，包含发布、删除、排序等流程，不直接作为非破坏性专项整组运行。

## 证据与交接

`RICH_TEXT_RUN_DIR` 可指定私有输出目录；默认生成 `/tmp/rich-text-web-s5.*`。输出 `preflight.json` 和 `web-real-api.json`，记录候选 SHA、验收工具 SHA、实际 API SHA、新建 thread/subthread/bodyPost ID、bodyVersion、canonical SHA-256 和最后完成的阶段。真实登录关闭 Playwright trace、截图和视频；报告不含密码、令牌或正文。

`awaiting-cross-client-handoff` 仅表示 Web→API→Web 的私密草稿回路通过。负责人仍需在同一专用账号的 Flutter 候选中打开该 ID，核对显示和编辑后保存，再回到此 Web 候选核对；反向旅程另建测试内容并分别记录版本与 ID。缺账号期间，这些跨端旅程均为未执行。

独立只读预检：

```bash
RICH_TEXT_EXPECTED_API_SHA='replace-with-approved-40-character-api-sha' \
  node scripts/rich-text-real-api-preflight.mjs
```

预检测试：`node --test scripts/rich-text-real-api-preflight.test.mjs`。检查账号缺失提前阻止、API SHA 不符阻止，以及带凭据 URL 的拒绝与诊断脱敏；这不是实际登录验收。

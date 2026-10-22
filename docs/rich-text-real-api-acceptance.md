# 富文本与完整 E2E 隔离验收

## 接入与命令

后端 checkout 必须干净、HEAD 与指定的完整 SHA 一致，包含已提交的 [v1 runner 协议](https://github.com/morenk/wenyousite-backend/blob/c9975105342196a42c0678ca9887518089c401d0/docs/e2e-isolation.md)，并已完成后端 `pnpm check`。只读 PostgreSQL/Redis 工具由治理安装；不要填写任何已有数据目录、连接串或真实账号。

```bash
export WENYOUSITE_E2E_BACKEND_ROOT=/absolute/path/to/backend-checkout
export WENYOUSITE_E2E_BACKEND_REF=填写完整的后端提交SHA
export E2E_PG_BIN=/opt/wenyousite/e2e-tools/usr/lib/postgresql/16/bin
export E2E_REDIS_BIN=/opt/wenyousite/e2e-tools/usr/bin/redis-server
export E2E_LIBRARY_PATH=/opt/wenyousite/e2e-tools/usr/lib/x86_64-linux-gnu
pnpm test:e2e
# 真实浏览器失败、终止和强杀后的登记回收
pnpm test:e2e:lifecycle
# 定向真实登录、创建草稿、保存与重新读取
bash scripts/test-rich-text-real-api.sh
# 常规质量门禁和完整浏览器旅程
pnpm check:full
```

脚本不加载 `.env`。入口仅将白名单工具配置传给后端 runner，由它每轮新建 PostgreSQL、Redis、随机账号、上传目录和随机 API 端口。Web 消费者只能获得本轮 manifest 与账号，不能获得数据库、Redis 或 JWT 密钥。邮件、推送、Sentry、COS 均按后端隔离协议关闭或使用测试 transport；上传拒绝遵循业务配置，不开启测试后门。

## 登录与写入门禁

[所有用例](../e2e/fixtures/isolation.ts) 使用同一个隔离 fixture。预检验证本轮 0700 目录、0600 登记文件、runId、端口及资源所有权；读取内核确认 PostgreSQL/Redis 的实际进程身份，且 Web 必须是同一活跃 supervisor 的后代。然后匿名读取本轮随机用户的公开资料，确认直连 API 与候选实际代理都返回相同身份，确认候选响应标识与磁盘 Build ID/rewrites 一致，才允许登录或实际 HTTP 写入。

缺少 manifest、错误端口、过期目录、外部账号、旧构建、错误实际代理均拒绝；裸 `BACKEND_URL`、`API_BASE`、`E2E_ENV=test` 和 loopback 不能证明隔离。测试浏览器统一使用专用 HTTP 代理，在真实写入前核验候选，阻断外部写入与未登记目标。代理保留浏览器 HTTP 缓存，不使用会关闭缓存的全局 route 拦截。页面 mock 响应不触达后端；缓存/动画用例的 HTTP 模拟站只能登记本进程已监听的临时服务器，所有 API 在本地回应，非 API 写入拒绝，只有匿名页面与静态资源可转发到当前候选。

## 构建、报告与清理

- 生产构建保留 `.next`；每轮 `.next-e2e` 使用随机 `e2e-` Build ID，再复制到本轮私有目录启动。部署脚本拒绝测试 Build ID 和 distDir。
- 浏览器 trace、自动截图、视频及 HTML 报告关闭；视觉用例的显式图像只保留在本轮临时输出目录并随资源清理；账号仅存在本轮私有目录及测试子进程。`.e2e-results/` 的 0600 报告保留 runId、构建身份、后端 SHA、脱敏用例错误及清理状态，不提交 Git。
- 动态字体联验显式保留管理页和正文的亮色、黑夜、1024px 与实际 390px 视口截图到 `.e2e-results/dynamic-fonts-<runId>/`，同时记录源码摘要、Build ID、后端身份与布局宽度。仅保存合成字体和隔离测试正文的实际产品画面，不截取登录凭据、二次验证秘密或认证网络载荷；不启用自动 trace/视频。保留图像不保留隔离数据库、Redis、上传目录或会话。
- 启动阶段即从同一后端子进程的资源登记事件记录 runId/root；`ready` 前失败也核验同轮清理。安全报告仅记录阶段、固定错误类别及资源状态，未取得登记不能推断为未创建资源。stdout/stderr 原文只进入最大 1 MiB 的 0600 `.private.log`，不提交、不上传公开 CI 附件；回收仍仅走正式登记入口。
- 正常、失败和超时由消费者关闭子进程，后端 runner 核验并回收登记资源。消费者仅在用例通过、后端输出同轮清理成功且目录消失时报告通过。后端失败退出但留下本轮目录时，Web 仅调用该后端的正式 `e2e-reap` 入口核验回收，并在报告记录 `residualCleanup`；回收成功也不把原失败改为通过。SIGKILL 残留由后端下一轮启动时按登记核验回收，不能扫描或接管其他任务资源。
- 交付必须连续两轮完整 E2E 使用不同 runId，并确认每轮资源归零。清理失败、身份漂移或生命周期验收缺口不得当作成功交付，详情以 PR 验证记录为准。

## 动态字体的可选跨端检查点

动态字体入口还需显式设置三个已核验的绝对目录：`TEXT_FONT_TOOLCHAIN_DIR`（独立工具链）、`E2E_FONT_LEGACY_BUNDLE`（固定历史产物）、`E2E_FONT_LEGACY_SOURCES`（历史 raw 源）。Web 仅把这三个只读输入传给已提交后端 runner；由它创建本轮私有 S3 协议夹具、导入真实历史版本并启动 Worker，不接受外部存储连接串或凭据。完整 E2E 同样需要这些输入。

冷加载恢复通过现有隔离 HTTP 代理暂时中断本轮新版本的二进制 GET 连接，PNG、清单、正文和写入门禁不受影响；不伪造字体响应或关闭浏览器缓存。实际应用后核对失败请求与默认回退，再恢复连接，要求同页同标记按原账本自动重试并显示字形，不刷新、不重新应用。全局离线本身会暂停调度，不以离线时零请求判定恢复失败。

独立 Web 验收运行 `pnpm test:e2e e2e/dynamic-text-fonts.spec.ts`，报告固定标记 `web-only`，不计作跨端联合验收。需要 Mobile 联验时，在相同命令后加 `--font-mobile-sha256=<实际固定APK的64位小写SHA-256>`；该模式只接受这一份用例，不混用浏览器矩阵或其他筛选参数。参数仅传给隔离测试消费者，不进入产品配置。应先完成构建、设备和操作准备，再启动等待；不能用补写确认代替真实操作。

每轮在已核验的私有隔离根创建 `dynamic-font-checkpoints/`，不复用旧目录。`current.json` 和编号阶段文件记录 runId、随机 checkpointId、阶段序号、版本 ID、后端地址、Web 源码摘要、实际 server/static 构建 SHA-256、Web 会话 ID、预期 APK SHA-256、必验项和截止时间。持久报告目录的 `coordination-pointer.json` 指向本轮检查点；资源清理后只保留脱敏 `coordination.json`，不保留会话凭据。

阶段依次为 `sessions-ready` → `published-v1` → `published-v2` → `disabled` → `enabled` → `rollback` → `withdrawn` → `legacy-mapped` → `legacy-withdrawn`。第一阶段在 Web 编辑器打开后、创建任何新字体 ID 前等待 Mobile 固定构建并打开同一隔离后端会话。后续阶段先完成 Web 操作，再等 Mobile 按 `requiredChecks` 完成选择、发帖、阅读、复制保存重开及对应状态观察，之后才改变下一状态；后端请求仍逐次经过原有隔离核验。

治理核对 Mobile 实测证据后，将确认原子写入 `current.json` 指定的 `ackFile`，文件由当前 runner 用户拥有、权限 0600，不允许符号链接，最大 16 KiB。确认对象严格使用下列字段：

- 从当前检查点原样复制 `schemaVersion`、`runId`、`checkpointId`、`sequence`、`phase`、`versionIds`、`webBuildSha256`、`webSessionId`。
- `mobileApkSha256` 为已核验的实际 APK 摘要；`mobileSessionId` 为本次真实会话 UUID，`mobileProcessId` 为实际 App PID，`mobileSessionOpenedAt` 为会话打开的 UTC ISO 时间。首次确认后锁定三者，后续重启或替换会话须另起新 run。
- `observedAt` 为本阶段完成观察的 UTC ISO 时间，`completed` 必须为 `true`；`checks` 必须完整匹配当前 `requiredChecks`，`evidenceSha256` 为此次实际 Mobile 证据文件的 SHA-256。生成确认的协调者负责核实证据文件与操作结果，哈希本身不证明操作已完成。

错误 runId、旧确认、错阶段、错构建、未完成检查、会话替换或隔离身份失效均立即失败，不能覆盖后重试推进。每阶段最多等待 5 分钟，累计最多等待 20 分钟；超时、页面结束和失败进入原 runner 清理流程。只有九个阶段都有有效确认才记录 `jointAcceptance: true`；仍需完整用例及本轮清理都成功，才能报告联合验收通过。

## 护栏与线上只读验收

```bash
pnpm test scripts/e2e-isolation-gate.test.ts scripts/e2e-fixture-boundary.test.ts scripts/e2e-candidate-policy.test.ts scripts/readonly-smoke-policy.test.ts
pnpm test:e2e:guards
pnpm test:smoke:readonly
```

`test:e2e:guards` 在本机临时服务核对拒绝公网、线上 loopback 和缺少身份等场景，验证写入、重定向和会话均未到达服务端；不连接业务数据库。`test:smoke:readonly` 仅匿名检查线上健康、登录页和公开阅读，不记录密码、Token、Cookie、内容正文或 trace，不允许业务写入。普通阅读产生的服务端日志和阅读统计不属于测试业务写入。

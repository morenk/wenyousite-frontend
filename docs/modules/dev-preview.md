# Web 交互式隔离开发预览

## 启动和反馈

Web 在 VPS 任务 Worktree 启动，Backend 预览提供真实内容的隔离副本；业务 API 和 Foundation 不变。依赖私有开发协议 Backend 提交 `f1a3db8675404d5a7d16d76693bea0fbe623e0f8` 的 `docs/dev-preview-session.md`，不依赖未提交源码。账号密码对应快照时点，浏览器固定访问同域 `/api/v1`。

先由 Backend `dev:preview start` 创建或恢复反馈批次并登记标准端口组，再将其 `consumer.json` 绝对路径传入：

```bash
pnpm dev:preview start --task <任务ID> --descriptor /absolute/path/consumer.json
pnpm dev:preview status --task <任务ID>
pnpm dev:preview stop --task <任务ID>
```

agent 使用治理仓库 Windows 预览入口建立 Backend、media、Web 相同端口的 SSH 转发，再打开返回的 `browserUrl`。HTTP Cookie 由隔离后端配置为本机可用，Web 不复制线上凭证。浏览器看到“开发预览”与北京时间快照时间；标识只传入非敏感元数据。

`start` 幂等复用同任务、同 Worktree、同 Backend runId 的活会话。需要数据重置时先停止 Web，由 Backend 显式 reset，然后用新描述重新启动；不会自动覆盖原数据。同一 Worktree 不允许另一任务接管。`stop` 只停止已登记并核验 PID、启动时刻、cwd 和独立进程组的本任务进程（包括 Next CLI 的 server 后代），不停止共用 Backend、不删除媒体和数据库，也不修改或重启线上服务。

## 地址与隔离边界

Next.js `next dev` 只监听 `127.0.0.1`，端口来自已核验描述，使用独立 `.next-preview` 和 `tsconfig.preview.json`。运行前拒绝占用冲突，禁止自动换端口；生产 `.next` 和一次性 E2E `.next-e2e` 各自独立。预览产物不可部署。

启动前分别核验 Backend/media 实际 `/__preview/identity` 的响应头和完整资源身份。浏览器 API 经服务端独立代理逐次重新核验两者，并要求浏览器携带初始 HTML 固化的 `X-Wenyou-Preview-Run`（缺失或不匹配返回 409，不替换为当前批次）；上游响应必须携带同 runId，重定向、断连、错身份均拒绝。没有线上 fallback。

`GET /__preview/identity` 只在预览模式路由到同一代理，重新核验上游后输出 Web、Backend、media 的绑定身份。治理入口用该路由检查实际 Next rewrites；单纯检查启动环境变量不能代替它。

媒体预签名 URL 不改写，不额外注入签名头。每次 PUT 前通过 Web 身份端点核验媒体；预览 CSP 的 `connect-src` 仅允许本会话媒体和同域，历史线上媒体只允许图片读取，不能用旧上传 URL 写入。新图片、头像、封面和编辑器沿用现有上传与处理链路，隔离存储和历史只读缓存由 Backend 管理。

## 工具输出与源码证据

治理可以直接调用 `node scripts/dev-preview.mjs start|status|stop --task ID [--descriptor /absolute/consumer.json] --json`，stdout 为一行 JSON，错误输出 stderr 并返回非零。ready 结果包含 `kind: wenyou-web-preview`、`status`、`task`、`worktree`、`sessionId`、`runId`、`descriptor`、`browserUrl`、`ports: { backend, media, web }`、`snapshot`、`sourceCommit`、`sourceDigest`、`startedSource`、`protocolSha` 和私有日志路径。非 ready 状态不提供可用浏览器地址；未登记时仅输出 absent、任务和 Worktree。

源码摘要覆盖已跟踪与未忽略新增文件的实际内容及删除状态。每轮验收调用 status 记录新摘要，不能以第一次启动 SHA 代表后续 Fast Refresh 画面。私有进程登记和日志位于忽略目录 `.dev-preview`，权限为当前用户可读写，不能提交。

## 验证和交付

样式反馈先检查实际画面和相关组件，连续三轮可使用同一浏览器页面观察 Fast Refresh，不运行生产构建和部署。画面须覆盖受影响的明暗主题和窄视口；本项目仍为 PC Web，不新增移动版布局。

`pnpm test:preview` 覆盖描述、配置、线上端口拒绝、真实代理链路和运行身份切换；组件测试覆盖上传目标与 CSP。`pnpm test:preview:live` 使用本进程内存模拟服务启动真实 Next dev 和 Chromium，连续三轮验证状态保留，并覆盖端口冲突、任务归属、身份断连及 supervisor 异常退出后的精确清理；该探针不能在已有预览登记的 Worktree 执行。交付前执行 `pnpm check`，高风险认证旅程执行隔离 `pnpm check:full`。Fast Refresh 模拟服务探针与真实快照登录/上传验收分别记录，不能将模拟探针当成真实数据验收。生产上线仍须 PR、负责人合并和单独部署授权。


真实交互预览可使用 `pnpm test:preview:api /absolute/consumer.json /absolute/fixture-credentials.json task-id` 进行浏览器验收。账号文件须为 VPS 当前用户所有、权限 0600 的 `{ "account": "...", "password": "..." }` JSON，使用快照内预先准备的隔离样例账号；命令不打印凭据。先验证消费者与运行身份，再验证实际登录、HttpOnly 刷新、头像裁剪、双画幅主页背景、删除与正文编辑器上传。只允许当前 Web API 和隔离媒体写入，历史媒体仅 GET/HEAD。报告与图片保存在 `.dev-preview` 私有目录，批次中的样例草稿随 Backend 最终 cleanup 回收，不能把“保留反馈数据”误报为一次性 E2E 已清理。


## 单个运行批次管理协议

治理控制器使用 `node scripts/dev-preview.mjs list --json` 读取本仓库 Git 登记的所有 Worktree（包含历史动态端口会话），返回 `{version:1, kind:"wenyou-web-preview-list", sessions:[{task, worktree, sessionId, runId, state, processAlive, blocked, ports:{backend,media,web}}]}`。不启动服务，不删除历史记录。`processAlive` 仅在 PID、启动时钟、进程组、session 与 Worktree 均匹配时为 true；登记损坏或 PID 仍活而归属不符输出 `state:"ownership-conflict", blocked:true`，控制器必须停止切换。

生命周期操作由同 UID 全局 Web 锁串行化。`start` 发现其他 Worktree 的活会话或归属冲突时拒绝，输出归属；不得静默停止其他任务。治理切换先对 list 的精确归属执行 `node scripts/dev-preview.mjs pause --task <owner-task> --worktree <owner-worktree> --confirm <runId> --json`（使用新版控制器，无需执行或修改旧目标脚本），锁内核验 runId 不变后才停止。`pause` 是 stop 的别名，均保留描述、批次数据和源码。原 `status|stop --task ID` 入口保留兼容；自动化一律传 `--confirm`。

标准端口组为 Web `127.0.0.1:4310`、Backend `127.0.0.1:4311`、媒体 `127.0.0.1:4312`；新会话只接受该端口组。历史动态端口仍可被 list/status/stop 识别，先暂停再按 Backend 的显式 rebind 协议迁移。

旧 Web 代码尚未具备文档固定身份与请求核验时，控制器可以只读列出、核验、暂停，但不会直接恢复旧代码。由原任务消费本次已提交的安全实现后，再用其自身 `start` 入口恢复；不得为恢复修改其他任务现场。


浏览器初始 HTML 固化只读批次身份。Fast Refresh、路由导航与新 bundle 不能将旧文档升级为新批次；普通 API、登录、刷新与管理员 API 均携带固定身份。代理在转发前精确核验，上游仍要求同 runId。请求和响应错批次时阻止旧操作，并卸载认证与 QueryClient 应用树，显示重新载入提示。每次上传也用同一文档身份核验实际媒体，签名 URL 原样发送；后端切换后的旧签名不能写入新批次。

认证标记、管理员跨页事件、动态草稿 IndexedDB、动态返回位置、验证码冷却均以 runId 分区；恢复同一批次保留草稿，新批次不继承。登录凭证仍仅内存/HttpOnly Cookie，后端各批次独立签名密钥拒绝其他批次 Cookie。查询缓存仅驻留文档内存，预览响应禁止 HTTP 缓存。主题与省流偏好可共用，因为它们不含业务身份或待提交内容。

同一 Backend runId 内切换 Web 任务或暂停恢复，也会生成新的 Web 启动身份。HTML 同时固化 `webSessionId`，API 须带 `X-Wenyou-Preview-Web`；代理精确验证并在响应及 identity 头回传，转发到 Backend 前删除该 Web 私有头。旧文档必须重新载入，不能借相同 runId 继续操作新 Web 会话。

`build/check/check:full` 与直接调用隔离 E2E runner 均使用跨仓重任务锁。独立工具 `scripts/dev-heavy.mjs` 来自已提交 Backend `f1a3db8675404d5a7d16d76693bea0fbe623e0f8`，以固定 UID 状态目录、内核 flock、boot ID 与真实祖先关系验证嵌套调用。其他构建或 E2E 运行时明确返回忙碌，不并发争用服务器。工具内嵌于本仓库，运行时无需其他源码路径。

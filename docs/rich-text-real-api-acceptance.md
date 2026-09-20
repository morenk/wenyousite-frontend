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
- 正常、失败和超时由消费者关闭子进程，后端 runner 核验并回收登记资源。消费者仅在用例通过、后端输出同轮清理成功且目录消失时报告通过。后端失败退出但留下本轮目录时，Web 仅调用该后端的正式 `e2e-reap` 入口核验回收，并在报告记录 `residualCleanup`；回收成功也不把原失败改为通过。SIGKILL 残留由后端下一轮启动时按登记核验回收，不能扫描或接管其他任务资源。
- 交付必须连续两轮完整 E2E 使用不同 runId，并确认每轮资源归零。清理失败、身份漂移或生命周期验收缺口不得当作成功交付，详情以 PR 验证记录为准。

## 护栏与线上只读验收

```bash
pnpm test scripts/e2e-isolation-gate.test.ts scripts/e2e-fixture-boundary.test.ts scripts/e2e-candidate-policy.test.ts scripts/readonly-smoke-policy.test.ts
pnpm test:e2e:guards
pnpm test:smoke:readonly
```

`test:e2e:guards` 在本机临时服务核对拒绝公网、线上 loopback 和缺少身份等场景，验证写入、重定向和会话均未到达服务端；不连接业务数据库。`test:smoke:readonly` 仅匿名检查线上健康、登录页和公开阅读，不记录密码、Token、Cookie、内容正文或 trace，不允许业务写入。普通阅读产生的服务端日志和阅读统计不属于测试业务写入。

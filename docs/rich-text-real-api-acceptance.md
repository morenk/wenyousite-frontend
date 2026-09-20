# 富文本真实 API 验收

## 当前入口边界

`bash scripts/test-rich-text-real-api.sh` 与完整 Playwright 入口当前失败关闭，等待后端已提交的隔离 runner 接口接入。历史固定候选与外部专用账号验收方式已停用，不能通过 `BACKEND_URL`、`E2E_ENV=test`、外部账号或本机端口恢复写入；预检在读取账号、构建和访问网络之前拒绝执行。

[真实 API 用例](../e2e/s5/rich-text-real-api.spec.ts) 统一继承[隔离 fixture](../e2e/fixtures/isolation.ts)。入口恢复必须使用本轮登记资源生成的账号，并验证隔离资源身份与实际候选 `/api/v1` 代理；启动环境变量和后端 Git SHA 本身不足以证明隔离。不得保留“失败草稿留在共享数据库”的行为。

## 构建与清理要求

- 生产构建保留 `.next`；隔离候选使用 `.next-e2e` 及 `e2e-` Build ID，部署脚本拒绝测试产物。
- [候选构建校验](../scripts/e2e-candidate-policy.mjs) 检查已生成的 rewrites，拒绝启动配置正确、实际构建代理错误的情况。
- 隔离 runner 接入时必须登记 runId、进程及数据库、缓存、媒体资源；成功、失败、超时均清理，强杀后只回收登记且确认失活的残留，清理失败不能报告通过。
- 接入后需连续两轮完整真实 E2E，并核对两轮资源均归零。当前尚未执行，不作为已通过证据。

## 已可运行的护栏验证

```bash
pnpm test scripts/e2e-fixture-boundary.test.ts scripts/e2e-candidate-policy.test.ts scripts/readonly-smoke-policy.test.ts
pnpm test:e2e:guards
pnpm test:smoke:readonly
```

`test:e2e:guards` 在本机临时测试服务核对拒绝公网、线上 loopback 和缺少身份等场景，验证写入、重定向和会话均未到达服务端；不连接业务数据库。`test:smoke:readonly` 仅匿名检查线上健康、登录页和公开阅读，不记录密码、Token、Cookie、内容正文或浏览器 trace，不允许业务写入。普通阅读产生的服务端日志和阅读统计不属于测试业务写入。

# 编辑器双对齐按钮候选验收

## 目标与范围

Web 宽栏和窄栏更多托盘均只提供居中、右对齐。默认居左与混合选区均不选中；点击目标应用，再次点击当前目标恢复居左，两个目标可以直接互切。只在交互命令增加 toggle，直接设置命令仍保持幂等。Markdown v4/v5、合格顶层块、独立图片、列表/引用清理、保存标记与撤销重做边界不变。

共享样式与图标来自正式 Foundation `v7.2.1`（`c7729bc9e28c608c6c3a76cdc088e3c5b6a5a663`）；本次同步锁文件与 Web 校验，没有引入新 Token 或未发布代码。该版本的旧三态入口说明由治理协调独立文档修订，本需求以用户明确的新交互为准。

## 组件与浏览器证据

- 定向 Vitest 覆盖 `editor-alignment-compatibility`、`milkdown-editor-toolbar`、`editor-more-menu`、`milkdown-toolbar`。覆盖双按钮反选、直接互切、混合选择、v4/v5、图片、列表/引用、内联原子和撤销重做。
- Chromium 使用本任务真实 Milkdown 组件，输入合成文字；仅内存 meta fixture，无数据库、账号或业务保存。实际检查双目标反选、直接互切、混合选区未选/统一/再次取消、撤销重做、更多菜单两项目标反选与明暗主题，未发生 page error。
- 额外 `390 × 844` 视口检查：工具栏 `clientWidth = scrollWidth = 292px`；菜单 `x = 8px`、宽 `320px`、高 `102px`，未溢出视口，右对齐反选可达。截图 `web-alignment-390-light.png` 同目录留存。
- 宽视口 `1366 × 900`，组件宿主 `880px`；窄视口 `900 × 800`，组件宿主 `520px`。截图 `web-alignment-wide-light.png`、`web-alignment-wide-dark.png`、`web-alignment-narrow-light.png`、`web-alignment-narrow-dark.png` 留在本任务 `.dev-preview`，并交治理展示。
- 组件批次 `web-alignment-component`，runId `preview_d19a9e4834875cc6c769c32f`；截屏时源码基线 `2f110c0a3e2c3289c7157f72f3a2f18242a91e46`，含临时 fixture 的源码摘要 `6c22bffb5725b4dd0f8f2bce4716f47294acceb0ba4d5416c6c5e8c25525a653`。临时页面不进入产品提交。

## 隔离与交付边界

这些是合成数据组件候选，不是当天真实数据或线上验收。首次预览检查没有可用的当天真实快照，未启用管理导出、未接管其他任务批次、未连接线上业务。真实账号页面与当天快照数据保存尚未覆盖；下述正式 E2E 使用独立新建数据资源和合成账号，不能替代当天真实快照预览。负责人已确认本轮视觉候选并要求交付候选；是否合并仍由负责人决定。

## 完整门禁阻塞

`pnpm check` 在首步 `pnpm security:audit` 失败：既有 Next.js `16.3.3` 命中 critical [GHSA-vcvr-r3jv-pc5j](https://github.com/advisories/GHSA-vcvr-r3jv-pc5j)（`next/og` 的 `ImageResponse`，审计列出的最低修复版 `16.3.6`）。`origin/dev` 的 package 与 lock 同样固定此 Next 版本和依赖关系；本任务 package/lock 差异只有 Foundation。未关闭审计、未放宽门禁，也未混入独立安全升级。

本分支只交付 Draft PR，不可据此宣称完整门禁通过或可合并。按仓库“无关既有失败提供定向等价验证并明确记录”的规则，继续逐项执行其余门禁并在下文登记；安全依赖修复需单独目标处理。

## 已完成检查

- `pnpm test:preview`：3 项通过。
- `pnpm lint`、`pnpm typecheck`、`pnpm contract:check`、`pnpm arch:check`、`pnpm design:check`：全部通过；Foundation 固定版本校验通过。
- `pnpm test:coverage`：335 个测试文件、3610 项用例通过，既有覆盖率门槛通过。总 statements 86.17%、branches 78.34%、functions 83.99%、lines 89.90%。
- `pnpm test:deploy-preflight`、`pnpm docs:check`：通过；232 项 OpenAPI 操作与 202 项前端调用文档一致。
- `pnpm build`：通过，构建字体检查通过；不部署构建产物。
- 定向 Chromium 组件及 390px 补查：通过，实际图片已交负责人确认。

上述分项结果不等同于 `pnpm check` 整体通过，首步安全审计失败保留。

## 正式隔离 E2E

Backend runner 固定提交 `21acf512285f2a21aaa831f960211780de73aafc`，未修改 Backend。通过仓库 `pnpm test:e2e` 正式入口使用独立 PostgreSQL、Redis、上传目录、随机账号和候选 `.next-e2e`；前后端代理与运行身份由入口在登录前核验。未连接线上服务。

首轮命令为 `pnpm test:e2e e2e/editor-alignment-compatibility.spec.ts e2e/editor-dice.spec.ts`；两项复验追加 `--grep "宽窄 PC|编辑器格式"`，只对首轮失败项及其中因失败尚未执行的后续步骤重跑。执行环境固定以下只读配置：

```bash
WENYOUSITE_E2E_BACKEND_ROOT=/srv/wenyousite/wenyousite-backend
WENYOUSITE_E2E_BACKEND_REF=21acf512285f2a21aaa831f960211780de73aafc
E2E_PG_BIN=/opt/wenyousite/e2e-tools/usr/lib/postgresql/16/bin
E2E_REDIS_BIN=/opt/wenyousite/e2e-tools/usr/bin/redis-server
E2E_LIBRARY_PATH=/opt/wenyousite/e2e-tools/usr/lib/x86_64-linux-gnu
```

| runId | 正式结果 | 说明 | resourcesRemoved / cleanupVerified |
| --- | --- | --- | --- |
| `e2e_4ea7b68784f4e72b72bd4e67` | failed，15/17 通过 | 旧菜单总数断言与旧三按钮截图失败 | true / false |
| `e2e_09932f6eef74c854a230c24a` | failed，1/2 通过 | 明确断言两项对齐、五个菜单控件后，宽窄路径通过；旧截图仍失败 | true / false |
| `e2e_6826ac91f54152c5f8cbd5cb` | failed，0/1 通过 | 仅菜单综合用例重跑，临时保留菜单 actual 图片用于目视比对，旧截图失败 | true / false |
| `e2e_234237acd87e7b2d69f10389` | passed，2/2 通过 | 确认旧左选中三按钮变为双未选两按钮后，更新唯一截图基线；两项最终完整复验通过 | true / true |

最终候选 ID 为 `eaf65ba0-4494-4cf4-9d1c-b28fe96e8fde`，构建 ID 为 `e2e-eaf65ba0-4494-4cf4-9d1c-b28fe96e8fde`。合计 17 个目标用例已覆盖：首轮其余 15 项通过，最终两项通过；不是一次 17/17 全绿运行。更多菜单居中/右对齐反选及后续编辑步骤均在最终完整用例通过。没有放宽截图容差；临时留图语句已移除，正式 runner 未修改。

失败报告原样留存：前三轮不满足 runner 的完整清理验收，因此正式状态与 `cleanupVerified=false` 保留。代码核对发现 Backend 仅在消费者及正常停机全部通过后发 `passed`；Web 的完整清理判定还要求该事件。独立只读观察：首轮 `/tmp/wenyousite-e2e-EBf7bw` 与第二轮 `/tmp/wenyousite-e2e-ar39oc` 均已不存在，首轮 API 端口 41535 无监听；四轮登记均已注销，进程列表无对应 runId，所有正式报告均为 `resourcesRemoved=true`。未执行额外删除或操作共享数据源。最后一轮正式 `resourcesCleaned=true`、`cleanupVerified=true`。

原始脱敏报告保存在本任务 `.e2e-results`；额外只读清理观察保存在 `.dev-preview/e2e-cleanup-evidence.json`。这些本地运行产物不提交；本节记录稳定验收证据，不作为当前运行状态。

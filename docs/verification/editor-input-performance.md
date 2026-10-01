# Web 编辑器输入性能验收

普通文档编码合并到停止输入 120ms 后，持续输入最长 500ms 同步。中文组词暂停编码和自动保存；保存、校验、关闭和恢复读取最新正文。Milkdown、Markdown 协议和 Foundation v7.2.1 保持不变。

## 浏览器对比

基线为 `37785f9443b617731e6d14c109d2f065f1fa6a8d`，下表候选为本 PR 最终源码与安全补丁依赖（Next.js 16.3.6、DOMPurify 3.4.16）；基线分别为 16.3.3、3.4.14。固定同一 VPS、Chromium 151.0.7922.34、1440×1000 视口与独立 production 构建；16 组各运行 3 轮。每轮输入 78 个 ASCII 按键，键间设置 20ms，包含最后 1000ms 的同步和自动保存等待。混排包含正文、图片、表情、提及、引用与骰子。基线与候选之间 VPS 曾重启，共享宿主负载仍是噪声来源；浏览器、视口与测量脚本保持一致。安全补丁升级前的同依赖优化对照也保存在 JSON 的 `preSecurityPatchCandidate` 中，避免将全部差值归因于单一改动。

表内 P95 为三轮 P95 的中位数，长任务是三轮总数。完整逐轮帧间隔、最大值、事件数量及长任务耗时见 [原始脱敏数据](editor-input-performance.json)。

| 正文 | 自动保存 | CPU 降速 | 按键→下一 rAF P95 / ms | 已观测 Event Timing P95 / ms | 长任务次数 |
| --- | --- | --- | --- | --- | --- |
| 200 纯文 | 关 | 1x | 16.9 → 16.4 | 24 → 24 | 0 → 0 |
| 200 纯文 | 开 | 1x | 16.8 → 16.6 | 24 → 24 | 0 → 0 |
| 2000 纯文 | 关 | 1x | 16.6 → 16.6 | 24 → 24 | 0 → 0 |
| 2000 纯文 | 开 | 1x | 15.8 → 16.3 | 24 → 24 | 0 → 0 |
| 9000 纯文 | 关 | 1x | 23.3 → 16.9 | 32 → 24 | 1 → 0 |
| 9000 纯文 | 开 | 1x | 21.3 → 16.1 | 24 → 24 | 0 → 0 |
| 8000 混排 | 关 | 1x | 20.0 → 16.3 | 24 → 24 | 0 → 0 |
| 8000 混排 | 开 | 1x | 21.1 → 16.7 | 24 → 24 | 0 → 0 |
| 200 纯文 | 关 | 4x | 47.0 → 31.9 | 64 → 40 | 15 → 4 |
| 200 纯文 | 开 | 4x | 43.8 → 31.6 | 56 → 40 | 31 → 2 |
| 2000 纯文 | 关 | 4x | 48.2 → 26.2 | 64 → 40 | 10 → 2 |
| 2000 纯文 | 开 | 4x | 56.9 → 29.4 | 72 → 40 | 21 → 4 |
| 9000 纯文 | 关 | 4x | 85.4 → 28.6 | 96 → 40 | 172 → 3 |
| 9000 纯文 | 开 | 4x | 80.8 → 29.5 | 88 → 40 | 146 → 4 |
| 8000 混排 | 关 | 4x | 106.3 → 30.3 | 128 → 40 | 218 → 5 |
| 8000 混排 | 开 | 4x | 110.7 → 29.6 | 120 → 40 | 193 → 4 |

`keydown→rAF` 是绘制前代理指标，不能称为实际像素呈现延迟。Event Timing 只报告 ≥16ms 的事件，表内是已观测样本的分位数；没有把缺失事件当作 0ms。正常 CPU 的基线场景已低于 50ms，最终候选三轮各场景已观测 Event Timing P95 均不超过 24ms，符合“基线已达标则维持”的分支。4x CPU 的 9000 字 P95 中位数从 88–96ms 降至 40ms（降低约 55%–58%），混排从 120–128ms 降至 40ms（降低约 67%–69%）；长任务明显减少。此计时不代表原生中文输入法的端到端 P95，也不替代人工体感。

## 编码微基准

Node/happy-dom 单 worker；只模拟定时器，`performance.now()` 保持真实时钟。每个长度独立 3 轮，完整编码热身 5 次后测量 30 次；输入合并使用 78 次实际 ProseMirror 文档事务及最后一次显式 flush。基线源码由 VPS 本机 `git archive` 从已提交基线导出，使用同一测试工具及依赖，测量后已移除临时源码夹具。

| 正文字数 | 完整编码 P95 中位数 / ms | 输入批次序列化次数 | 输入批次序列化累计耗时中位数 / ms |
| --- | --- | --- | --- |
| 200 | 0.45 → 0.45 | 79 → 4 | 20.60 → 1.03 |
| 2000 | 0.47 → 0.65 | 79 → 4 | 11.74 → 1.00 |
| 9000 | 1.56 → 1.76 | 79 → 4 | 25.79 → 1.63 |

直接编码算法未更换，主要收益来自把 79 次全文序列化降为 4 次（减少约 95%），以及将父组件、字数和草稿状态更新移出逐键路径。微基准只衡量编码与调度，不等同于浏览器交互延迟。

## 回归与隔离证据

- 基线：`e2e_8fa5c804a0d99d34019ddf05`，16 项通过；同依赖优化对照：`e2e_2302931060a8c1db42885dad`，18 项通过；最终完整候选：`e2e_941f3919ab475acb6f7ac892`，206 项通过、4 条既有跳过。三轮运行均 `cleanupVerified=true`、`resourcesRemoved=true`、`residualCleanup=false`。
- 基线与同依赖优化对照使用 Backend `21acf512285f2a21aaa831f960211780de73aafc`，最终完整候选固定 `6eb742502feed44df822b964b451349919b65073`；统一 fixture 在登录和写入前核验 manifest、PG/Redis 进程归属、上传路径、后端身份及实际候选代理。计时用合成正文和本轮路由 fixture，不使用线上账号或数据写入。
- 新增浏览器回归覆盖最后一字后立即保存、CDP 组词期间阻止保存以及结束后的最终文字。CDP 合成事件仅为补充，不能替代原生输入法。
- 定向回归覆盖连续输入上限、选区/重复 flush 缓存、长按删除、撤销回原文、故障恢复、草稿队列与晚到响应、账号变化、确认期间继续编辑、超长正文删回合法长度、媒体属性及事务映射、Context 订阅范围。
- 原有换行、空白、格式、对齐、复制粘贴和媒体身份断言保持；旧即时 `onChange` 测试调整为显式 flush 或等待合并快照，没有降低契约期望。
- 交互预览会话 `web-editor-input-perf` / `preview_745307cb71492305c0308e8c`，使用当日已校验的隔离快照。用户在中文选词与连续输入体验提示后反馈“验收通过”；未另行录制原生输入法分项计时。
- Auto-review 默认偏好已传递，但协作工具没有审批配置参数及实际运行配置核验入口，实际 Auto-review 未设置／未核验，不能把当前会话权限模式视为 Auto-review 已启用。

## 依赖审计修复

完整门禁首次在依赖审计失败：Next.js 16.3.3 命中 [GHSA-vcvr-r3jv-pc5j](https://github.com/vercel/next.js/security/advisories/GHSA-vcvr-r3jv-pc5j)，Milkdown 间接依赖 DOMPurify 3.4.14 命中 [GHSA-p98j-92pf-mc4p](https://github.com/cure53/DOMPurify/security/advisories/GHSA-p98j-92pf-mc4p)。本次将 Next.js 与 eslint-config-next 升至最低修复版 16.3.6，并将现有 DOMPurify override 升至 3.4.16，没有改变 Milkdown 或 Foundation 版本。

Next.js 字体度量补丁内容和 SHA-256 保持不变，仅迁移版本引用；应用成功且 12 项系统字体测试通过。修复后的生产依赖审计无已知漏洞。最终依赖的浏览器复测与完整检查全部通过，主表使用该最终候选数据。

## 复现入口与最终门禁

使用 [浏览器场景](../../e2e/editor-input-performance.spec.ts)，由已配置隔离二进制和 Backend 固定 SHA 的 `pnpm test:e2e e2e/editor-input-performance.spec.ts --max-failures 1` 运行。禁止直接复用线上或旧候选。

编码微基准：`EDITOR_BENCHMARK_OUTPUT=/absolute/private/output pnpm exec vitest run --config scripts/editor-input-benchmark.config.ts --maxWorkers=1`，配置与测量代码位于 [微基准配置](../../scripts/editor-input-benchmark.config.ts) 和 [测量脚本](../../scripts/editor-input-benchmark.bench.ts)。

构建期契约固定 `WENYOUSITE_BACKEND_ROOT=/srv/wenyousite/wenyousite-backend`、`BACKEND_CONTRACT_REF=4db0cdf2c079fc8b66545c67849053cd74945f8a`，与当前 Web 的已提交 OpenAPI 逐字节一致。相邻 Backend checkout 停留在旧版本时，默认 workspace 比较会失败；使用仓库已有的精确提交入口，不修改或跳过契约检查。

最终 `pnpm check:full`（含 `pnpm check`）通过；最终完整门禁使用已安装 Vitest 支持的 `VITEST_MAX_WORKERS=2`，保持全部测试与覆盖率门槛；不限制进程 CPU affinity，使最终浏览器采样使用与基线一致的正常 CPU 配置。

完整覆盖率首轮 337 个文件中 336 个通过，3,673 项中 3,670 项通过；同一个表单故障回归文件的三条断言仍按逐键同步编码等待，调整为等待实际失败或恢复状态后，该文件 12 项全部通过。保留真实故障注入、禁止旧正文写入与最终正文断言，并新增能力刷新时的实例及内容保留校验。该轮未进入浏览器 E2E，最终全量结果另行记录。

发布兼容性核查发现线上 Backend 尚未包含 Web 基线已有的私帖邀请 PUT。用户已授权先验证并部署兼容 Backend `6eb742502feed44df822b964b451349919b65073`；本轮对该提交的 `pnpm check` 通过（184 suites、2,453 tests），主 checkout 干净。浏览器完整隔离入口改为固定该提交；先前性能基准的 Backend `21acf512285f2a21aaa831f960211780de73aafc` 身份继续保留，不混称同一次运行。线上切换另受 Backend 生产依赖审计门禁约束。

首轮完整浏览器运行 `e2e_dd03fceef770de3218e88740` 共 210 项（204 通过、4 条既有跳过、2 失败）。一项取证失败来自 Next 补丁改名未暂存，Git 文件清单仍指向已删除旧路径；已暂存 100% 原样改名。一项揭示删除最后子贴后的退出判断误读已卸载设置页闭包，修复为按当前页签核对，并补充空子贴与成员页退出回归。该失败轮 `resourcesRemoved=true`、`cleanupVerified=false`，保留原始失败状态，不冒称完整验收通过。

最终完整检查：337 个测试文件、3,675 项单元测试全部通过；覆盖率 lines 90.13%、statements 86.41%、functions 84.27%、branches 78.72%。生产依赖审计为 0 漏洞，lint、类型、架构、契约、Foundation、文档、部署预检与 production build 全部通过。regular build ID 为 `vXsbES3bhGufDz14JkRz7`。

最终隔离浏览器运行 `e2e_941f3919ab475acb6f7ac892` 的 candidate/build ID 为 `66428cb9-2751-4f37-a33e-55f25be03112` / `e2e-66428cb9-2751-4f37-a33e-55f25be03112`，210 项中 206 通过、4 条既有跳过。跳过项仅为 `discussion-target-pages.spec.ts` 中依赖指定历史帖坐标的四条场景；没有新增跳过或降低断言。最终报告为 `.e2e-results/b2e6836c-7714-481e-8ed4-31c17b28e817.json`，资源已移除且清理核验通过。

Backend 发布审计在已授权提交 `6eb742502feed44df822b964b451349919b65073` 上仍未通过（12 高、7 中、1 低）。部署脚本强制要求审计通过；截至本次 PR 证据归档，Backend 与 Web 均未切换线上。新增 Backend 依赖修复需要扩展发布范围，不能将用户验收 Web 视为绕过后端门禁的授权。

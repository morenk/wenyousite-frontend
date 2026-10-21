# 正文字体：连续浏览与静默恢复验收

## 28 款目录与慢网修正（2026-10-22）

本批继续同一 PR #83，消费 Backend `f27898ec3b168b9e027b5d5abef43a0d3dafa242`、API `5.42.0-dev.20261022.1`、目录 1.2.0。manifest 为 `e2836703a30eec5f59dd9d4d72f6887756c2dd30c070606db5cee258ebd0efa3`，4,941,141 字节；Foundation 仍为 v7.6.0。当前产品改为 28 款，历史小城内容保源并默认回退；下文 29 款记录仅为前一候选的历史证据。

慢链路复现证据 `continuous-original-slow-before.json` 与 `continuous-subset-slow-before.json` 保留。前者 512 KiB/s 的小城原件两次约 15 秒中断，第二次距首次约 60 秒；后者 48 KiB/s 的龙藏分片两次约 15 秒中断。两者均为独立真实 HTTP 限速代理，未直接观测负责人原标签页，不能用新页成功否认原反馈。

新策略只在通过长度检查的非空正文数据到达时续期 15 秒，独立 10 分钟总截止；单调截止在 chunk／EOF 回调前检查。后台取消需求及 reader，回前台恢复不改选区、不退还已开始请求的完整预算。元数据 HTTP 错误在响应头分类；64 KiB 上限、SHA／MIME、并发与普通窗口不变。旧 v1 原件回归快照独立保留，仅用于兼容测试。

本批浏览器证据（1440×900，合成数据，无真实业务上游）：

- `continuous28-subset-slow-after.json`：龙藏 core 1,548,272 字节，以实际 HTTP 48 KiB/s 连续传输 31.563 秒，一次完成；CDP 确认 23 个自定义字形。SW 虚拟 URL 的完成后 abort 事件不作为失败判据，底层 HTTP 已完整发送并成功注册。
- `continuous28-subset-stall.json`：首轮发送 69,420 字节后停流，最后数据后约 15.006 秒取消，随后静默重试并完成，同页约 50 秒显示真实字形。生产流读取器另外逐项消费 14 个共享轨迹，覆盖超时边界、10 分钟总限、排队、取消、空块与 64 KiB 上限；窗口回归确认失败／取消不退额。
- `continuous28-stress-evidence.json`：同一 SPA 七轮 196 次阅读，28 款逐次实际字形通过；首轮 107 个资源、28,307,707 描述符字节，后六轮新增资源请求为零。注册 222、注销 194 次，峰值 28 face，普通 SFNT 峰值 16,038,356 字节，原件为零。
- 浏览器及子进程 RSS 求和开始／峰值／结束为 554,440／707,596／579,440 KiB；GC 后 JS 堆为 14,812,036／37,192,020／37,192,020 字节，末次 1 document／772 nodes。RSS 不是字体独占内存或设备安全上限。
- 原 `38875 → 31329 → 34329` 预览已切换为目录 1.2.0；Next PID 267586 保持运行，合成 API PID 469719。替换前导出并在恢复后逐项核对 32 会话、648 篇正文、0 草稿，无内容差异；旧会话保留原内容，新连续预览使用 28 项。`current28-preview-mapping.json` 记录 fixture SHA、manifest 与端口映射。独立 31339 限速与压力证据也使用相同 Next 源码及新契约，采集后临时 31339／34339 服务已关闭。
- `current28-preview-evidence.json`：原地址再顺序浏览全部 28 款并确认实际字形，历史小城正文严格保留“历史正文 ABC 中文”，计算字体为 `system-ui, sans-serif`，无小城字库请求；代表截图 `current28-preview-forward.png` 与 `current28-retired.png`。

本批第一次全量检查在新增历史小城共享语料上发现两条旧测试固定断言“文楷”；记录失败后终止该轮，改为逐项核对输入声明的字体 ID，原有逐字／全部 marks 和幂等断言保留。对应 280 项真实 Milkdown 回归通过，再对稳定源码重新运行完整门禁。

### 本批交付门禁与源码对应

稳定生产源码的 `pnpm check` 全部通过：433 文件／5,855 项测试，覆盖率 statements 88.11%、branches 81.46%、functions 86.72%、lines 91.80%；安全审计、lint、类型、架构、设计、契约、文档、发布源防护与 production build 均通过，构建字体扫描 3,348 文件通过。完整日志为 `/tmp/web-font-28-check-final.log`。

第一次正式隔离字体／颜色 E2E 中颜色通过，字体用例仍试图新建已退役的小城内容，后端按新契约返回 409，故该轮失败。报告 `c66023cb-d599-4d3b-bcbf-12dfdaaabdc0.json`、runId `e2e_4b0f7b8f7ca833a60ddb9ee5` 保留；`resourcesRemoved` 和 `cleanupEventVerified` 为 true，无残留。该失败报告的 `cleanupVerified=false` 是 runner 要求测试通过事件的联合结果，不等于资源清理失败。修正用例为显式断言小城新写 409／40020，再用仍有效的龙藏覆盖原保存、复制、编辑及草稿旅程；额外核对选择器仅有 28 款加系统默认、没有小城选项，没有降低成功路径断言。

正式隔离候选重跑字体与颜色 E2E **2/2 通过**：runId `e2e_b7dd526bae33c5e32e5f5942`，candidateId `bed7d170-d88c-47b6-b28b-e5e3393e10af`，报告 `5825826e-4704-4a9e-a8b3-cb9e4b86b92d.json`，Backend 固定为上述 `f27898e`。`resourcesRemoved`、`cleanupVerified`、`cleanupEventVerified` 全为 true。历史完整 E2E 的讨论导航基线失败与缺少只读样本输入仍独立保留，不宣称全量 E2E 全绿；PR 仍待负责人验收，未合并或部署。

浏览器采集基于 `99e343a` 加本批实现；630 份生产源文件摘要为 `bf9d37c6649514b9daaef448ccdd9483a7315fbd78d907ae5fff77e19a394d8b`，采集后生产源码未改。完整检查之后仅修正上述 E2E 用例和文档，另做该用例 lint、类型检查和正式隔离候选重跑；不重复生产构建。逐文件摘要、最终提交、完整检查日志、E2E 报告及绝对截图路径统一登记在任务 artifact 的 `thread-fonts/continuous28-delivery-evidence.json`。此前明暗／1024px 画面仅作未变化布局的历史参考，不能证明当前 28 款目录。

## 前一轮 29 款候选历史记录

本轮继续 PR #83、`codex/20261021-thread-fonts-web` 与同一任务 Worktree，替换 v2 消费者的历史累计截止策略。正文、剪贴板及 29 款资源不变；此前作用域、粘贴和跨端往返记录见 [29 款候选验收](thread-fonts-web-final.md)。本记录为待负责人验收的候选，不代表合并、部署或资源发布。

### 固定依赖与实现

Backend `d86734e5aa229c5401a092096b8845b3d17546b0`、API `5.42.0-dev.20261021.1`；独立 runtime-policy v2 JSON/schema/fixture 与 OpenAPI/types 从该提交同步。Foundation 保持 v7.6.0；manifest SHA `7aab91a436933049bc8f55c1aba6085078a251d174c5b253456d3af0c91a0582` 与全部字体资产不变。

同一文档共享窗口和分片引用；离屏延时释放、选区保留、无引用 LRU 实际注销 FontFace。普通 SFNT 驻留计入 16 MiB，原件独占 18,410,600 字节，活动至多 29 家族/64 face；不是累计家族次数。网络为单调时钟 60 秒滑动窗口、64 请求、普通 16 MiB、原件独立同额及 2 并行。元数据固定预占并流式限制 64 KiB，和资源共用账本。缓存仍独立 64 MiB LRU；成功与失败的二进制 Promise 均移除。

临时故障自动 full-jitter 退避并遵守 Retry-After；online、focus、visibilitychange 不重置账本。冷启动离线由共享网络层暂停请求，仅回前台也能重新检查连接。策略、目录与 manifest 冷启动失败均可在原页面恢复。损坏资产/解码失败按代次隔离，来源撤回使旧 face 失效；同时可见内容自身超出容量时保持已加载片并回退其余字符，释放引用后再尝试。

### 产品浏览器证据

普通 Next dev 仍使用 `/srv/wenyousite/.worktrees/web-thread-fonts`，`127.0.0.1:31329`，后端显式为 `http://127.0.0.1:34329`。后者只提供本任务内存合成数据与逐项校验的本地资产，没有真实后端上游。原 Next 进程 PID 267586 保持运行；当前合成 API PID 380895。治理 SSH 入口仍为 `http://127.0.0.1:38875/api/v1/preview?group=3&theme=dark`，连续浏览入口使用 `?scenario=continuous`。

证据位于本任务 artifact 的 `thread-fonts` 目录，视口 1440×900，真实产品页面、真实 FontFace/IndexedDB/CDP 字形检查；不是仅渲染测试组件。

- `continuous-stress-evidence.json`：同一 SPA 七轮正反交替、203 次页面阅读，逐次确认实际自定义字形及文档标记未改变。首轮 111 个资源请求、已校验描述符共 46,810,024 字节（普通 28,399,424，原件 18,410,600），超过旧请求/普通字节累计上限后仍推进；后六轮新增资源请求均为 0。
- 实际 FontFace 注册 226 次、注销 197 次，峰值 29 个；采样普通 SFNT 最大 16,689,196 字节，原件最大 18,410,600。生命周期单测另外覆盖同时可见预算不足、同片多引用、策略收紧、跨 manifest 保留窗口，以及解压大小补预留。
- Linux 浏览器及其子进程 RSS 求和：开始 538,960 KiB、观测峰值 875,860 KiB、末次 669,768 KiB；七轮末次依次 759,684 / 793,580 / 845,768 / 843,220 / 835,676 / 822,828 / 669,768 KiB。该值包含整个 Next dev 产品页面与浏览器开销，且共享页可能重复计入，并非字体独占内存或设备安全上限。
- GC 后 JS 堆开始 14,881,972 字节、峰值 37,550,364、末次 37,335,172；末次 1 document / 772 DOM nodes。不得将资产字节、SFNT 预算或 JS 堆当作 RSS，也不承诺 `document.fonts.delete` 立即归还原生内存。
- `continuous-recovery-evidence.json`：字体冷启动目录/策略同时 503、仅策略 503、manifest 503、字库 503 四类，原页面恢复、正文不变、无下载或重试 UI。生产 QueryClient → apiClient → 可见正文 hook → 实际运行时回归另覆盖初始离屏零元数据、离线进入排队、仅 online/visibility 事件恢复、重复事件去重及最后引用退出取消排队。
- `continuous-product-boundary-evidence.json`：缺字先后顺序及假名分片失败保留 ABC 已加载字体；列表、主题搜索、楼层搜索冷缓存无字体标记及字库请求。
- `continuous-product-silent-evidence.json`：ABC 选区及 270px 阅读锚点不变，自动切换仅补偿 2px 滚动；长页 `continuous-eviction-scroll-evidence.json` 在同一文档浏览 29 款、触发 20 次淘汰，选区不变，锚点最大偏移 0.703125px。

开发期间一轮压力测试因源码热更新导致文档标记改变而终止，未计入上述七轮通过结果。列表验收脚本原来等待旧 `/threads` 列表地址，修正为实际首页后重新验收，未修改产品行为或放宽零请求断言。

### 门禁与边界

`pnpm check` 完整通过：431 文件 / 5,818 测试，覆盖率 statements 88.06%、branches 81.42%、functions 86.72%、lines 91.79%，以及安全审计、lint、类型、契约、架构、设计、发布源防护、文档和 production build。首轮仅两份同步测试的四项夹具缺失失败，补齐三份 v2 文件后定向与全量均通过，未降低断言。

全量覆盖率完成后复核发现 HTML 格式网关 502/503 会被 JSON 解析误判为永久失败，新增 HTTP 状态优先分类并补一项回归；最终增量 6 项测试、lint、类型与四种真实页面 HTML 网关故障恢复通过（`continuous-gateway-recovery-evidence.json`）。该修复已包含在本轮最终 build 中；全量 5,818 项统计不含随后新增的一项测试。production 与隔离候选字体扫描均为 3,348 文件通过。

字体与颜色正式隔离 E2E 2/2 通过：runId `e2e_b751be828bd5ed1a8c85577a`，候选 `dc3a439b-2576-47a1-8ae4-8f8402f60116`，报告 `bb2992e1-26d3-4764-b66c-722485ad7d6c.json`，Backend 同上；`resourcesRemoved`、`cleanupVerified`、`cleanupEventVerified` 均为 true。

浏览器证据采集时 HEAD 为 `f87c10e` 加本轮未提交变更；完整源码摘要为 `c986976bb465fc073fb17f78b5724c440a584bd19402f4d58bbc8f20bd2cdf4c`，616 份生产源文件摘要为 `3b00676cdad51aee030ecf79defa90245bec7da6bf3d9d94c51c3358acfc9028`。采集后补齐两份契约同步测试夹具、文档，并在 `src/api/text-font-fetch.ts` 增加非成功 HTTP 响应分类及对应测试。203 次成功响应路径、驻留与窗口代码保持一致；新错误路径单独重跑上述真实页面恢复验收。完整逐文件摘要、该窄范围差异及最终 SHA 映射记录于 `continuous-source-evidence.json`，没有把旧 HEAD 当作新实现源码。

历史完整 E2E 的两项讨论导航基线失败及四项缺少输入的只读样本跳过仍见此前记录，不得将定向通过表述为全量 E2E 全绿。负责人视觉验收仍待完成；未合并、部署、重启公网服务或执行真实业务写入。

后续边缘修复：无响应体的 503 也在返回 `apiClient` 前按 HTTP 状态分类，保留 `Retry-After`。目录和策略的真实 openapi-fetch/queryFn 回归先复现两项失败，修复后连同元数据、退避及生产恢复链共 11 项通过，lint 和类型检查通过；120 秒 Retry-After 不被 60 秒抖动上限截短。本次仅修改无 body 分支，未重跑 203 次成功响应浏览或重建；此前全量与构建结果保持其原版本范围。后续提交及红绿回归见 `continuous-null-body-evidence.json`。

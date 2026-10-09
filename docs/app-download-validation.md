# APP 下载视觉候选记录

> 本文件保留历史验收证据。交互式隔离开发预览工具已退役，下文的旧预览命令、会话与产物路径仅用于追溯；现行开发入口见 [日常开发](./modules/development.md)。独立写入 E2E 仍按原隔离门禁执行。

本记录对应直接下载入口、移动设备提示、弹窗操作整理及每日限次反馈，尚待负责人视觉验收。外观菜单仅提供主题与下载；Android 弹窗使用主次按钮，iOS 只保留继续使用网页。使用 Backend build 4242 合成样本，不是真实生产快照、正式发布包或 Android 安装验证。

## 每日下载限次候选

本轮同步 Backend `10b7819ad4a15777490dad5ab9abb7ae961422fc`，OpenAPI `5.32.0-dev.20261003.1`（含 HEAD 共 238 个操作，既有五种方法审计仍为 237）。入口在可读取的 429 中区分浏览器/IP 每日限次，并遵守服务端 Retry-After；Cookie 始终由服务端和同源浏览器管理，原生 GET 结果仍不作推断。

旧基线阶段相关测试 60 项通过，`pnpm check` 完成 346 个文件、3830 项测试及全部门禁。交付前 fetch 发现 `origin/dev` 已更新到 `dc3b60aea2f31b5fc15fa9350bc838b36aae7b9f`，已无冲突合入。最终候选的 `pnpm check` 再次通过：346 个文件、3836 项测试及全部门禁、构建；完整隔离 E2E `e2e_19398971cd23f4e6860d2a60` 已通过：240 passed / 13 条件 skipped / 0 failed，下载 23 项全部通过。Backend runner 固定 `339ffb8af0746e150cca4a3bbadde45f614fbf46`，`resourcesRemoved=true`、`cleanupVerified=true`。13 项跳过为既有 9 项专用长讨论夹具及 4 项本地指定正文快照条件，未改变跳过逻辑。标准检查与完整候选 E2E 合计覆盖 `pnpm check:full` 定义的全部门禁。

原持续预览经 Backend 标准升级后恢复，运行源码为 `339ffb8af0746e150cca4a3bbadde45f614fbf46`，HTTP 契约仍为上述 `10b7819`。同 session、runId、端口及合成快照保留；Backend 已核对旧字节累计、账本时钟、文件身份和缓存保留。Web 标准 start 重新读取消费者描述，未 reset 数据、清空预算或删除诊断缓存。Foundation 文档与 42 项共享场景固定 `482d6c7bac43ba2f5ff8d85158f44dff6337d476`，运行时仍为 `v7.2.1`。

### 本轮实际浏览器证据

- 截图时 HEAD `2626b4da8cc99dd8cd551abdfa1256209a2cb193` 加每日限次修改，内容摘要 `a28b86f293aaf55fab5cd7a1bfe5066a80d286777333791969ded19f48655737`。每日拒绝与真实下载证据时间为北京时间 2026-10-03 22:35:43 起，初始菜单已在新基线于 22:53:53 补拍；桌面 1280×900、390×900，Android 为 Chromium UA/触控模拟 390×900。
- 新基线展示复核绑定 HEAD `e60e6f000c0affaa21eeaf00f61f026f9075779b` 加每日限次修改，内容摘要 `a8d0c1136cee8872ab311a37c1ed53d094d57e267ff4bdfcadf8ca44de366b51`。实际登录表单与明暗菜单正常，未发下载信息、HEAD 或 GET，脚本异常仍为零；原先一次取包记录保留其旧基线归属，不冒称同步后再次取包。下载实现文件摘要未变化，新候选原生保存及 Cookie 行为由完整隔离 E2E 复验。
- 本轮仅执行一次真实原生 GET，保存 build 4242 合成样本 `131316` 字节，SHA-256 `acd1562834cbfff0530da9557a2c8088e60db7ba2c09f683f6dca869ffa2c772`，与信息端点相符。测试不打印 Cookie 值；只记录信息请求不携带标识、响应签发 HttpOnly/SameSite=Lax 标识、随后 HEAD 与原生 GET 自动携带的布尔证据，脚本无法从 document.cookie 读取该标识。该链路经过实际 Next 同源代理、隔离预览代理和下载网关。
- 每日拒绝画面使用真实信息端点，浏览器探针将 HEAD 模拟为空正文 429，附对应原因头和 `Retry-After: 86400`；两种入口显示浏览器/IP 今日次数耗尽，重试禁用，没有发 APK GET。模拟画面证明 Web 呈现，不代表持续预览额度已耗尽。真实计次和原子事务由 Backend 一次性隔离专项验证。
- 初始菜单与提示展示均无下载请求。菜单、每日拒绝与对话框的范围内 WCAG A/AA 检查通过；页面脚本异常、外域请求均为零。控制台保留预期匿名刷新 401，以及模拟拒绝场景的 HEAD 429；未将这些响应误报为脚本异常，也未隐藏日志。
- 原持续预览留给负责人验收；它不是一次性 E2E 资源，不能以保留会话声称已清理。图像不替代负责人视觉验收，没有新增字体、间距或颜色断言。

| 本轮画面 | 亮色 | 黑夜 |
| --- | --- | --- |
| 实际登录页外观菜单 | [1280px](assets/app-download/daily-menu-light-1280.png) | [1280px](assets/app-download/daily-menu-dark-1280.png) |
| IP 每日限制（模拟 HEAD 429） | [1280px](assets/app-download/daily-desktop-light-1280.png) | [1280px](assets/app-download/daily-desktop-dark-1280.png) |
| 窄桌面 IP 每日限制 | [390px](assets/app-download/daily-desktop-light-390.png) | [390px](assets/app-download/daily-desktop-dark-390.png) |
| Android 浏览器每日限制 | [390px](assets/app-download/daily-android-light-390.png) | [390px](assets/app-download/daily-android-dark-390.png) |

[实际原生交接画面](assets/app-download/daily-real-handoff-light-1280.png)只显示已交给浏览器；文件字节和摘要来自浏览器测试工具验证，产品 UI 不宣称完成或安装。

旧基线的完整 E2E `e2e_c32e808b8b1d996ffdf68e0b` 为同步新基线主动中止；中止前 87 passed / 13 skipped，下载 23 项已通过，无断言失败。登记资源目录已移除（`resourcesRemoved=true`），但中止轮的 `cleanupVerified=false`，不计作通过；最终新基线重跑及清理均已成功。 后续于北京时间 2026-10-03 23:10:56 按该 runId 单独执行只读遗留核验：原 `/tmp/wenyousite-e2e-qwbej6`、对应 Backend checkout 登记项均不存在，未发现匹配 runId/资源根目录的进程、文件描述符或 Unix socket。4 个受保护的 systemd/sshd 进程均于前一日启动，按启动时间确认不属本轮；未提权读取或操作它们。原报告 SHA-256 `08cf6153b34437a9de80e9018fd3efa5a6c864ad16fb3057d4b681a923d24d8a` 核验前后相同，保留 `cleanupVerified=false`。此独立核验不借用新轮清理结论，也未删除共享预览。

以下记录来自上一反馈批次，用于保留已观察的初始提示和主次按钮，不作为本轮每日限次验收结果。

## 上轮画面绑定信息

- Backend HTTP 契约：`1857d60fe3af309149eb5c1846be221d3a45fb86`；预览运行入口 `36b1375e1f95c72f96b87319fded413ba17a5328`；最新说明 `13168e6a9e23d537be8118207779593c7c073639` 不改契约。
- Foundation 共享场景：`4338de0e050949969b23a66f2cbf41d167553776`（29 项）；运行时仍为 `v7.2.1`。
- 截图时 HEAD `5e7a9cd571fe8311c3cfa549c98f43e348e2b52f` 加该轮修改；工作树内容摘要 `ea631ba0a8ce33549acccce137efd61a8fb025cee2b92d144ff16674bc2cb98a`。该画面绑定上轮内容摘要；文末实现摘要属于当前每日限次候选。
- 会话 `app-downloads-20261003`；runId `preview_212bae45e833f3c61371497f`；Web/Backend/media 44310/34585/39011。保留 Backend、数据、预算及 SSH 桥；该轮仅 Fast Refresh，没有重启或构建。此前旧路由缓存已移到私有诊断目录保留。
- 截图时间（北京时间）：`2026-10-03T16:33:00.438000+08:00` 起；菜单视口 1280×900、390×900；Android/iOS 为 Chromium 的移动 UA 与触控模拟，390×900。
- 合成样本采样时间为北京时间 2026-10-03 04:14:11。访问前核验实际 Web 代理身份，API 只访问该轮同源代理。

## 实际画面

| 画面 | 亮色 | 黑夜 |
| --- | --- | --- |
| 桌面外观菜单 | [1280px](assets/app-download/menu-light-1280.png) | [1280px](assets/app-download/menu-dark-1280.png) |
| 窄桌面外观菜单 | [390px](assets/app-download/menu-light-390.png) | [390px](assets/app-download/menu-dark-390.png) |
| Android 提示 | [390px](assets/app-download/android-light-390.png) | [390px](assets/app-download/android-dark-390.png) |
| Android 预检失败与原位重试 | [390px](assets/app-download/android-error-light-390.png) | [390px](assets/app-download/android-error-dark-390.png) |
| iOS 提示 | [390px](assets/app-download/ios-light-390.png) | [390px](assets/app-download/ios-dark-390.png) |

## 上轮浏览器观察

- Android 两项操作纵向排列，下载使用主按钮，继续网页使用次按钮；实际画面中两者等宽、等高、同圆角，文字一致继承操作区层级。iOS 使用唯一通栏继续按钮。菜单没有省流量控件或辅助说明，底层封面能力和已保存偏好未修改。
- 弹窗取消菜单式分割线和 ghost 行；预检失败后，原主按钮显示“重试下载”，状态说明单列，不新增文字式重试控件。菜单保留其原有重试方式。
- 八组初始画面与两组 Android 失败画面已记录。菜单／对话框 WCAG A/AA 自动检查通过；关闭按钮、焦点和主次操作实际可见，不替代负责人观感验收。
- 初始提示、菜单打开与悬停均无下载信息或文件请求。Android 两组预检失败验证各只读取信息并 HEAD 一次，浏览器探针将 HEAD 模拟为 503，无文件 GET；iOS 和桌面展示无下载请求。关闭后经 SPA 跳转不重复提示。
- 页面脚本异常与越出当前 Web origin 的请求均为零。字体、字号、间距和颜色只作画面观察，不加入自动化样式断言。

## 上轮检查与既有传输证据

- 该轮入口和 ThemeMenu 组件测试：2 个文件、20 项通过。覆盖原位重试、Retry-After 等待、双击与长按防重复、会话去重、关闭后继续交接及菜单能力；没有新增纯样式断言。
- 相关 ESLint、类型、架构、设计与文档检查通过。该轮按已授权反馈节奏执行定向验证，没有重复全量测试、生产构建或隔离 E2E 构建。
- 上一提交 `5e7a9cd571fe8311c3cfa549c98f43e348e2b52f` 的 `pnpm check` 已通过：346 个文件、3810 项测试，含覆盖率、依赖审计、预览隔离、lint、类型、契约、架构、设计、文档、发布源检查与构建。该结果属于上一行为候选，不称该轮重新执行过全量检查。
- 同提交隔离候选 `e2e_6a426ccc5dc6cdbf65d9116c`：下载与移动提示 15 项、主题 2 项、认证回跳 2 项、分隔线 2 项，共 21 项通过、无跳过。Backend runner 固定 `13168e6a9e23d537be8118207779593c7c073639`；`resourcesRemoved=true`、`cleanupVerified=true`。
- 该候选验证 GET 429（JSON／空正文）、503、502 不离开原页面；手动重试重新取信息、HEAD 后交接；菜单关闭与 SPA 切换保留下载载体。真实预览中桌面与 Android 各保存 `131316` 字节合成样本，SHA-256 `acd1562834cbfff0530da9557a2c8088e60db7ba2c09f683f6dca869ffa2c772` 与信息端点一致。附加防嵌入响应头后仍可保存；这不代表公网配置已部署。
- 该轮未改下载控制器、HEAD 校验、原生 iframe、契约或会话存储，只调整入口呈现和原位重试激活。原生 GET 结果仍不可靠回传，UI 不宣称已完成、已校验签名或已安装。真机 Safari、正式 APK、旧 APP、公网权限和持续预算不在本次模拟浏览器范围。

下表为当前每日限次候选的实现摘要，区别于上轮截图时摘要。

| 实现文件 | SHA-256 |
| --- | --- |
| `src/lib/app-download.ts` | `79ffa7604c143315072fe994ee3ddfef1c1b623b9047d8705735c06bfde1cc3c` |
| `src/components/download/app-download-context.ts` | `8bc3c1d561aedf8adca8254597cbfd7d5d0b6def10794e9ca2f4ee0b3d5c4049` |
| `src/api/hooks/use-app-download.ts` | `8bbdaa7cc48c89996a41bcde453539eb453bfb1868ab68cfa2ed6da856e99bda` |
| `src/components/download/app-download-provider.tsx` | `5e35b99f79a99b434c2e4a1174629bfe02c3a0a3e9837af16892a87d1ef3509f` |
| `src/components/download/app-download-entry.tsx` | `638099a25c7dae5ff60de21d1902ffed0a64ae6d0539383c13ba09f8b2ee3af9` |
| `src/components/download/mobile-download-prompt.tsx` | `541da3f736e59fb15c67656beeaeb5f4184758b5b598d39aab9c3b85f261eaa7` |
| `src/components/layout/theme-menu.tsx` | `e27ef1808d043db8fa9838d8f01f0750b13c8f7960f347aeadf1d26b51b34dce` |
| `src/lib/mobile-device.ts` | `72d965947be4be2b5c0dfc2c3bdac43920f532297067bff1dbfec84e499cbc52` |

此前完整 E2E 首轮 `e2e_1f067bd3d60ce43068f7234e` 为 216 passed / 2 failed / 13 skipped；两项失败来自已合并 PR #51 的连续楼层与旧分隔线视觉基线不符，`resourcesRemoved=true`、`cleanupVerified=false`。独立提交 `c751acf` 已按接受的设计修正基线并保留原几何和 Token 断言；后续 `e2e_5948533ae5a58d15e324278d` 及上述 21 项候选均已补验分隔线且清理成功。历史结果不作为本轮执行证据，本轮完整 E2E 见每日下载限次候选章节。

该历史批次的实时预览规则见 [退役前开发预览](https://github.com/morenk/wenyousite-frontend/blob/b60ea8172ef230d595debddb69e2075fc7d81ec0/docs/modules/dev-preview.md)，最终行为见 [APP 下载](modules/app-download.md)。

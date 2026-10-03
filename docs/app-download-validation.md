# APP 下载视觉候选记录

本记录对应直接下载入口、移动设备提示及本轮弹窗操作整理，尚待负责人视觉验收。外观菜单仅提供主题与下载；Android 弹窗使用主次按钮，iOS 只保留继续使用网页。使用 Backend build 4242 合成样本，不是真实生产快照、正式发布包或 Android 安装验证。

## 绑定信息

- Backend HTTP 契约：`1857d60fe3af309149eb5c1846be221d3a45fb86`；预览运行入口 `36b1375e1f95c72f96b87319fded413ba17a5328`；最新说明 `13168e6a9e23d537be8118207779593c7c073639` 不改契约。
- Foundation 共享场景：`4338de0e050949969b23a66f2cbf41d167553776`（29 项）；运行时仍为 `v7.2.1`。
- 截图时 HEAD `5e7a9cd571fe8311c3cfa549c98f43e348e2b52f` 加本轮修改；工作树内容摘要 `ea631ba0a8ce33549acccce137efd61a8fb025cee2b92d144ff16674bc2cb98a`。下表记录本轮实际实现摘要，后续文档和提交元数据不改变画面。
- 会话 `app-downloads-20261003`；runId `preview_212bae45e833f3c61371497f`；Web/Backend/media 44310/34585/39011。保留 Backend、数据、预算及 SSH 桥；本轮仅 Fast Refresh，没有重启或构建。此前旧路由缓存已移到私有诊断目录保留。
- 截图时间（北京时间）：`2026-10-03T16:33:00.438000+08:00` 起；菜单视口 1280×900、390×900；Android/iOS 为 Chromium 的移动 UA 与触控模拟，390×900。
- 合成样本采样时间为北京时间 2026-10-03 04:14:11。访问前核验实际 Web 代理身份，API 只访问本轮同源代理。

## 实际画面

| 画面 | 亮色 | 黑夜 |
| --- | --- | --- |
| 桌面外观菜单 | [1280px](assets/app-download/menu-light-1280.png) | [1280px](assets/app-download/menu-dark-1280.png) |
| 窄桌面外观菜单 | [390px](assets/app-download/menu-light-390.png) | [390px](assets/app-download/menu-dark-390.png) |
| Android 提示 | [390px](assets/app-download/android-light-390.png) | [390px](assets/app-download/android-dark-390.png) |
| Android 预检失败与原位重试 | [390px](assets/app-download/android-error-light-390.png) | [390px](assets/app-download/android-error-dark-390.png) |
| iOS 提示 | [390px](assets/app-download/ios-light-390.png) | [390px](assets/app-download/ios-dark-390.png) |

## 本轮浏览器观察

- Android 两项操作纵向排列，下载使用主按钮，继续网页使用次按钮；实际画面中两者等宽、等高、同圆角，文字一致继承操作区层级。iOS 使用唯一通栏继续按钮。菜单没有省流量控件或辅助说明，底层封面能力和已保存偏好未修改。
- 弹窗取消菜单式分割线和 ghost 行；预检失败后，原主按钮显示“重试下载”，状态说明单列，不新增文字式重试控件。菜单保留其原有重试方式。
- 八组初始画面与两组 Android 失败画面已记录。菜单／对话框 WCAG A/AA 自动检查通过；关闭按钮、焦点和主次操作实际可见，不替代负责人观感验收。
- 初始提示、菜单打开与悬停均无下载信息或文件请求。Android 两组预检失败验证各只读取信息并 HEAD 一次，浏览器探针将 HEAD 模拟为 503，无文件 GET；iOS 和桌面展示无下载请求。关闭后经 SPA 跳转不重复提示。
- 页面脚本异常与越出当前 Web origin 的请求均为零。字体、字号、间距和颜色只作画面观察，不加入自动化样式断言。

## 当前检查与既有传输证据

- 本轮入口和 ThemeMenu 组件测试：2 个文件、20 项通过。覆盖原位重试、Retry-After 等待、双击与长按防重复、会话去重、关闭后继续交接及菜单能力；没有新增纯样式断言。
- 相关 ESLint、类型、架构、设计与文档检查通过。本轮按已授权反馈节奏执行定向验证，没有重复全量测试、生产构建或隔离 E2E 构建。
- 上一提交 `5e7a9cd571fe8311c3cfa549c98f43e348e2b52f` 的 `pnpm check` 已通过：346 个文件、3810 项测试，含覆盖率、依赖审计、预览隔离、lint、类型、契约、架构、设计、文档、发布源检查与构建。该结果属于上一行为候选，不称本轮重新执行过全量检查。
- 同提交隔离候选 `e2e_6a426ccc5dc6cdbf65d9116c`：下载与移动提示 15 项、主题 2 项、认证回跳 2 项、分隔线 2 项，共 21 项通过、无跳过。Backend runner 固定 `13168e6a9e23d537be8118207779593c7c073639`；`resourcesRemoved=true`、`cleanupVerified=true`。
- 该候选验证 GET 429（JSON／空正文）、503、502 不离开原页面；手动重试重新取信息、HEAD 后交接；菜单关闭与 SPA 切换保留下载载体。真实预览中桌面与 Android 各保存 `131316` 字节合成样本，SHA-256 `acd1562834cbfff0530da9557a2c8088e60db7ba2c09f683f6dca869ffa2c772` 与信息端点一致。附加防嵌入响应头后仍可保存；这不代表公网配置已部署。
- 本轮未改下载控制器、HEAD 校验、原生 iframe、契约或会话存储，只调整入口呈现和原位重试激活。原生 GET 结果仍不可靠回传，UI 不宣称已完成、已校验签名或已安装。真机 Safari、正式 APK、旧 APP、公网权限和持续预算不在本次模拟浏览器范围。

| 实现文件 | SHA-256 |
| --- | --- |
| `src/components/download/app-download-context.ts` | `8bc3c1d561aedf8adca8254597cbfd7d5d0b6def10794e9ca2f4ee0b3d5c4049` |
| `src/api/hooks/use-app-download.ts` | `ac6faa7a87784229b4c9a2f37ec99bc7b36b0a1896c0775643fa5265eec70b0b` |
| `src/components/download/app-download-provider.tsx` | `5e35b99f79a99b434c2e4a1174629bfe02c3a0a3e9837af16892a87d1ef3509f` |
| `src/components/download/app-download-entry.tsx` | `09c71b143aca845bf9028b3cb4940f2d6800935f6e4689acc1354950e25042a8` |
| `src/components/download/mobile-download-prompt.tsx` | `541da3f736e59fb15c67656beeaeb5f4184758b5b598d39aab9c3b85f261eaa7` |
| `src/components/layout/theme-menu.tsx` | `e27ef1808d043db8fa9838d8f01f0750b13c8f7960f347aeadf1d26b51b34dce` |
| `src/lib/mobile-device.ts` | `72d965947be4be2b5c0dfc2c3bdac43920f532297067bff1dbfec84e499cbc52` |

此前完整 E2E 首轮 `e2e_1f067bd3d60ce43068f7234e` 为 216 passed / 2 failed / 13 skipped；两项失败来自已合并 PR #51 的连续楼层与旧分隔线视觉基线不符，`resourcesRemoved=true`、`cleanupVerified=false`。独立提交 `c751acf` 已按接受的设计修正基线并保留原几何和 Token 断言；后续 `e2e_5948533ae5a58d15e324278d` 及上述 21 项候选均已补验分隔线且清理成功。此段保留分支历史解释，不代表本轮执行过完整 E2E。

实时预览规则见 [开发预览](modules/dev-preview.md)，最终行为见 [APP 下载](modules/app-download.md)。

# APP 下载视觉候选记录

本记录对应直接下载入口与移动设备提示，尚待负责人视觉验收。已取消的独立页面和二维码不属于本次候选。使用 Backend build 4242 合成样本，不是真实生产快照、正式发布包或 Android 安装验证。

## 绑定信息

- Backend HTTP 契约：`1857d60fe3af309149eb5c1846be221d3a45fb86`；预览运行入口 `36b1375e1f95c72f96b87319fded413ba17a5328`；最新说明 `13168e6a9e23d537be8118207779593c7c073639` 不改契约。
- Foundation 共享场景：`6458c063aa993a17d54ba623de9a850a96839c12`（29 项）；运行时包仍为 `v7.2.1`。
- Web 截图时 HEAD：`6d605c487caac8507f62a655fdef2a4881fce362` 加本反馈批次修改；工作树内容摘要 `3d4c0723c842d5fdcf7651b2a260125df21c9e3024940e59a5db950f5f16e5c0`。摘要覆盖截图时内容，后续文档与提交元数据不改变画面实现。
- 会话 `app-downloads-20261003`；runId `preview_212bae45e833f3c61371497f`；Web/Backend/media 44310/34585/39011。保留原 Backend、数据、预算和 SSH 桥；删除路由后由标准入口重启本任务 Web，清除旧编译图。
- 截图时间（北京时间）：`2026-10-03T15:58:30.731000+08:00` 起；桌面视口 1280×900、390×900，Android/iOS 使用 Chromium 的移动 UA 与触控模拟，视口 390×900。
- 快照标记为合成样本，采样时间北京时间 2026-10-03 04:14:11。访问前核验实际 Web 代理身份，API 只访问本轮同源代理。

## 实际画面

| 画面 | 亮色 | 黑夜 |
| --- | --- | --- |
| 桌面外观菜单 | [1280px](assets/app-download/menu-light-1280.png) | [1280px](assets/app-download/menu-dark-1280.png) |
| 窄桌面外观菜单 | [390px](assets/app-download/menu-light-390.png) | [390px](assets/app-download/menu-dark-390.png) |
| Android 提示 | [390px](assets/app-download/android-light-390.png) | [390px](assets/app-download/android-dark-390.png) |
| iOS 提示 | [390px](assets/app-download/ios-light-390.png) | [390px](assets/app-download/ios-dark-390.png) |

## 隔离浏览器观察

- 八组画面均无横向溢出；相关菜单／对话框 WCAG A/AA 自动扫描无违规。标题、关闭按钮和焦点实际可见；这不替代负责人观感验收。
- 主题项、省流量和下载按钮的实际 computed style 为 14px / 20px、400 字重；辅助说明 12px。下载文字原先被全局 `font: inherit` 继承为正文 16px，修复限定在入口容器，没有改全站控件重置。
- 桌面包括 390px 窄窗口不自动提示。Android 显示下载与继续使用网页；iOS 明确仅支持 Android、暂无 iOS 版本，提示内无 APK 按钮。关闭后经 SPA 跳转和整页刷新均不重复提示。提示、菜单打开、悬停和聚焦期间下载信息与文件请求为零。
- 桌面菜单和 Android 提示各点击一次，均只产生信息 GET、固定构建 HEAD、原生 GET 各一次；浏览器各保存 `131316` 字节，SHA-256 `acd1562834cbfff0530da9557a2c8088e60db7ba2c09f683f6dca869ffa2c772`，与信息端点一致。顶层仍在 `/login`，关闭菜单／提示和跳转注册页后 iframe 仍保留。
- 实际附件保持原始长度、正文与 Content-Disposition，同时由探针附加 `X-Frame-Options: DENY` 和 `CSP frame-ancestors 'none'`；Chromium 仍保存正确文件。这是隔离头部兼容验证，不代表公网配置已部署。
- 所有浏览器上下文的页面脚本异常和越出当前 Web origin 的请求均为零。实时预览继续保留，用于负责人打开 `/login` 反馈。
- 原生 GET 结果不可靠回传，UI 只显示浏览器交接与手动重试，不宣称文件已完成、签名已验证或已安装。正式制品签名、真机 Safari、已安装 APP、公网云权限、持续预算不在本次模拟浏览器验收范围。

## 检查与源码对应

- `pnpm check` 全部通过：346 个文件、3810 项测试，覆盖率、依赖审计、预览隔离、lint、类型、契约、架构、设计、文档、发布源检查与 production build 均通过。当前相关 Vitest 为 7 个文件、76 项；Context 拆分后另外复核入口和 Provider 18 项。
- 新隔离候选 `e2e_6a426ccc5dc6cdbf65d9116c`：下载与移动提示 15 项、主题 2 项、认证回跳 2 项、分隔线 2 项，共 21 项全部通过、无跳过。Backend runner 固定 `13168e6a9e23d537be8118207779593c7c073639`；`resourcesRemoved=true`、`cleanupVerified=true`。此次为受影响范围补验，没有将其称为重新执行完整 E2E。
- GET 429（JSON／空正文）、503、502 保留原页面及手动重试；重试重新读取信息并 HEAD 后再交接。预检等待结束不自动重试；关闭移动提示／菜单、SPA 导航和再次下载均保留已交接载体。
- 字体、字号与行高仅记录实际画面和 computed style 观察，按负责人要求不加入自动化样式断言。

截图后仅将 Context 拆成独立文件以消除循环依赖，行为与视觉不变；下表记录最终实现。

| 实现文件 | SHA-256 |
| --- | --- |
| `src/components/download/app-download-context.ts` | `8bc3c1d561aedf8adca8254597cbfd7d5d0b6def10794e9ca2f4ee0b3d5c4049` |
| `src/api/hooks/use-app-download.ts` | `ac6faa7a87784229b4c9a2f37ec99bc7b36b0a1896c0775643fa5265eec70b0b` |
| `src/components/download/app-download-provider.tsx` | `5e35b99f79a99b434c2e4a1174629bfe02c3a0a3e9837af16892a87d1ef3509f` |
| `src/components/download/app-download-entry.tsx` | `c3dd9de1dcf238794966ff60671c55207fb57c33597d71dafc05a293d975992b` |
| `src/components/download/mobile-download-prompt.tsx` | `7e2f34220d47f0ed0c72e4f220be2a2de923497d93ec4e55526a7951e02b044d` |
| `src/lib/mobile-device.ts` | `72d965947be4be2b5c0dfc2c3bdac43920f532297067bff1dbfec84e499cbc52` |

此前完整 E2E 首轮 `e2e_1f067bd3d60ce43068f7234e` 为 216 passed / 2 failed / 13 skipped；两项失败来自已合并 PR #51 的连续楼层与旧分隔线视觉基线不符，`resourcesRemoved=true`、`cleanupVerified=false`。独立提交 `c751acf` 已按接受的设计修正基线并保留原几何和 Token 断言；后续 `e2e_5948533ae5a58d15e324278d` 的分隔线 2 项及旧下载 10 项通过、清理确认成功。以上仅保留分支历史解释，不代表当前入口和移动提示已跑过完整 E2E。

实时预览规则见 [开发预览](modules/dev-preview.md)，最终行为见 [APP 下载](modules/app-download.md)。

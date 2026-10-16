# APP 下载

## 入口与呈现

外观弹层在主题选项下方提供“下载 APP”按钮。游客、登录用户、登录页与窄视口复用同一入口，不要求登录；没有独立下载页或二维码。用户点击一次，即获取当前可用版本、预检固定构建，再交给浏览器保存。菜单保持打开以显示进度或恢复提示。

菜单主题选项与下载操作采用相同的 14px / 20px、400 字重；标题保留层级，辅助说明与重试为 12px。下载入口在自身容器定义文字层级，使全局控件 `font: inherit` 不把按钮放大为正文，不改变共享 Button 或全站样式。图标、颜色与控件沿用 Foundation 和共享 UI。

## 移动设备提示

浏览器完成 hydration 后，依据 Android、iPhone/iPad/iPod、触控 iPad 桌面 UA 或浏览器移动标记识别移动设备；窄桌面窗口不会触发提示。首次访问显示可关闭的共享 Dialog，登录页同样适用，不新增移动版社区布局。

Android 提示纵向排列两个等宽、等高的按钮：“下载 APP”为主按钮，“继续使用网页”为次按钮。两项操作共用按钮圆角、对齐和文字层级，描述与操作区分组，不复用菜单分割线或 ghost 行样式。失败或交接后，原位主按钮改为“重试下载”，附近显示状态，不另加文字式重试入口；等待期间禁用，双击后续点击及长按不重复传输。iOS／其他移动平台仅保留一个通栏的“继续使用网页”按钮。iOS 明确目前仅支持 Android、暂无 iOS 版本，不显示 APK 按钮；其他移动平台只说明 Android 限制并允许继续浏览。关闭、按 Escape、继续浏览或主动点击下载后，以 `sessionStorage` 的 `wenyou:app-download-prompt=handled` 记录本次会话已处理，不跨路由或刷新反复打扰。该键不含账号或凭证。存储受限时仍可关闭，本次应用挂载不重复弹出；无法保证禁用存储后的整页刷新记忆。

显示或关闭提示不会读取下载信息、预检或下载文件。对话框保留标题、描述、焦点管理及可访问关闭按钮；服务端不读取 navigator 或 sessionStorage。

## 信息状态与重试

应用级 `AppDownloadProvider` 持有独立匿名 QueryClient 和下载控制器，位于登录身份缓存之外。`useAppDownload` 使用已有 Query Key，经 `apiClient` 读取 `GET /api/v1/mobile-releases/android/download`，直接消费生成 DTO。菜单与移动提示共享 pending、结果及重试状态。

查询默认禁用，只在用户明确点击“下载 APP”或“重试下载”时获取推荐版本。新入口仅接受 `available`、`no_release`、`unavailable`，且 `retryAfterSeconds` 为 null；仅 available 携带有效 release。缺字段、不一致状态、旧网关或其他不可信地址均失败，不从历史版本猜测推荐。

读取或预检失败在原入口反馈。请求不自动重试，不在聚焦、联网恢复或等待结束时发请求。HTTP 429 显示通用限流；可读取的 `Retry-After` 只决定何时开放手动重试。新流程不消费网关设备/IP 每日次数、Cookie、字节预算和带宽限制，旧原因头不改变文案。进行中禁止重复激活；菜单交接后保留单独重试，弹窗原位改为“重试下载”。

## 下载触发与制品绑定

菜单挂载、打开、悬停、聚焦和移动提示不查询信息或文件。用户激活后先读新 JSON，核对 Android 包名、版本、构建号、大小和 SHA-256。文件名必须为 `wenyou-<versionName>-<buildNumber>.apk`，URL 必须精确为 `https://wenyou-apk.cn-nb1.rains3.com/mobile/android/<fileName>`，版本说明仍为本站对应构建地址。禁止其他主机、协议、路径、查询参数、片段及重定向别名。

`src/api/app-download-file.ts` 对已校验地址发起 `HEAD`，显式 `credentials: omit`、`redirect: error`、`mode: cors` 和 `referrerPolicy: no-referrer`。桶请求不经过本站认证中间件，不带本站 Cookie、Authorization、客户端或 Markdown 请求头，不发 Range。只有状态 200、APK Content-Type、Content-Length、Content-Disposition 文件名和四项 `x-amz-meta-apk-sha256/application-id/version-name/version-code` 均匹配，且当前查询未变化，才交接完全相同的 URL。

应用级容器保留隐藏受限 iframe，sandbox 仅允许下载，不允许脚本、同源权限或顶层导航。浏览器原生 GET 保存文件，不 fetch/blob 整包、不后台预取、不猜 URL、不回退网关。关闭菜单或弹窗、SPA 路由和登录缓存变化不移除下载载体；整页卸载取消尚未完成的预检。固定版本文件可由桶缓存和 Range 支持，Web 不维护正文缓存。

HEAD 成功不能保证之后对象与网络不变化，浏览器接管后只反馈交接，不声称下载完成、摘要已计算或已安装。原生 GET 的 HTTP 错误不能可靠回传；隐藏载体保留原页面，用户重试必须重新读信息和 HEAD。HEAD 比对元数据不替代安装时的包校验。

## 契约与发布边界

固定 Backend 契约提交为 `882889c5d8dc4a47893cb4fe913a0f68e536ce2f`（`5.37.0-dev.20261015.1`），经现有同步脚本和类型生成器同步；[后端直连说明](https://github.com/morenk/wenyousite-backend/blob/882889c5d8dc4a47893cb4fe913a0f68e536ce2f/docs/android-direct-download.md) 是切换事实源。[API 契约](api-contract.md#公开-app-下载) 和[弃用登记](../deprecation-register.md#公开-app-下载) 保留兼容边界。

需先合并并由管理入口部署兼容 Backend，再通过已提交的受限晋级流程将推荐策略切回固定桶地址，最后启用已合并 Web。策略仍指向网关时新入口返回 unavailable，Web 不回退。桶必须允许站点 Origin 的 HEAD 并暴露上述身份头；CORS、公开对象及缓存响应在切换时重新核验。本任务不改桶权限、不预热、不合并部署。

CSP 仅为 `connect-src` 与 `frame-src` 新增精确桶的 `/mobile/android/` 路径，其他脚本、图片、媒体与全站安全策略不放宽。旧网关端点、下载 Cookie、审计与账本继续服务历史客户端；移除协议须独立满足清理证据，恢复直连不代表能撤销已发出的公开对象 URL。

## 验证

- 下载纯函数、Hook、入口与安全配置定向测试覆盖固定桶身份、全部必需响应头、零预取、单次激活、无凭据 HEAD、失败手动恢复、状态变化、菜单/弹窗和路由生命周期。
- `e2e/app-download.spec.ts` 的浏览器样本已改为拦截固定桶域，补充 CORS、重定向、凭据隔离和原生交接场景；未匹配的桶路径必须 abort，不能落到真实 APK。实际执行仍继承隔离 fixture。
- 按负责人要求，明确合并前只运行相关定向验证；本次未运行全量测试、门禁、构建或完整 E2E。未读取真实 APK 正文，未启动线上测试或修改真实业务数据。
- 入口布局未调整，本次没有新的实际浏览器画面；[视觉候选记录](../app-download-validation.md) 的旧网关截图仅用于历史追溯，不能当作直连浏览器验收。真实 CORS、浏览器原生下载与 Android 安装仍待切换后的负责人验收。

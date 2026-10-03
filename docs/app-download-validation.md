# APP 下载视觉候选记录

本记录为视觉候选，尚未经过负责人视觉验收。使用 Backend build 4242 合成样本，不是真实生产快照、正式发布包或 Android 安装验证。

## 绑定信息

- Backend HTTP 契约：`1857d60fe3af309149eb5c1846be221d3a45fb86`；恢复后的预览运行入口：`36b1375e1f95c72f96b87319fded413ba17a5328`（显式重绑定端口，保留原批次）。
- Foundation 共享场景：`100ddf0db555d5a4c0bff733f19fa9b9e6f7f6ac`（26 项）；运行时包仍为 `v7.2.1`。
- Web 源码基线：`5514921832fa3c2a51abde88f9d53de8ca73686c`，加本任务未提交实现。
- 截图时工作树内容摘要：`68a467e45669e419c9bd17a48eb2e051cc2017e682e3c878db864e3a10af966d`。该摘要为截图时文件内容，不等于首次启动摘要；后续文档与提交元数据不改变画面实现。
- 会话：`app-downloads-20261003`；runId：`preview_212bae45e833f3c61371497f`。
- 截图时间（北京时间）：`2026-10-03T07:42:07.062000+08:00` 起；视口为 1280×900、390×900，完整页面截图高度可能更长。
- Web/Backend/media 端口为 44310/34585/39011；启动前及浏览器访问前核验实际身份，API 始终经本轮 Web 代理。

## 实际画面

| 画面 | 亮色 | 黑夜 |
| --- | --- | --- |
| 桌面下载页 | [1280px](assets/app-download/download-light-1280.png) | [1280px](assets/app-download/download-dark-1280.png) |
| 窄屏下载页 | [390px](assets/app-download/download-light-390.png) | [390px](assets/app-download/download-dark-390.png) |
| 桌面外观菜单 | [1280px](assets/app-download/menu-light-1280.png) | [1280px](assets/app-download/menu-dark-1280.png) |
| 窄屏外观菜单 | [390px](assets/app-download/menu-light-390.png) | [390px](assets/app-download/menu-dark-390.png) |

## 隔离浏览器观察

- Chromium 实际加载页面，四组视口无横向溢出，WCAG A/AA 自动扫描未发现违规。
- 桌面二维码使用浏览器实际截图像素解码，内容为 `https://wenyou.site/download`；页面保留同目标的可读链接。生产页面地址在预览中不会被自动打开。
- 浏览、悬停、键盘聚焦和刷新信息期间文件请求为零。
- 显式点击后只发生一次 HEAD 和一次 GET，浏览器保存 `131316` 字节合成样本，SHA-256 为 `acd1562834cbfff0530da9557a2c8088e60db7ba2c09f683f6dca869ffa2c772`，与信息端点一致。
- 额外浏览器回归：实际隔离 HEAD 成功后拦截 GET 为 429（JSON／空正文）、503、502，错误响应同时保留 `X-Frame-Options: DENY` 与 `CSP frame-ancestors 'none'`；四项均留在 `/download`，可手动刷新信息且文件请求仍只有一次 HEAD、一次 GET。原生传输不能向页面返回 HTTP 状态或 Retry-After，页面只提供交接说明及手动恢复入口，不伪造错误码或倒计时。
- 页面脚本异常与越出当前 Web origin 的请求均为零。截图上的“合成样本”标识明确区分隔离样本与真实快照。
- 正常附件额外验证：隔离 Backend 的原始文件响应未携带防嵌入头，浏览器探针保留其原始附件内容、长度与 Content-Disposition，并按候选安全策略附加 `X-Frame-Options: DENY` 和 `CSP frame-ancestors 'none'`。Chromium 仍交给下载列表保存，摘要一致；这是隔离头部兼容验证，不代表 Caddy 已部署。
- Web CSP 通过 `default-src 'self'` 限制同源框架；无需放宽页面或 Caddy 的防嵌入头。框架只授予附件保存及同源能力，不授予脚本或顶层导航；恢复控件不依赖框架 load 事件或读取错误正文。已核对治理已提交 Caddy 配置的 `X-Frame-Options: DENY`，未部署该配置。
- 真实云权限、公网网关、旧 APP 安装、持续带宽/预算与正式 APK 签名不属于本次 Web 浏览器观察；由 Backend、Mobile 及后续获批运维分别验证。

实时预览的生命周期与本机 SSH 入口见 [开发预览](modules/dev-preview.md)。图像记录不会自动代表后续源码；修改视图后须重新提供候选。行为和失败恢复测试见 [APP 下载](modules/app-download.md)。

## 检查与源码对应

- `pnpm check`：346 个文件、3802 项测试通过，包含标准契约检查与 production build。完整检查运行期间补充了 HEAD → GET 页面保留修复；早于该修复的检查不作为最终实现的独立证据。
- 最终下载实现另跑 Hook/页面 25 项单测、相关 lint、`pnpm typecheck`、架构与设计检查，均通过。普通构建、隔离构建及实际隔离候选的 SSR/客户端产物均检查到 `allow-downloads allow-same-origin` 与最终恢复提示；未复用修复前构建冒充新候选。
- 最终下载 Hook SHA-256：`413a5e4f76fb428c3891f0bbd583b3b6b7cd17b90b4b00ee6e7f667e599017d6`；页面接入 SHA-256：`28547b5340e5c8097f354e8d964468850e3376110703fd69b4c66c2cf5cbe13a`。本记录后的源码提交可据此核对对应实现。
- 完整 E2E 首轮 `e2e_1f067bd3d60ce43068f7234e`：216 passed / 2 failed / 13 skipped（沿用既有条件配置）。两项失败是已合并 PR #51（`787c93400dfaa30848ac71212395600ddeca84c3`）改为透明连续楼层后，分隔线测试仍期待旧卡片的圆角、间距与截图。首轮 `resourcesRemoved=true`、`cleanupVerified=false`，不能称该轮通过或将清理确认字段改写为 true。
- 已按已接受设计同步两项视觉测试及明暗截图，增加透明背景、仅底部分隔等检查，保留正文分隔线的几何、居中、Token 颜色和像素断言。没有回退楼层样式、跳过用例或扩大截图容差。
- 最终定向隔离轮 `e2e_5948533ae5a58d15e324278d`：下载 10 项 + 分隔线 2 项全部通过、无跳过；`resourcesRemoved=true`、`cleanupVerified=true`。Backend runner 固定为 `36b1375e1f95c72f96b87319fded413ba17a5328`。完整首轮与该定向补验分别记录，没有把补验称为重新执行过整套耗时基准。

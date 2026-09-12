# Web 系统字体迁移验收证据

本记录对应 `codex/20260912-system-font-web`，仅修改 Web，不包含合并或部署授权。

## 版本与范围

- Web 基线：`f3ed0f83288fdaaaaa9f13c0e7306576a3968f15`，从已 fetch 的 `origin/dev` 创建独立任务分支。
- Foundation 正式版本：`v7.0.0`；annotated Tag 对象 `9e14521ce83c2488a418c850b948bc7b6aee4ee1`，peeled commit `a3f722bb9514712ff857065cd210c91414e907e4`。远端 `ls-remote`、pnpm importer、已安装 manifest 和产物哈希检查一致。
- Foundation 契约 SHA-256：`0f8a1564db88880d58024e4865009897fbf5120baff69e69cf4338b995da98cf`，schema 3。
- body/display/utility 从 `TYPOGRAPHY_FAMILIES` 注入根节点，四个 Web 字体 Token 均解析为未加引号的 `system-ui, sans-serif`。保留所有字号、行高、字重与场景；utility 明确使用 `tabular-nums`。
- Tailwind Preflight 的编译时回退由契约测试约束；Sonner 2.0.7 的 pnpm 补丁仅替换三份发行文件的字体栈。Next.js 16.3.3 的补丁只移除框架字体度量表中的 212 个禁用家族，其他 1,541 个家族及运行代码保持原样。升级对应依赖时须重新审查补丁。

## 静态产物对比

同一 Linux Worktree、Node 24.18.0、pnpm 11.17.0、Next.js 16.3.3；分别安装锁定依赖并执行生产构建。统计 `.next/static + public` 的文件实际字节数，不统计 gzip/Brotli、不计 `.next/cache`、服务端 bundle 或 standalone 重复副本。

| 指标 | 基线 v6.9.0 | 系统字体 v7.0.0 | 变化 |
| --- | ---: | ---: | ---: |
| 字体文件数 | 107 | 0 | -107 |
| 字体文件字节 | 10,290,364 | 0 | -10,290,364 |
| CSS 字节 | 297,893 | 199,369 | -98,524 |
| JavaScript 字节 | 5,373,698 | 5,375,132 | +1,434 |
| 总静态文件数 | 243 | 136 | -107 |
| 总静态字节 | 16,128,156 | 5,740,702 | -10,387,454（64.41%） |

机器可读的 Build ID、分类统计与清单摘要见 [产物记录](./system-font-migration-assets.json)。最终候选 Build ID 为 `xqi5U_u2aFYAlRQTXu-UY`。

移除字体文件与预计约 10.29 MB 一致（十进制 MB）。总减少量另外包含字体声明、第三方回退栈的 CSS 减少及本次字体接入与分块引用的 JS 净差额。PNG、ICO、Web Manifest 字节数完全相同。两次静态目录均没有 KaTeX 字体文件；数学依赖、系统等宽栈和图标实现未删除。

复现统计：

```bash
pnpm install --frozen-lockfile
pnpm build
node scripts/measure-static-assets.mjs
```

脚本同时输出 Build ID、按扩展名的数量/字节及完整文件路径、字节、SHA-256 清单的整体摘要。基线先构建后保留构建目录，再向脚本传入该目录，公共资产使用未变化的 `public`。

## 门禁与浏览器范围

- 最终 `pnpm install --frozen-lockfile` 与 `pnpm check:full` 通过；后者包含 `pnpm check`、生产构建和隔离 standalone E2E。303 个单元测试文件、3,141 项测试通过，覆盖率满足全部原门槛。
- 专用账号测试数据按测试前 ID 基线和创建时间清理；最终一轮删除 14 个新增主题帖/草稿，复查本次新增主题与动态均无遗留。清理遵守接口限流，不删除测试前已有记录。
- 完整 E2E 为 149 项通过、5 项仓库既有条件跳过：4 项需要负责人提供原地址正文快照，1 项属于显式启用且限定历史候选的 S5 真实 API 验收入口。本次未添加 skip，也未降低断言或门槛。
- 最终生产构建 `xqi5U_u2aFYAlRQTXu-UY` 的 3,037 个应用与依赖文件通过字体扫描；另行枚举整个 `.next` 与 `public` 的字体扩展文件结果为 0。

- `fonts:check` 检查生产源码、公共资产与依赖锁；`fonts:check:build` 检查 `.next/static`、`.next/server`、整个 standalone（包括框架依赖）和 `public`。拒绝旧字体标识、自有字体扩展文件、加载/预加载入口及失效 `fonts.css`；数学与图标字体按功能家族保留。
- Zod 的乌兹别克语文案 `Noto‘g‘ri` 不是字体，扫描对此有独立回归测试；不会因此允许 `Noto Sans` 或 `Noto Color Emoji` 字体栈。依赖完整性校验的 base64 字符串不按字体名解释。
- 代表性 Chromium 46 项通过：编辑与阅读重开、首页、主题管理/阅读标题、私聊正文、设置、站务、动态详情与文字封面；全程检查旧字体请求，检查 body/utility 的计算字体与等宽数字。
- Firefox/WebKit 定向 16 项通过：亮色/黑夜设置、首页长标题、私聊正文及动态文字封面。
- 全套真实 API 测试暴露的既有字数选择器歧义已修正：导航未读数也使用 `tabular-nums`，现在只匹配编辑器的 `数字/10000` 并正向断言非零；主题详情测试固定可见未读徽标作为回归前置条件。
- 编辑器功能和亮色/黑夜正文分隔线 3 项通过；字体变化后的截图基线经检查后更新，未放宽截图阈值或删除断言。
- 长中文、中英数字 Emoji 混排在 100%/200% CSS zoom 下检查自然换行、列表两行/封面五行限制、私聊行高与横向溢出。CSS zoom 只是可推导的布局回归，不代替真实浏览器缩放及其媒体查询行为。

## 负责人仍需验收

在 Windows/macOS 的真实浏览器和用户操作系统字体环境下，使用 100%/200% 浏览器缩放检查首页、主题详情、编辑器、私聊、设置、站务及动态文字封面；覆盖长中文标题、中英数字 Emoji、品牌文字、数字列、正文粗体/斜体、键盘焦点和换行。Linux 自动化与截图只能证明对应环境下的结果，不能保证各平台字形、字宽或字重观感一致。真实页面审美验收、合并和部署由负责人完成。

本任务实际执行策略为 `approval_policy=never`、无沙箱，不是 Auto-review；未将审批偏好或文档视为 `approvals_reviewer=auto_review` 已生效的证据。

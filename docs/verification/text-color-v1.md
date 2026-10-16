# Web 文本颜色 v1 验证

## 来源与边界

- 初始基线：`dev` 的 `469dab1e9dc85e4f9599bd4dd54b17a3f132d18a`；独立 Worktree `/srv/wenyousite/.worktrees/frontend-text-color-v1`，任务分支 `codex/20261016-text-color-v1`。
- Backend 契约：`2cdedbcdecee4991634cf4b256aa0f547b06d88c`，OpenAPI `5.38.0-dev.20261016.1`。快照由 `WENYOUSITE_BACKEND_ROOT` / `BACKEND_CONTRACT_REF` 脚本同步，生成 DTO 未手改。
- 隔离 runner：`4c8970894e104ff51a45b6dbed965a3c786a3233`；相对契约提交只增加验证文档，运行时代码相同。
- Foundation 正式 `v7.4.0`，提交 `a03b5c24ea7dcdaa2ba07c962f58434bdb40965d`；61 个生成产物及 manifest 哈希检查通过。
- Web 仅显示、保源编辑和站内复制粘贴，无取色入口。明暗主题保持 RGB 原值；动态、私信、标题没有开放颜色。
- Auto-review 偏好已传递；宿主实际 `approval_policy=never`，没有可用配置入口，不能视为已启用 Auto-review。
- 未合并、部署或连接真实环境执行写入测试。下列请求均属于本轮隔离账号与资源。

## 静态检查、编解码与保存

`pnpm check` 通过：安全审计、lint、类型、架构、契约、Foundation、字体、5,016 项测试、部署前置测试、文档检查、生产构建。审计首次受进程代理影响失败，后续仅对该命令移除代理后通过；未修改全局配置。中途类型声明与脚本临时 fixture 缺项已修复，最终完整检查成功。

定向测试包含受控属性、损坏标签、原子元素、组合格式、中文/emoji、行内代码、边缘空白、跨样式范围、混合颜色、复制粘贴/撤销/重做、无能力编辑保护、草稿恢复以及独立能力字段的重试冻结。显式转义的 `\@全体玩家`、骰子文本、`\/threads/...` 保持彩色字面文本，不误转成原子内容。

实际 Milkdown 使用生产相同的颜色、边界文字、注意标记、骰子插件。21 个共享有效 fixture 加 3 个转义字面案例的无操作保存共 24 条，Backend 在关闭新写条件下接受 24/24。另有 32 组组合格式 × 6 类文字检查。序列化后重解析并比对颜色及完整样式签名，丢色会阻止保存。

## 隔离 E2E

命令前置固定 runner 完整 SHA，并指定本机独立 PostgreSQL/Redis 工具目录。测试 fixture 在登录前核验资源身份及候选实际代理，禁止回退线上地址。

| 运行 | 结果 | 资源清理 |
| --- | --- | --- |
| `e2e_42a20a1a66ab46b1ff680621` | 构建因类型声明失败；0 浏览器测试、未登录 | `resourcesRemoved=true`；失败状态保留 |
| `e2e_48736754a2e2ac69a801e24d` | 完整 `pnpm test:e2e:candidate`：236 通过、13 按既有条件跳过、10 失败 | `resourcesRemoved=true`；额外核验根目录、进程和端口均移除 |

首轮完整 E2E 的 10 项失败：8 张旧导航图标快照、角色复制用例读取异步剪贴板过早、颜色用例错误读取旧接口形状。角色用例改为等待真实 HTML 写入，超时仍失败；颜色用例使用生成 DTO 的 `subthreads/defaultSubthreadId/bodyPost`。产品运行时代码未因这些修正改变。

旧 runner 报告的 `cleanupVerified` 同时依赖整个测试成功，失败时为 false；不能据此声称失败运行成功。Backend 清理路径先逐个核验并关闭自有进程组，再核验 ownership、删除 PostgreSQL 数据、Redis 数据和上传所在根目录。完整运行的 PostgreSQL 端口 38659、Redis 44879、API 44579 均已关闭，`/tmp/wenyousite-e2e-mVBnyz`、对应进程与残留登记均不存在。后续报告另记录实际 `resources-cleaned` 事件的 `cleanupEventVerified`，不放宽原成功门禁。

修复后仍使用完整隔离入口重跑六个文件：
`e2e/management-workspace.spec.ts`、`e2e/moment-detail-layout.spec.ts`、`e2e/role-mentions.spec.ts`、`e2e/text-color.spec.ts`、`e2e/visual-home.spec.ts`、`e2e/workspace-layout.spec.ts`。

- `e2e_162c7310e53a778c70cf9db0`：19 通过、7 失败。前两张基线与角色复制已通过；另六张旧图标基线留存逐像素证据，颜色用例修正 ProseMirror 按组合 mark 拆成多个 span 的测试假设，保留完整文字/RGB 及各样式独立断言。`resourcesRemoved=true`、`cleanupEventVerified=true`；原失败保留。
- `e2e_71f49dfe269fc9e1daa37fae`：26/26 通过。`resourcesRemoved=true`、`cleanupVerified=true`、`cleanupEventVerified=true`。PG 39759，Redis 33465 / `80eeb10b3404d14cacbcb29c173ae8d0209521f3`，API `http://127.0.0.1:37277/api/v1`；数据和上传根目录 `/tmp/wenyousite-e2e-5POhZv` 已清理。

阶段覆盖证据是 `pnpm check` 成功、首轮全套其余通过结果和修复后上述 26 条通过的组合；不是一条 `pnpm check:full` 全绿记录。运行时代码与首轮完整检查、完整 E2E 的代码一致，后续只修改测试和测试报告字段。

颜色浏览器用例通过实际接口保存主题正文与楼层，验证 RGB、粗体/斜体/删除线/普通链接及 href/行内代码、编辑保存后再次打开、站内 HTML 复制与粘贴、草稿恢复和旧端去色读取/覆盖拒绝。旧客户端能力与 Markdown v6 能力独立传递。该轮截图视口 1280×720，裁取阅读楼层与编辑区：
`.e2e-results/e2e_71f49dfe269fc9e1daa37fae-text-color-{light,dark}.png` 和 `-text-color-editor-{light,dark}.png`。目视发现测试切换 CSS class 未触发本站 data-theme，故这一轮截图不作为暗色证据。后续已改用实际外观菜单并断言 data-theme。

补充主题验证 `e2e_69c56ee55910133c88acc703` 因测试误用“白天”而实际菜单为“亮色”超时失败；真实清理事件已核验，`resourcesRemoved=true`、`cleanupEventVerified=true`。该失败仅涉及测试定位，随后依据正式 Foundation 标签修正。

## 合入并行阅读修复

交付前更新远端后，将本批基线固定为 `3f7eec4cbb6fc7069163b2a9a1717fdc1132ec88`（PR 71，保留换行后的作者空格），通过合并提交 `9848ae0819256428936130e30aecdf8e4774c9c6` 保留双方改动。自动合并无冲突，独立复核颜色节点跳过规则与新的内部换行节点均存在。此后不继续追逐新 dev。

最终树 `pnpm check` 全部通过：383 个测试文件、5,021 项测试，以及安全审计、lint、类型、契约、架构、Foundation、文档和生产构建。新隔离入口重跑 `text-color.spec.ts` 与 `editor-alignment-compatibility.spec.ts`，`e2e_da5b6f5847832ba2942746ba` 共 17/17 通过，`resourcesRemoved`、`cleanupVerified`、`cleanupEventVerified` 均 true。PG 34635，Redis 35821 / `25190402d9450b46351f93cbc546174a603942ff`，API `http://127.0.0.1:44541/api/v1`，根目录 `/tmp/wenyousite-e2e-OaNAZe` 已清理。旧结果仅对应上文阶段源码。

最终明暗画面使用实际外观菜单，“亮色”与“黑夜”均断言 HTML 的 `data-theme`；RGB 值及完整组合格式一致。源码 `9848ae0819256428936130e30aecdf8e4774c9c6`，视口 1280×720，截图文件名为 `e2e_da5b6f5847832ba2942746ba-text-color-{light,dark,editor-light,editor-dark}.png`，哈希及各轮摘要见 [脱敏证据](text-color-v1-evidence.json)。画面已由 agent 目视核对，待负责人验收。

## 陈旧视觉基线

基线 `469dab1` 已包含 `56c4884`，将工具箱导航由 `content.layers` 改为 `content.category`。旧管理页快照来自 `82b58b1871ecd24f6cdb82463a255d2b1e4a603f`。Foundation `v7.2.1` 与 `v7.4.0` 的相关映射、SVG 节点和样式一致，组合 SHA-256 为 `56762c90c9c01709f2c2c692f4253ead82627cb9ca1b933c9231c55450e01e3b`，因此此差异不是本次 Foundation 升级引入。

根任务根据已合并 dev 的事实独立目视复核，仅定向校正已经证明为同一图标差异的快照，不修改产品 UI、不批量接受快照。这不是负责人对新 UI 的视觉验收。八张快照逐张核验：管理页与动态详情各 121 个比较器差异像素；首页 1024/1440/1920、创建页和私聊页各 121，黑夜首页 120。后六张图标之外的原始像素差均为 0；管理页图标外最大通道差 2，属于未被比较器判为差异的抗锯齿。原失败及 actual/expected/diff 保存在本轮 `.e2e-results`。

## 待验收

App 候选 21 条真实编解码输出已通过 Milkdown 再保存（Web `0b3d904cb92de2ffc70e658e06f5730b8d6ea806`），返回 `mobile-web-text-color-output.json`，SHA-256 `36d69b861c0bbd95bd9fbfedfb4cfa283e17f8acbcb26fa234e8b709abba7b2c`；Mobile 实际反解及再次 flush 的 21/21 也已通过，待最终提交绑定。并行 reader 合并未改变 Web codec。取色、320/360dp、大字号、输入法与真机半屏高度属于 Mobile 验收；Web 本仓库不提供对应交互。

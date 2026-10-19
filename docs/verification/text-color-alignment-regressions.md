# 对齐与文本颜色的消费者回归

## 范围与版本

本轮只补 Web 永久测试、测试配置和记录，没有修改生产解析、渲染、保存、API 或 UI。基线为 `origin/dev` 的 `e262eb6b7b93901d4a12f7bc6f5a96c12065a298`，保留已合并的音频及工具栏变更；分支 `codex/20261017-text-color-alignment-regressions`。复用已核验干净、无活跃进程的原 Web 任务 Worktree，保留旧任务分支和待验收产物。

契约仍为 Backend `7f95563edd8f461ebb7a66d7b458ec0349e39297` 的 OpenAPI `5.39.0-dev.20261017.1`，Foundation 正式 `v7.4.0`。本轮不改契约或依赖。Auto-review 默认偏好已传递；工具没有配置入口，实际 `approval_policy=never`，不声称已经启用 Auto-review。

## 补齐的覆盖空白

用户在 App 真机执行“居中、整段选中、预设色”时触发 `markdown.document_roundtrip`。Mobile 在自身对齐入口修复；Web 只读复核未发现产品缺陷。先前 21 条 App → Web → App 联验确实通过，但 Web 测试入口仅装颜色相关插件，没有 alignment parser/schema，且输入没有该组合，因此不能作为对齐与颜色兼容的证据。原始记录保留在[文本颜色验证](text-color-v1.md)。

本轮将生产对齐 parser/schema 与序列化器的配置顺序提取为测试共用配置，并补入原跨端导入入口；导入软换行同样使用生产插件。比较时仅忽略不写入 Markdown 的 heading 自动 id 和语法定界符，继续保留标题级别、对齐、文字、颜色、组合格式和链接属性。

永久用例共 78 个合法输入：

- 真机报告的原文 `[wenyousite-align-v1-center]: #` 紧接彩色“如何呢”：1 条。
- 左/中/右对齐 × P/H2/H3 × 普通文字、粗体、斜体、删除线、普通链接、代码、粗斜体、多种格式分段：72 条，含中文、emoji、组合字符。
- 段内软换行、多个不同对齐块、颜色边缘空格及无色后缀：3 条。
- 前段与 center/right 标记之间没有空行：2 条。保存可规范化块间空行，但标记必须仍属于目标段落。

每个用例独立声明完整预期。实际 Milkdown 文档与真实 `MarkdownContent` DOM 分别检查文本、RGB、每项样式、链接 href/title、块类型与对齐，不以保存前后相同作为唯一依据。整段案例移除并重加颜色后再次检查其他格式和选区；全部合法输入检查保存重开及第二次保存幂等。

两空格硬换行另列 1 个负例，带色与无色对照均被现有 `hard-break` 限制拒绝。该限制未因本轮改变。

## 运行记录

临时探针在已提交 Web `5231f0fd11f37624b16f96c078ce4f49dac79447` 上通过 79/79（78 合法 + 1 负例）；既有五文件测试通过 248/248。临时输入由 Web 构造，不能称为 App 原始输出。供 App 复读的 `/tmp/web-color-alignment-regression-20261017.json` SHA-256 为 `9803d936cad68838fceae298899ffc942ce9afb9fa2483f3e1165f70ac1b588e`。该历史证据不能替代新基线验证。

新基线定向永久测试已通过 108/108（新 79 条和原颜色文件 29 条）。运行日志 `/tmp/web-alignment-permanent-targeted.log`；测试进程成功，外层取退出码命令因 PowerShell 字符转义错误返回非零，此包装失败单独保留，后续完整检查使用正常退出码透传。

首次完整检查在类型阶段发现测试共用能力对象被推断为 number，现已用字面量类型固定 textColorVersion=1；失败日志 /tmp/web-alignment-permanent-check-failed-type.log 保留。
最终 `pnpm check` 已通过：396 个测试文件、5,274 条用例，覆盖率门禁、安全审计、lint、类型、契约、架构/设计、部署前置、文档及生产构建均成功；日志 `/tmp/web-alignment-permanent-check.log`。检查固定 `WENYOUSITE_BACKEND_ROOT=/srv/wenyousite/wenyousite-backend` 与 `BACKEND_CONTRACT_REF=7f95563edd8f461ebb7a66d7b458ec0349e39297`，仅对该进程移除代理变量执行安全审计，未修改全局配置。

六文件离线测试另通过 405/405：既有五文件 248 条、新矩阵与负例 79 条、通过修正入口额外导入 78 条。日志 `/tmp/web-alignment-permanent-import.log`。新基线输出的全部 78 个 `{id,source,saved}` 与上述临时产物逐字一致，没有以相同语义代替字节核验。治理任务随后报告 Mobile 复读通过 101/101（原 23 + 本轮 78）；此处只登记外部消费者回报，Mobile 的精确源码和设备证据由治理任务维护。提交后仍以同一永久入口导出最终产物，记录精确 HEAD、干净状态与 SHA-256，结果在 PR 及治理交付中绑定。
没有启动前后端服务，没有登录或业务写入，未创建 PostgreSQL、Redis、上传或测试账号资源，因此没有写入 E2E 清理记录。本轮为测试与文档变更，不运行无关线上或隔离写入验收；既有隔离 E2E 结果仅属于原颜色功能交付，不能记作本轮执行。

浏览器/真机画面、输入法、App 取色交互及 Backend 旧端投影不在本次离线 Web 回归范围。App 复读结果与本地 Web 执行分开登记，未将未执行矩阵写为通过；未授权合并或部署。

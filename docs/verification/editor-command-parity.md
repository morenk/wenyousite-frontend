# Web 编辑器命令跨端核查

## 依据与范围

修改前核查基于 Web `6c476dd63086f84a916b99c3be74fdfc29b13236`、Mobile `7f0c6417b4d140167ae64b3ec5a32d2f5b701759`。Mobile 仅通过 Git 已提交内容只读参照，未运行 Flutter 或修改 Mobile、Backend、Foundation。用户在引用修复基础上授权一并统一有明确依据的编辑行为；平台布局和未暴露的历史底层命令不按源码实现方式强行统一。

Mobile 主要依据：[`editor_format_policy.dart`](https://github.com/morenk/wenyousite-mobile/blob/7f0c6417b4d140167ae64b3ec5a32d2f5b701759/lib/features/editor/presentation/editor_format_policy.dart)、[`editor_toolbar.dart`](https://github.com/morenk/wenyousite-mobile/blob/7f0c6417b4d140167ae64b3ec5a32d2f5b701759/lib/features/editor/presentation/editor_toolbar.dart)、[`rich_editor_session.dart`](https://github.com/morenk/wenyousite-mobile/blob/7f0c6417b4d140167ae64b3ec5a32d2f5b701759/lib/features/editor/presentation/rich_editor_session.dart)；混合格式判定另核对仓库内 vendored Flutter Quill 的 `Line.collectStyle`（所选文字共同属性）。

## 修改前发现与处理

| 功能 | 已提交行为对照 | 本次处理／保留原因 |
| --- | --- | --- |
| 引用 | Web 主栏 `wrapInBlockTypeCommand` 与更多 `wrapInBlockquoteCommand` 均按整个文本块包裹，不能取消；Mobile `_toggle(Attribute.blockQuote)` 以行属性切换并清除旧块样式 | 统一为逻辑行添加／取消；三入口共享命令；排除恰落在下一行起点的终点 |
| 标题／正文 | Web 顶层按整块转换，嵌套回退原命令而保留旧容器；Mobile `applyHeading` 清除所选行的标题、列表、引用和缩进后设置目标 | 与引用共用选行、拆分及提取；不留下引用内标题或选中行的列表容器；保留合法对齐 |
| 对齐 | Web `selectedTopLevelBlocksByKind`、Mobile `MarkdownDeltaAlignment` 均以协议中的完整段落为单位；不支持引用、列表和空段，图片由 v5 门控 | 保持段落语义；修复 Web 终点恰落在下一段起点时误纳入下一段。历史段内 LF／Shift+Enter 不拆成独立对齐行 |
| 粗体／斜体／删除线／行内代码 | Web 原 `toggleMark` 遇到任一已带格式文字就取消；Mobile 仅在整个选区具有共同属性时取消 | 混合选区统一应用、再次取消；保留其他 marks、文字空白和后续输入；忽略原子节点与不允许该 mark 的文字块 |
| 颜色／字体 | 两端区分选区与后续输入、维护弹层选区和原子内容边界 | 保留现有命令；增加块转换后颜色、字体、代码及链接叠加保留回归 |
| 链接 | Mobile 自有显示名／URL 面板并检查文档签名；Web 使用 Milkdown 浮层。Mobile 站内引用为嵌入投影，Web 为链接 mark／视图 | 保留平台编辑界面和投影方式，共用既有安全 URL 与保存协议；不凭实现方式不同认定缺陷 |
| 列表 | 两端隐藏列表创建入口，保留历史解析、保存与编辑；底层分别为树和行属性 | 所选列表行转引用／正文／标题已处理；未选内容和相邻列表保留。未暴露的列表创建快捷键及历史缩进仍沿用既有实现，不增加可见能力 |
| 分隔线 | Web 主栏直接替换选区；更多的 `insertHrCommand` 另插段落并把光标放在不一致位置；Mobile 在精确范围插入独立分隔线并定位后续正文 | 统一命令、清除分隔线的旧引用／列表容器，后续文本可直接输入，保留原有块样式，不额外插入作者空行；未使用的末尾输入段不入保存 |
| 普通换行 | 两端已有 newline v1 revision 2，共同覆盖普通 Enter、空行、引用不自动退出；标题／列表按原有规则续行 | 保持协议与既有测试，不改变换行命令 |
| 清除格式 | 两端没有“清除全部格式”入口；正文选项清除块格式，行内格式分别切换 | 统一正文选项的行级范围及旧容器清除；保留行内格式，不添加新入口 |
| 撤销／重做、选区 | Web ProseMirror transaction mapping／history；Mobile `EditorSelectionHistory`／`runEditCommand` | 块转换在单一事务中映射正反向选区及存储 marks；菜单切换与历史分别回归，不要求两端采用同一历史实现 |

Mobile 对照测试包括 `editor_format_policy_test.dart`、`editor_toolbar_commands_selection_cases.dart`、`editor_quote_paragraph_boundaries_test.dart`、`editor_selection_history_test.dart`、`editor_enter_newline_test.dart` 和 `editor_alignment_compatibility_test.dart`（均位于上述 Mobile 提交的 `test/features/editor/`）。

## Web 回归依据

- [真实 Milkdown 命令用例](../../src/components/editor/__tests__/editor-quote-lines.test.ts)：旧实现先运行 3 个核心用例均失败，证明同段首尾行被错误纳入；修复后覆盖局部／空选区、跨行、反向终点、已有引用、取消与 lazy continuation、空行、列表与标题混选、对齐、颜色／字体／代码／链接保留、分隔线、保存重开与历史。
- [行内样式边界](../../src/components/editor/__tests__/editor-inline-style-boundaries.test.ts)：四种格式的混合文字／空白／链接／换行／原子节点及禁止 mark 的块；仅原子选区不产生事务。
- [真实宿主入口](../../src/components/editor/__tests__/milkdown-editor-toolbar.test.tsx)：主栏、更多和引用快捷键范围相同、保留选中文字并可取消；既有工具栏、对齐测试一起运行。
- [浏览器用例](../../e2e/editor-alignment-compatibility.spec.ts)：逻辑行命令的 DOM 选区、三入口、保存、重开、撤销重做及混合粗体／分隔线。使用统一隔离 runner，保存链路采用合成 API fixture，不把 fixture 验收表述为真实后端持久化测试。

## 验收边界

本次不改变共享协议、API 或清洗白名单。Mobile 在 VPS 为只读参照，Android 真机及负责人交互观感仍待验收。列表父项转为普通块时，失去父项的后续子列表按 ProseMirror 标准提取规则提升，文字和行内格式保留；历史列表创建／缩进的所有跨端序列未在本次穷举。颜色、字体、链接既有全部异步竞态也不由本次局部回归证明完全等价。

# 花体字数据契约 v2

花体字为 Web 与 Flutter 本地工具数据，使用[本数据 MIT 许可](../../src/lib/tools/LICENSE.fancy.txt)，随 Web 分发 /licenses/fancy.txt；不新增 Backend/OpenAPI、Foundation Token 或共享渲染协议。只读取已提交的完整 Web SHA，不能复制未提交源码。

## 文件与格式

- 数据：[fancy-data.json](../../src/lib/tools/fancy-data.json)，schemaVersion 为 2，dataVersion 为 fancy-v2；defaultStyleId 为 script（Web 既有默认值），Mobile 保留原 bold 默认。
- 清单：[fancy-manifest.json](../../src/lib/tools/fancy-manifest.json)，files 含 path/sha256，消费者逐个验证。
- 固定向量：[fancy-fixtures.json](../../src/lib/tools/fancy-fixtures.json)，cases 含 id、styleId、input、expected。原 v1 的 240 个向量原样保留，追加新字形/特效的完整字母数字表、Hello Symboldb 对照、中文/组合重音/emoji/旗帜/键帽、CRLF/CR/LF、纯空白与空输入，另覆盖全部 49 个 Hello Wenyou 可见示例，共 352 例。
- 实现：[fancy.ts](../../src/lib/tools/fancy.ts)。预览和生成均为真实 Unicode 字符，不依赖字体下载、图片或 HTML 标签。

四类按 font（字体）、symbol（符号字形）、effect（文字特效）、decoration（边框装饰）展示。原 40 个样式 ID 与转换输出保留，只调整分类；旧 v1 依赖 SHA 不变。伪哥特与参考的怪异体使用同一字形表，合为一款，不增加重复选项。

styles 由稳定 id、label、category、kind、previewInput、preview 组成；map 额外有 mapping 字符字典与可选 reverse；mark 有 mark 或 markPatterns；wrap 有 prefix/suffix。映射字典已展开 Unicode 数学字母的非连续例外，消费者不得另用连续偏移覆盖字典。preview 必须等于 previewInput 的实际转换，所有用户可见样例统一使用 Hello Wenyou，Hello Symboldb 仅保留于内部参考回归向量。样式名和预览分行，组合标记预览与结果保留足够行高和上下空间。

blankLineCodePoints 为统一的空白行判定码点集（ECMAScript WhiteSpace/LineTerminator），消费者必须使用此集合，不使用语言自带 trim 代替；U+0085 不在集合内，U+FEFF 在集合内，固定向量覆盖这一区别。分类内按数据顺序展示，切分类选择该分类首项，切分类或样式清空旧结果。工具统一名为“花体字”，复用既有设置选择与结果复制，不添加副标题。

## 参考方向对应

| 参考方向 | 稳定 ID | 行为 |
| --- | --- | --- |
| 下标 | subscript | 保留已支持下标，缺字原样 |
| 上加点 | dot-above | ASCII 基字后加 U+0307 单点 |
| 下加点 | dot-below | ASCII 基字后加 U+0323 单点 |
| 伪草书体 | pseudo-script | 混合希腊、西里尔等相似字形 |
| 伪哥特体／怪异体 | pseudo-fraktur | 彝文等细长符号字形 |
| 故障伪体／故障体 | glitch | 货币与划线字形 |
| 气泡伪体 | bubble-pseudo | 圆润的相似符号，不是给字母套圆圈 |
| 酷炫伪体 | radicals | 偏旁相似字形 |
| 诅咒体 | cursed | 带钩、重音的相似字形 |
| 删除线 | strike | 保留原 ASCII 删除线 |
| 下划线 | underline | 保留原 ASCII 下划线 |
| 倒置体 | upside-down | 保留原逐行字符逆序与翻转映射 |
| Zalgo | zalgo | 确定性的上、中、下多方向组合干扰 |

符号字形映射经参考站 [fancy](https://symboldb.org/zh/font-generator/fancy/) 与 [cool](https://symboldb.org/zh/font-generator/cool/) 的公开输入输出逐字核对，输入为完整大小写字母、数字与 Hello Symboldb。采用对应字符形态，不复制其页面、营销文案、脚本或字体文件；上下点完整覆盖 ASCII，Zalgo 自定义稳定组合，不照搬随机结果。

## 转换规则

输入上限 10,000 个 UTF-16 单位，先校验上限，再校验样式 ID；错误分别为“请将输入控制在 10,000 个字符以内”“请选择有效的文字样式”。空字符串输出为空。换行使用 CRLF、CR、LF 原分隔符，分行处理，保留所有空行。outputLimit 为 100,000 个 UTF-16 单位，结果超出时报“生成结果超过长度上限，请缩短输入”。

map 按完整 Unicode grapheme 处理：完整单元直接匹配字典；ASCII 英文字母后仅跟 Unicode Mark 的单元，对首字母转换并原样保留后续组合重音，兼容旧七款输出；其他未命中单元原样保留，键帽、emoji 肤色、旗帜、ZWJ 不拆开。reverse 为 true 时逐行倒转 grapheme 顺序后执行同样映射，不倒转换行顺序。

小型大写 Q/q/X/x、上标 Q/q 缺少可靠字形时原样保留；下标仅覆盖 aehijklmnoprstuvx 的大小写与数字，其余原样保留。方框字、上下标与小型大写的有效映射合并字母大小写。倒置字对英文大小写使用同一组近似翻转字形，中文与 emoji 仅随行内顺序翻转，字符本身保留；不声称排印字体或完整镜像。

mark 只处理单个 ASCII A–Z/a–z/0–9 grapheme；中文、其他文字、已有组合重音、emoji、标点和空白原样保留，避免 CJK 字体显示分离方框或拆开复合字符。给定 markPatterns 时，按 ASCII 码点对数组长度取模选定组合，否则使用 mark；不使用随机数或整串位置，因此相同字符始终稳定。maxMarksPerCharacter 为 3，追加前按码点截取最多 3 个标记。Zalgo 每组包含上、中、下方向标记；10,000 个 ASCII 字符的最大输出为 40,000 个 UTF-16 单位。

wrap 逐非空白行添加前后饰，不装饰空行或纯空白行，行内首尾空白保留。结果只复制纯文本；各设备字形覆盖和读屏/搜索兼容性可能不同。Web 缺少 Intl.Segmenter 时 map/mark 明确提示升级，不降级拆字；wrap 和空输入仍可用。静态 preview 不调用分段 API，旧浏览器可正常加载表单并获得生成错误反馈。

## 起名时间排序

进阶起名风格只在展示副本按 period.from 升序、period.to 升序排列，同时间范围按原序稳定排列，未声明 period 的项放最后并保持原序。六国史实/文学均遵循此规则，使用数值年份，公元前年份仍正确比较。不得重排源数据；默认风格仍由原数据首项决定，不影响随机序列、固定样例或已有姓名生成语义。

## 码点参考

数学字母码点参考 Unicode 的[数学字母数字符号](https://www.unicode.org/charts/PDF/U1D400.pdf)与[类字母符号](https://www.unicode.org/charts/PDF/U2100.pdf)。

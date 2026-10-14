# 花体字数据契约 v1

花体字为 Web 与 Flutter 本地工具数据，使用[本数据 MIT 许可](../../src/lib/tools/LICENSE.fancy.txt)，随 Web 分发 /licenses/fancy.txt；不新增 Backend/OpenAPI、Foundation Token 或共享渲染协议。只读取已提交的完整 Web SHA，不能复制未提交源码。

## 文件与格式

- 数据：[fancy-data.json](../../src/lib/tools/fancy-data.json)，schemaVersion 为 1，dataVersion 为 fancy-v1；defaultStyleId 为 script（Web 既有默认值），已有消费者可保留本端既有默认值。
- 清单：[fancy-manifest.json](../../src/lib/tools/fancy-manifest.json)，files 含 path/sha256，消费者逐个验证。
- 固定向量：[fancy-fixtures.json](../../src/lib/tools/fancy-fixtures.json)，cases 含 id、styleId、input、expected，覆盖 40 样式的字母数字全集、混合中文/组合重音/emoji/旗帜/键帽、CRLF/CR/LF、纯空白和空输入，共 240 例。
- 实现：[fancy.ts](../../src/lib/tools/fancy.ts)。预览和生成均为真实 Unicode 字符，不依赖字体下载、图片或 HTML 标签。

categories 为 font（字体）、decoration（装饰），每类 20 种。blankLineCodePoints 为统一的空白行判定码点集（ECMAScript WhiteSpace/LineTerminator），消费者必须使用此集合，不使用语言自带 trim 代替；U+0085 不在集合内，U+FEFF 在集合内，固定向量覆盖这一区别。styles 由稳定 id、label、category、kind、preview 组成；map 额外有 mapping 字符字典与可选 reverse；mark 有 mark；wrap 有 prefix/suffix。映射字典已展开 Unicode 数学字母的非连续例外，消费者不得另用连续偏移覆盖字典。

preview 使用字体 Abc123、装饰 温油 Abc 的固定转换结果；仅展示样例，不进入用户结果。分类内按数据顺序展示，切分类选择该分类首项，切分类或样式清空旧结果。工具统一名为“花体字”，复用既有设置选择与结果复制，不添加副标题。

## 转换规则

输入上限 10,000 个 UTF-16 单位，先校验上限，再校验样式 ID；错误分别为“请将输入控制在 10,000 个字符以内”“请选择有效的文字样式”。空字符串输出为空。换行使用 CRLF、CR、LF 原分隔符，分行处理，保留所有空行。

map 按完整 Unicode grapheme 处理：完整单元直接匹配字典；ASCII 英文字母后仅跟 Unicode Mark 的单元，对首字母转换并原样保留后续组合重音，兼容旧七款输出；其他未命中单元原样保留，键帽、emoji 肤色、旗帜、ZWJ 不拆开。reverse 为 true 时逐行倒转 grapheme 顺序后执行同样映射，不倒转换行顺序。

小型大写 Q/q/X/x、上标 Q/q 缺少可靠字形时原样保留；下标仅覆盖 aehijklmnoprstuvx 的大小写与数字，其余原样保留。方框字、上下标与小型大写的有效映射合并字母大小写。倒置字对英文大小写使用同一组近似翻转字形，中文与 emoji 仅随行内顺序翻转，字符本身保留；不声称排印字体或完整镜像。

mark 只给单个 ASCII 字母 A–Z/a–z 或数字 0–9 组成的 grapheme 追加一个标记；中文、其他文字、已有组合重音的多码点单元、emoji、标点和空白不追加，避免 CJK 字体显示分离方框或拆开复合字符。中文装饰使用 wrap。wrap 逐非空白行添加前后饰，不装饰空行或纯空白行，行内首尾空白保留。结果只复制纯文本；各设备字形覆盖和读屏/搜索兼容性可能不同。

Web 缺少 Intl.Segmenter 时 map/mark 明确提示升级，不降级拆字；wrap 和空输入仍可用。静态 preview 不调用分段 API，旧浏览器可正常加载表单并获得生成错误反馈。

## 起名时间排序

进阶起名风格只在展示副本按 period.from 升序、period.to 升序排列，同时间范围按原序稳定排列，未声明 period 的项放最后并保持原序。六国史实/文学均遵循此规则，使用数值年份，公元前年份仍正确比较。不得重排源数据；默认风格仍由原数据首项决定，不影响随机序列、固定样例或已有姓名生成语义。

## 参考

码点参考 Unicode 的[数学字母数字符号](https://www.unicode.org/charts/PDF/U1D400.pdf)与[类字母符号](https://www.unicode.org/charts/PDF/U2100.pdf)。本项目只编写字符映射及装饰组合，不复制参考网站页面、文案或字体文件。

# 进阶姓名数据契约 v2

本契约用于 Web 与 Flutter 本地起名。普通 v1、历史 v1 文件和生成 API 保持不变；不新增 Backend/OpenAPI 或 Foundation 接口。

## 数据与交接

- 数据：src/lib/tools/advanced-name-data.json，schemaVersion 为 2。
- 清单：src/lib/tools/advanced-name-manifest.json，files 是 path/sha256 对象数组；ordinaryDataRevision 与 historicalDataRevision 分别锁定普通和历史基础版本。清单不计算自身摘要。
- 样例：src/lib/tools/advanced-name-fixtures.json。所有样例绑定同一 dataVersion，randomValues 循环使用。
- 许可：src/lib/tools/name-data/LICENSE.advanced-names.txt，同时随 Web 分发 /licenses/advanced-names.txt。
- 消费者只能读取完整已提交 SHA，校验清单内每个文件；可生成本地常量，不引入运行时网络或翻译服务。逐来源许可与须保留的署名随包保留。

v2 收录六国 52 个风格：历史 v1 的 22 个时代/家族范围转换为兼容风格，另新增 12 个有独立史料词池的方向和 18 个文学方向。新增部分有 364 个给名槽位、183 个姓氏条目；不代表全部历史或人口常见频率。

## Schema

顶层字段为 schemaVersion、dataVersion、translationPolicy、sources、styles。

来源字段为 id、title、url、publisher、license、usePolicy、attribution、provenance。usePolicy 只允许 fact-reference-only、licensed-reuse、original-composition。原文使用现代通行拼写；中文是编辑参考译名，非唯一官方翻译。

每个 style 有 id、country、mode、label、provenance、sourceRefs、defaultStructureId、structures、given、families，按需有 period、region、identity、patronymics、bynames。country 为 cn/jp/gb/fr/de/ru，mode 为 historical/literary。史实 label 和 period 绑定实际时期，贵族片段不推断爵位资格；文学样式必须标 original-composition。

given 与 bynames 分 male/female 数组。每个词条有 id、original、zh、sourceRefs、attestedAs。family 有 id、forms、sourceRefs、attestedAs；forms 使用 generic 或完整 male/female 配对，俄语预编词形可标 formPolicy=grammar-derived。patronymics 的每项有 id、father、male、female、sourceRefs、attestedAs，均为固定中外对照。

structure 有 id、label、originalTemplate、zhTemplate。两个模板的 token 集必须一致，至少包含 family/given，仅允许 family、given、secondGiven、patronymic、byname。模板不得包含未匹配大括号；必需 token 必须有双性别词池。bynames 与同一性别 given 的原文集合不得相交。史实模式不提供未证实字、号、爵位模板。禁止遗留单数 byname 数据字段；模板 token 本身仍为 byname。

## 生成 API 与确定性顺序

generateAdvancedNames(data, options, random) 独立于普通/历史 v1。options 为 country、mode、styleId、structureId、sex、count，不接受固定姓氏或家族选择。sex 为 any/female/male，count 为 1–50 的整数。

按以下顺序校验，失败前不消耗随机值：

1. count：生成数量须为 1–50 的整数
2. sex：请选择有效的名字性别倾向
3. mode：请选择有效的起名类型
4. country、mode 与 styleId 匹配：请选择有效的起名风格
5. structureId 属于该风格：请选择当前风格支持的姓名结构

每次尝试依次抽取：any 性别（random < 0.5 为 female）、family、given、选中模板需要的 secondGiven、patronymic、byname。确定性 random 在 [0,1)，索引为 floor(random * pool.length)。固定性别不抽性别；没有出现在模板中的可选成分不消耗随机值。secondGiven 先排除原文与 given 相同的条目，再仅抽一次。姓和父称使用本次性别的预编形式；不在运行时加后缀。

模板以各部分原文或中文原样替换，不统一调整姓/名顺序或标点。result 包含 original、zh、styleId、structureId、sex、familyId、givenId，以及实际使用的 secondGivenId、patronymicId、bynameId。按完整 original 去重，保留首次元数据，最多 count * 40 次尝试。

小词池可能达不到请求数量。返回实际唯一结果，不凑重复或新增无证词；只有实际结果少于请求时显示“已生成 X 个不重复姓名”，不把抽样结果宣称为绝对容量上限。共享样例覆盖 6×6 单性别池请求 50 个后返回 36 个。

复制全部沿用每行 original（zh）；二者相同只写一次，复制成功提示约 1.5 秒。

## 界面状态

默认是现有普通起名，进阶折叠且不加载大词库。只有六个支持国家显示入口。展开即进阶、收起即恢复普通；不存在第二个历史开关，也不显示进阶姓氏/家族选择。

进阶仅显示“类型”“风格”，风格本身包含有效时期和身份；不再叠加时期下拉。只有当前风格提供多个结构时显示“姓名结构”。展开选择默认类型/风格/结构；切换类型或风格重置不兼容条件与结果。折叠、换国家清空旧结果；普通自定义姓氏、中文风格等用户参数原样保留，不能被进阶输入覆盖。

懒加载过程中折叠或切换国家，旧加载结果不能重新开启进阶或显示过期结果。标题、字段、结果使用常规字重，不添加重复副标题或说明卡片。

## 校验

pnpm tools:advanced-names:check 校验词池、双语、结构、来源及文件摘要；Vitest 使用同一固定 fixtures 校验输出和随机值消耗，另检查风格实际词池差异、可选结构和第一次去重元数据。共享固定数据提交可先供消费者读取；它不代表 Web UI 视觉验收、全量门禁或发布完成。

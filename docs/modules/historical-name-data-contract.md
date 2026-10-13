# 历史姓名静态数据契约

## 范围与兼容

六国十二个有明确时代和地区的姓名片段包：中国明代与清前中期文人、日本明治与大正、英格兰都铎与乔治时代、法国路易十四时期与十八世纪、德国魏玛文化圈与十九世纪普鲁士、俄罗斯帝国十八世纪与十九世纪至1917年。每包至少6个男名与6个女名，数量不代表人口频率、完整历史覆盖或身份鉴定。

历史数据独立于普通姓名 v1。旧 bilingual-name-data.json、name-data-manifest.json、name-fixtures.json、name-inspiration.json、中国 Faker 数据及 generateBilingualNames/generateNames 不变。历史入口使用 generateHistoricalNames，Mobile 仅从已提交 Git SHA 导入本契约及 manifest 的全部文件，转为本地 Dart 常量。没有 Backend API、OpenAPI、数据库、Foundation 视觉 Token 或旧嵌入路由变化，也不清理旧协议。

## 数据文件

- src/lib/tools/historical-name-data.json：schemaVersion 为1、dataVersion、translationPolicy、sources、profiles。
- src/lib/tools/historical-name-manifest.json：schemaVersion/dataVersion、普通依赖数据 SHA、所有内容文件 SHA-256、许可证文件。manifest 自身不递归散列。
- src/lib/tools/historical-name-fixtures.json：循环随机值、输入、完整结果或错误。
- src/lib/tools/name-data/LICENSE.historical-names.txt：原创部分 MIT 与来源署名/条件；消费者必须随包提供。Web 同步 public/licenses/historical-names.txt。

profiles 是有序数组。profile 包含 id/country/label、period（含首尾年的 from/to）、region、namePattern、originalSeparator/zhSeparator、given、families、roles、sourceRefs，以及可选 patronymics。时代范围是片段采集包范围；片段来自范围内使用的人名，生成结果是重组的角色姓名，不表示范围内每一年、每一阶层均使用该组合。无任意年份输入。

given.male/female 为有序条目 {id,original,zh,sourceRefs,attestedAs}。families 为 {id,forms:{generic?或male/female},sourceRefs,attestedAs,lineage?}。lineage 独立保存 label/sourceRefs/evidence，绑定史料中的具体家系，不能从 von/de 等粒子或任意同姓推出贵族资格。家族名称与实际用于姓名的 forms 分开；爵位、领地、氏族、字号不拼入姓名，也没有待填的随机头衔选项。俄语 formPolicy=grammar-derived 表示另一性别形式按语法预先收录，并非逐个历史人物认证。

roles 为 {id:period|lineage,label,familyIds,period?}。period 是时代姓名，不能理解为平民。lineage 仅用明确家系姓氏；中国两包没有此选项。role 的可选 period 收紧 profile 时段：明治华族家系限1884–1912，不回推到1868年。下拉与已启用摘要应显示实际 role 年代/标签。数组顺序是随机与跨端契约的一部分。

patronymics 为 {id,father:{original,zh},male:{original,zh},female:{original,zh},sourceRefs,attestedAs}。首批俄国5对，都是已明确编辑的词形；原始父名与结果父称分开。选中父称表示角色采用此正式姓名结构，不表示生成了某位真实人物的父亲/家谱。未声称帝俄所有阶层强制使用三段式。

namePattern：
- 中国、日本：family,given；原文与中文均无分隔。
- 英国、法国、德国：given,family；原文一个 ASCII 空格，中文间隔号 ·。
- 俄国：given,patronymic,family；原文一个 ASCII 空格，中文间隔号 ·。未启用父称时省略该片段，不留下空格。

## 输入、抽样与结果

独立 HistoricalNameOptions 为 country/profileId/role/familyId/sex/count/includePatronymic。familyId 为空则随机，否则必须属于选定 role 的库内 familyIds。历史不接受任意自由姓或中文覆盖；普通模式继续支持。sex 是 any/female/male；count 为1–50整数。includePatronymic 仅在有父称池时可为 true，UI 进入俄语历史包默认关闭，按需开启。

每次尝试依次抽样：any 性别（随机值<0.5为female）→随机 family（固定库内 familyId 则省略这次随机）→对应性别 given→启用的 patronymic。索引 floor(random*length)，随机值均在[0,1)。俄语同一 sex 选择姓名、姓形和父称形。运行时不猜字、不作音译、不推导姓氏/父称后缀。

按 original 去重，保留第一次产生的全部元数据，最多 count*40 次尝试。可返回不足 count 的结果，界面须提示实际数量。结果为 {original,zh,profileId,sex,familyId,givenId,patronymicId?}，未启用父称时无 patronymicId。复制格式沿用普通：中文仅 zh；原文仅 original；全部每行 original（zh），两者相同则不重复；成功短提示1500ms。

错误按以下顺序校验：数量「生成数量须为 1–50 的整数」；性别「请选择有效的名字性别倾向」；国家/profile「请选择有效的时代与地区」；role「该时代没有此类姓名」；familyId「请选择当前时代收录的姓氏」；无父称池而启用「该时代不支持父称」。跨端 fixture 的 randomValues 循环使用。

## 交互验收

普通起名保持11国，默认快速生成；进阶选项默认折叠、历史模式默认关闭。无历史包的国家不显示进阶控件。展开本身不启用，收起不关闭；已启用时收起行持续显示当前时代与实际身份标签，避免隐藏生效条件。

关闭历史必须清空历史条件和旧结果并回普通。更换国家/profile/role重置不兼容家族、父称及旧结果。首次启用历史重置普通自由姓/中文覆盖及中文风格，后续退出回 common 与随机姓，不能带着隐藏条件生成。仅历史开启时以库内姓氏选择替代普通自由输入。高级字段按实际数据出现，使用折叠设置行，不新增常驻说明卡片。懒加载要处理关闭/更换国家/卸载竞态，旧结果不能恢复已关闭模式。

## 来源、译写与许可

每个 source 记录 id/title/url/publisher/license/usePolicy/attribution/provenance；每个姓名片段、家族、父称有可解析的 sourceRefs 和 attestedAs。未声明开放的网页只作为事实核对，未复制现代传记说明、图片、商业字典或整个名单。已许可复用保留来源条件。中国不使用存在再分发限制的 CBDB 数据。具体许可与署名见随包 LICENSE.historical-names.txt。

translationPolicy=editorial-reference-modern-standard-spelling：按现代通行标准拼写呈现历史用名，非原始手稿拼写或1918年前俄文正字法复原。中文是人工编辑参考，非唯一官方译名。日本采用国立国会图书馆明确汉字，不从读音反推。中国仅重组姓名片段，不把字、号机械接到姓名后。

规则依据包括英国国家档案馆的中世纪姓氏变体提示、英国议会对姓氏/头衔/领地名称的区分，凡尔赛馆方对本名与头衔的分字段记录，德国传记对 Goethe 1782年前后姓名变化的区分，日本1884年华族制度与俄语语法材料。没有将所有 von/de 视为贵族，也未将现代普通池贴时代标签。

- [英国国家档案馆](https://www.nationalarchives.gov.uk/help-with-your-research/research-guides/medieval-early-modern-family-history/)
- [英国议会：Peerages](https://commonslibrary.parliament.uk/research-briefings/cbp-10635/)
- [凡尔赛：Madame de Montespan](https://www.chateauversailles.fr/decouvrir/histoire/grands-personnages/madame-montespan)
- [德国传记：Goethe，自1782年起 von](https://www.deutsche-biographie.de/sfz53095.html)
- [日本国立公文书馆：1884年华族令](https://www.archives.go.jp/ayumi/kobetsu/m17_1884_01.html)

## 验证与发布

tools:historical-names:check 校验版本、文件散列、来源、片段完整双语、双性别可用性、pattern、role/family 引用、家族证据和父称池。Vitest 与 Dart 必须消费同一 fixtures。兼容断言确认普通v1散列不变。静态数据候选可先提交用于固定 SHA 交接；完整 UI 交付仍需仓库门禁与负责人视觉验收，不自动合并或部署。

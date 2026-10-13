# 双语姓名静态数据契约

## 版本与范围

数据由 Web 仓库维护，Mobile 使用已提交 Git SHA 导入，不从运行中的网页抽取，不调用翻译 API。src/lib/tools/name-data-manifest.json 锁定 schema/data 版本、每个内容文件 SHA-256 及许可证。外国名录是人工编辑的常见姓名部件对照，十国每国 20 男名、20 女名、20 姓氏，俄语另有 20 个对应女姓；英美使用相同英语对照。中国保持 Faker 10.6.0 中文数据及原组合规则。

zh 是角色起名用的中文参考写法，不宣称人口频率排名、唯一译名、官方身份或完整法律姓名。日韩每个原文均与一个明确收录的汉字写法配对；韩文同音可能有其他汉字，不根据读音反推特定真人身份。日文使用明确汉字本名与中文简体对照。英、德、法、西、葡同拼写按国家分别译写。原文保留重音和空格，俄语不生成父称，西葡不生成完整双姓结构。

## 文件结构

- bilingual-name-data.json：schemaVersion 为 1、dataVersion、translationPolicy、countries。国家为 jp gb de fr ru us it es kr br；每国有 order（family-given 或 given-family）、originalSeparator、zhSeparator、given 与 family。名字按 male/female 分组；通用姓使用 generic，俄语姓按 male/female 分组，同一索引对应同姓的男女形式；条目固定 {original, zh}，数组顺序属于契约。
- name-data/cn.json：保留 Faker 原 {source, given, family}，部件字符串中文原文即中文结果；按选定性别池回退 generic。
- name-inspiration.json：schemaVersion 为 1，styles.classical/fantasy 各有 starts/male/female 字符串数组。仅中国使用，自编组合，不声称典籍出处或名字寓意。
- name-fixtures.json：固定输入、循环随机值与完整期望输出或错误。所有随机值在 [0,1)。消费者导入后执行这些样例，不能自行改变数组顺序或抽样顺序。

## 组合与校验

输入为 country/sex/style/surname/surnameZh/count。sex 为 any/female/male，style 为 common/classical/fantasy，数量为 1–50 整数，两个固定姓字段最多 40 个 UTF-16 单位且不能含 CR/LF/Tab。非中国仅允许 common。

每次尝试：any 先随机一次（小于 0.5 为 female），未固定姓再随机一次，常见名随机一次；古风/幻想依次随机 starts 和所选性别尾字。索引 floor(random * length)。同一结果的姓、名必须共享性别。中日韩姓在前，不插分隔；其他名在前，原文用一个 ASCII 空格、中文用间隔号 ·。返回 {original, zh}，按 original 去重，保留首次出现顺序，最多 count * 40 次尝试，短缺须告知用户。

固定姓 trim 后原样使用，包括俄语，不能暗改性别词形。仅在当前国家所有姓氏池中，以 trim + lowercase 匹配；不做 NFC 或重音删除，分解重音未匹配时要求用户给中文。已知姓使用词库 zh；未知纯汉字姓原样作为中文；其他未知姓需要非空 surnameZh，且只允许汉字、间隔号 ·/・、连字符和空格，至少包含一个汉字。译名缺失或非法则整次失败，不能输出半中文。调用方仅在未知非汉字姓时显示中文输入；已知姓忽略用户填入的中文覆盖，避免错误译名。

中国输出 zh 等于 original。复制中文仅拼 zh，复制原文仅拼 original，复制全部每行 original（zh）；中国无需重复括注。列表项原文和中文均可选择。

## 来源与许可

外国对照与中文风格组合为本项目独立编辑的角色姓名参考数据，以 [MIT](../../src/lib/tools/name-data/LICENSE.wenyou.txt) 提供。未批量复制商业姓名字典或网页名单，也未采用运行时字母拼接音译。下列材料仅用于译写方法和少量明确样例核对，不是整份词库的逐项认证或授权来源：

- [日本驻华使馆中文大使简历](https://www.cn.emb-japan.go.jp/itpr_zh/taishi_ryakureki_00001.html) 与[日文简历](https://www.cn.emb-japan.go.jp/itpr_ja/00_001149.html)：保留明确的日文姓名汉字，再使用对应中文书写，而非假名猜字。
- [德国驻华使馆中德人物材料](https://china.diplo.de/resource/blob/1506688/5aad1b922009f7a303470f022653b5e4/publikation-tued-data.pdf)：Thomas／托马斯、Ludwig／路德维希等译写样例。
- [意大利文化处展览介绍](https://iicpechino.esteri.it/zh/gli_eventi/calendario/mostra-fotografica-abbracciando-linfinito-leterna-ricerca-di-giuseppe-tucci-2/)：Giuseppe／朱塞佩、Giovanni／乔瓦尼等常见名译写样例。
- [韩文／汉字姓名歧义研究](https://aclanthology.org/Y07-1051.pdf)：韩文同音可能对应不同汉字，不能宣称唯一对应。
- [俄语语法教材](https://is.muni.cz/do/rect/el/estud/pedf/js24/ruska_gramatikaB1/web/pages/topic_09.html)：名与姓的性别形式。

中文 common 继续由 @faker-js/faker@10.6.0/zh_CN 提取，[原 MIT 许可](../../src/lib/tools/name-data/LICENSE.faker.txt) 必须随消费者分发。Web 发布 /licenses/faker.txt 和 /licenses/wenyou-names.txt；Mobile 将两份许可注册到应用许可页。数据校验同时保留原 Faker 导出检查，旧外国 JSON 未删除但新生成器不再消费它们。

本契约为静态客户端工具数据，不涉及 Backend OpenAPI、登录、数据库或 Foundation 视觉 Token；现有嵌入路由继续兼容旧 App。

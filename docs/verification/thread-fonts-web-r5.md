# 帖内字体 Web revision 5 候选

沿用治理任务 `01a15a8c-53c1-7203-a4c5-6c9d5fc731de`、Web 任务 `01a15a9e-fc27-7660-8440-9a49d89b0060`、Worktree `/srv/wenyousite/.worktrees/web-thread-fonts` 与草稿 PR #83。此前证据见 [revision 4](thread-fonts-web-preparation.md)，不能以旧检查冒充新候选已通过。当前审批偏好已传递，工具无配置参数，未声称 Auto-review 已设置或核验。

## 固定来源与范围

- Backend 精确提交 `a192628fc1484990871a8d159a7324446cdf0b05`，API `5.41.0-dev.20261021.2`；仅从提交同步契约和生成类型。
- catalog 1.1.0 共 29 款，`designLanguage` 为 zh13 / ja10 / en6；当前 28 ready，怪盗予告黑体等待 Backend 最终资源锁。小薇从未发布候选移除，无线上迁移。小城授权沿用负责人确认，不要求补造授权文书。
- 正式资产根 `/tmp/thread-font-release-r5-publish`；manifest SHA-256 `e793a3f4674a85840c8da2cd2a5c53f8af62c3c6256a951d269875f4cba2f1e6`，4,802,519 字节。仅核验和读取，没有上传或变换字体。
- Foundation 保持 v7.6.0；原件支持、预算与分组行为见 [正文协议](../modules/markdown-content-protocol.md#文本字体-v1)。预览不是完整产品或真机验收，不合并、不部署、不开启公网写入。

## 实现与验证

选择器按正式主要设计语言分组，最近项不重复；未知分类保留未分类。日文样文包含平片假名，使用实际字符匹配补片。小城仅接受正式 schema 锁定的 TTF、SHA、大小和独立额度；缓存首次注册同样预占，失败不归还，不扩大通用资源限制。

安全补丁后，字体编辑、协议往返、语言分组、可见加载、普通预算、原件预算与缓存，以及此前超时的编辑器边界和工具栏，共 12 个文件、410 项定向测试串行通过；原件伪造、额外额度扩大、MIME/哈希/网络/解码失败、缓存注册与重复调用均有回归。最终 `pnpm check` 全部通过，结果见下文。离线预览继续使用本任务 4317 端口、真实 Web 控件/运行时和已核验资产，无认证或真实 API；分为每会话最多八家族，不能据全目录截图宣称单会话预加载全部字体。

## 安全补丁与中止记录

本轮安全审计发现 markdown-it 14.3.2 受 [多行引用定义解析公告](https://github.com/markdown-it/markdown-it/security/advisories/GHSA-gfr2-rv44-r23c) 与 [行内 HTML 解析公告](https://github.com/markdown-it/markdown-it/security/advisories/GHSA-vfgh-jcmw-g37q) 影响，依赖和锁文件仅更新到修复版 14.3.3。未使用忽略项。

补丁前已启动的隔离候选在构建阶段正常中止，未执行浏览器用例；runId `e2e_85807166dad3c8a5d941b490`，报告 `6623ca6c-43f6-4ef3-a847-7bddc0714ecb.json`，`resourcesRemoved=true`、`cleanupEventVerified=true`。保留失败记录，不计作验收通过；最终检查使用更新后的依赖。

## 真实浏览器资源证据

正式包 870 条 Web 资源描述、869 个唯一对象逐字节核验通过；没有把字体复制进仓库。28 款在 1440×900 / 1024×900、明暗主题下完成实际注册，四个独立会话的测量如下；所有会话均无页面错误或外部/API 请求：

| 会话 | 家族 | FontFace | 请求 | 下载字节 | 原件独立预占 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 | 8 | 8 | 26 | 11,860,129 | 0 |
| 2 | 8 | 14 | 34 | 32,022,109 | 18,410,600 |
| 3 | 8 | 20 | 37 | 9,810,696 | 0 |
| 4 | 4 | 4 | 13 | 4,909,558 | 0 |

最大下载并发均为 2。第二组普通下载为 13,611,509 字节，仍在 16 MiB 内；独立原件额度没有分给其他资源。Chromium CDP 确认既有三款和新增六款日文的样文使用假名补片；小城显示原内部名称，原件没有改名或转换。小城 U+0022/U+0027/U+2018/U+2019、Hachi 的 ゕ/ゖ、英文体中文探针均实际使用系统字形，fontId 保留。包含小城的第二组重开后 0 请求、34 缓存命中，仍预占独立原件额度。

80 段长文只处理可见的 9 段；加载前后可见字符 top 均为 12 px、scrollY 均为 4000，首读 4 请求/5,693,309 字节，重开 0 请求/4 缓存命中。以上不是 RSS 实测，也不代替负责人产品视觉或 Mobile 真机验收。

产物位于当前聊天 `thread-fonts` 目录：`r5-{1,2,3,4}-{light,dark}-{1440,1024}.png`、`r5-real-evidence.json`、`r5-fallback-evidence.json`、`r5-reading-evidence.json` 和 `r5-session.json`。会话记录源码摘要、依赖、固定 manifest、进程与视口；更新依赖后已重拍，主题截图等待控件颜色过渡完成。

## 检查过程记录

补丁后的首轮 `pnpm check` 已通过审计、lint、类型、精确契约、架构和设计检查，覆盖率阶段出现三个编辑器用例超时，随后命令收到 SIGTERM、退出码 143。终止来源尚未确认，不据此判定产品回归或验收通过；当时宿主负载约 14（4 核），本任务没有遗留 Vitest 进程。保留日志 `/tmp/web-thread-font-r5-check-final.log`，待独立 E2E 完成后串行复验；不增加超时或改断言。

串行复验保持现有超时和断言：12 文件、410 项全部通过（55.96 秒），随后重新执行完整门禁；此前中止不作为通过证据。

最终完整隔离 E2E：runId `e2e_511a9e6857a6577dfa77c1a3`，274 项中 267 通过、3 失败、4 跳过，报告 `839a30f8-f65c-408b-b2b4-c35c39626f4a.json`；`resourcesRemoved=true`、`cleanupEventVerified=true`，原资源根已移除。两项长讨论导航失败与 revision 4 的干净基线断点相同；Backend 两版间仅改变字体元数据、相关测试及 OpenAPI，Web 导航代码和用例未变，沿用此前定向基线证据。四项跳过仍为缺原始只读快照的负责人复现套件。

第三项失败是字体用例新增三款字体后仍对通用 locator 使用单元素断言，浏览器实际返回三个均为 fallback 的片段。现逐个验证文楷、小城、Yuji 的回退状态，并补充编辑器中的原件/日文文字断言；末尾继续输入允许继承原字体，保存后检查原文字与 fontId 保留。产品代码未因该用例失败而修改，修复后另行进行完整字体旅程的隔离复验。

本轮安全补丁后的真实 Milkdown 输出共 68 份（34 份带字体），由上述固定 Backend 提交纯函数验证严格解析、新写与关闭字体/颜色新写时的保源，全部通过；无数据库或 API 连接。证据为 `r5-web-exports.json` 与 `r5-backend-read.json`，不代替 Mobile 互读验收。

最终串行 `pnpm check` 通过：420 个测试文件、5,568 项测试，覆盖率满足仓库阈值（总体 statements 87.93%、branches 81.29%、functions 86.43%、lines 91.60%）；审计、lint、类型、精确契约、架构、Foundation、文档、部署预检及生产构建全部通过。构建字体门禁扫描 3,344 个文件通过。日志 `/tmp/web-thread-font-r5-check-serial.log`；生产源码未因后续字体 E2E 断言修正而改变。

字体旅程修复后隔离复验通过：runId `e2e_28baefd76beb97df5b88a17c`，报告 `474526b0-feaa-47ff-8873-5d1d7549bfe4.json`，1 项完整旅程通过，覆盖目录分组、显式预览、撤销恢复、真实创建/保存/编辑、小城与日文内容、旧端降级和覆盖拒绝、复制粘贴、草稿恢复；`resourcesRemoved=true`、`cleanupVerified=true`、`cleanupEventVerified=true`。完整轮次及复验报告另存本聊天 `r5-full-e2e.json`、`r5-font-e2e-recheck.json`。

最终按仓库既有失败例外交付草稿：字体用例已复验通过，两项长讨论基线问题仍保留，不宣称 `pnpm check:full` 全绿。负责人产品视觉验收与怪盗最终资源锁仍待完成；不合并、不部署、不发布资源或开启公网新写。

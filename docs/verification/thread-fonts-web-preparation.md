# 帖内字体 Web revision 4 验收记录

本页保留 `8f3a4f4` 的历史证据；后续目录与原件接入见 [revision 5 记录](thread-fonts-web-r5.md)。

治理任务 `01a15a8c-53c1-7203-a4c5-6c9d5fc731de`，Web 任务 `01a15a9e-fc27-7660-8440-9a49d89b0060`。本轮已完成正式协议与资源接入及 `pnpm check`；完整隔离 E2E 有两项经基线复现的既有失败，按仓库例外交付草稿，负责人视觉验收待完成；未合并、部署、发布字体资源或开启公网新写。

## 来源与边界

- VPS Worktree `/srv/wenyousite/.worktrees/web-thread-fonts`，分支 `codex/20261021-thread-fonts-web`，基线 `77d08749e1cd3dc89e7620e9bba476036640522f`。原宿主 Worktree 保留。
- Backend 已提交 `1cf51dd752a98e3733f3dc0c83b17add75be7e46`，API `5.41.0-dev.20261021.1`；同步器与生成器读取同一精确提交。
- Foundation 保持正式 `v7.6.0`，revision `1bbd5a5476b50c51d2bba1f2a218f9408a852c4a`，不使用其他任务未提交代码。
- 正式资产根由治理明确授权为 `/tmp/thread-font-release-publish`。Web 逐字节核验 manifest、许可/归属与 WOFF2 的 695 条描述（694 个唯一对象），未转换字体；源包研究小样不作生产资源。
- manifest：3,207,159 字节，SHA-256 `ad22427e048b90f798bddafc308195786600ee006459f54144610d1bbe35d5c3`。完整清单只作契约快照，不进入浏览器应用 bundle。
- 宿主当前 `never` / `danger-full-access`，不是已核验的 Auto-review；未改写用户审批配置。

## 名单与实现

目标为用户 revision 4 的 17 款，目录中 16 款 ready。小城拉风体使用授权依据是负责人本轮确认，非 OFL，仍缺源文件，保持 pendingSource；未取得修改授权前不改名、子集化或转换。派生文楷菜单使用“文楷”，原始 RFN 只保留在归属中。移除的怪聞書没有进入正式 ID，不补足 30 款。

已接入严格字体/颜色共同 span、真实 Milkdown marks 和往返保护、选区/持续输入/撤销、正文样式菜单、阅读、clipboard v2、草稿与 API 能力冻结。字体清除不改变颜色；支持能力丢失阻止覆盖，资源失败只影响显示。阅读/预览按可见文字选片，按哈希共用下载、注册与缓存；先核验许可、体积、MIME、哈希，再注册 unicodeRanges。预算和来源约束见[正文协议](../modules/markdown-content-protocol.md#文本字体-v1)。

## 真实字体预览

离线组件服务 `/tmp/web-thread-fonts-preview/serve.mjs`，`127.0.0.1:4317`；页面 `/?group=1`、`/?group=2` 每次文档会话各展示八款。使用本 Worktree 的真实控件、加载器与 Foundation Token，通过注入传输映射到已核验本地对象；无认证 Provider、真实 API 或上游字体请求。该离线画面不代替真实 API 保存验收。

`capture-real.mjs` 生成 `real-{1,2}-{light,dark}-{1440,1024}.png` 八张画面及 `real-evidence.json`。自动拦截只放行本任务 loopback 来源，Chromium CDP 记录每个中文/英文片段实际使用的字体，全部 16 个 core 成功注册，无页面错误或外部请求。

| 独立会话 | 请求（含 manifest/通知） | 实际下载字节 | 家族/FontFace | 最大并发 |
| --- | ---: | ---: | ---: | ---: |
| 第一组八款 | 26 | 10,429,601 | 8 / 8 | 2 |
| 第二组八款 | 27 | 10,903,415 | 8 / 8 | 2 |

BOOTH 部分汉字确实使用系统回退；敬峰中山王篆英文使用系统字体，数字使用原字库。以上为实际字形检测，不将混排伪称全字库覆盖。下载字节和解码输入不等于进程 RSS；设备峰值及负责人观感仍待验收。

## 检查状态

`pnpm check` 已通过：418 个测试文件、5,541 项测试，覆盖率满足仓库阈值；包括安全审计、lint、类型、契约、架构、设计、文档、部署预检和生产构建。生产字体产物扫描 3,344 个文件通过；完整 manifest 和源字体二进制未进入应用 bundle。

真实 API 验收统一使用 Backend 上述精确提交的正式隔离 runner、专用 PostgreSQL/Redis 二进制与本轮资源登记；候选使用 `.next-e2e`，未接触公共服务登录或写入。首次缺工具路径在资源就绪前退出，没有执行用例。

- 字体定向 E2E：runId `e2e_15f51dba85e551931c752795`，真实保存、编辑、旧端读取降级/覆盖拒绝、复制粘贴及草稿恢复通过；字体资源离线仅影响显示。报告 `e948b51a-c0fc-4003-82b6-8e08cc9f967b.json`，资源清理通过。
- 首次完整 E2E：274 项中 260 通过、13 跳过、1 失败；失败为连续回车用例先设选区后聚焦，导致焦点恢复旧光标。仅修正测试准备次序并增加实际光标断言，未改产品行为或降低断言。定向普通段落/引用段落两项复验通过，runId `e2e_88ba76da143403335367a4c7`，资源清理通过。
- 最终完整 E2E 额外启用长讨论合成样本：274 项中 268 通过、2 失败、4 跳过；跳过项为原有负责人页面复现套件，缺少 `DISCUSSION_REPRO_FILE` 只读原始快照。runId `e2e_f285697953a8eea69bcdb532`，报告 `cad06b3c-fa81-4e3e-bf9e-9b2707ff0fee.json`。扩展套件的 1,000 / 5,000 / 10,000 条楼层和回复窗口、反向续读、渲染有界与置顶刷新共 7 项通过；两项“编辑、目标删除、已删返回与编号空洞”在再次跳转前识别阅读项失败。
- 基线隔离对照：干净 `77d08749e1cd3dc89e7620e9bba476036640522f` 使用同一 Backend SHA、原始脚本和测试，完整长讨论 9 项中 7 通过、2 失败。两项均在 `discussion-navigation.spec.ts:36` / `:171` 复现相同阅读项断言失败，与本候选一致；runId `e2e_f5e4d2b4776bf6f66690c254`，报告 `a967710c-5fc7-476e-b43c-347b64b6dc6a.json`。此前单项对照的楼层用例停在更早的弹窗步骤，不用该次结果代替相同断点证据。
- 上述失败运行均保留失败状态；`resourcesRemoved=true` 且 `cleanupEventVerified=true` 证明本轮资源已回收，不能将 `resourcesCleaned=false` 的总结果称为通过。按仓库允许的“无关既有失败 + 定向等价验证 + 明确记录”交付例外，草稿 PR 保留两项失败，不降低断言、不跳过用例，也不宣称 `pnpm check:full` 全绿。

最终提交 SHA 和 PR 由 Git 与 PR 元数据关联本记录。截图、实际字形/网络记录、长文锚点和会话摘要保存在当前聊天的 `thread-fonts` 可视化产物目录。

## 补充实测

- `/tmp/web-thread-fonts-preview/reading-evidence.json`：1024×900、80 段长文，字体加载前后可见字符 top 均为 12 px，scrollY 均为 4000；只处理进入可见范围的 9 段，共用一个家族/FontFace，首读 4 请求、4,097,949 字节，重新打开 0 请求、4 项 IndexedDB 命中，无页面错误。未将加载输入字节当作 RSS。
- `/tmp/web-thread-font-exports.json`：真实 Milkdown 输出 68 个规范正文，其中 34 项带字体；Backend 精确提交的纯解析/写保护函数全部通过严格解析、新写和关闭字体/颜色新写后的保源检查。该复验不连接数据库或 API，不构成 Mobile 实际互读完成。
- 隔离浏览器暴露 CSP 未放行自有字体子域；连接策略现与加载器的自有 HTTPS 来源约束一致，font-src 仍不开放任意 URL 字体。CSP、开发配置和加载器定向 48 项通过。
- 完整门禁发现 [markdown-it 安全公告 GHSA-r7fv-28h4-cvq7](https://github.com/advisories/GHSA-r7fv-28h4-cvq7)；依赖与锁文件更新到修复版 14.3.2，`pnpm security:audit` 通过，未新增忽略项或降低门禁。升级后字体往返和可见范围定向 89 项通过。

- 后续假名补片实测（仍使用上述已提交资源）：侵食明朝、冒险黑体、白光明朝的平假名/片假名位于 `u003000`，样文“日本語”的“語”还需 `u008800`，不能只取 core。真实加载器在 1440×900 / 1024×900 均按码点加载 9 个 FontFace，16 请求、8,473,011 字节、并发峰值 2、无错误；CDP 确认三款的平假名、片假名及汉字样文全部由自定义字体绘制。明暗四张截图与 `japanese-evidence.json` 保存于本聊天产物目录。新增三项正式 manifest 回归通过；这不代表 revision 5 的 29 款目录或分类 schema 已同步。

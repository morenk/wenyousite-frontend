# 音频文件与正文播放

状态：`active`

接口来源为 Backend `cb44acaeb7fbc735fb569276aef00435bf24efe5` 的 OpenAPI `5.37.0-dev.20261016.1`、`markdown-audio-v1-fixtures.json` 与 schema；体验和图标消费 Foundation 正式 `v7.3.0`。不引入录音、封面、波形或新的 Markdown 格式。

## 上传入口与本机布局

`meta.audioUpload.version === 1` 时，已登录且具备稳定草稿目标的正文编辑器提供文件选择入口。主帖正文、子贴正文、楼层、回复和编辑使用相同宿主；入口默认在 More，用户可在设置中直接拖到主栏或排序。无能力时运行时和设置都隐藏音频，但保留本机已存归属；关闭上传不影响已有合法音频的阅读。

默认位置读取 `AUDIO_UPLOAD.defaultToolbarPlacement`，入口图标为 `editor.audio`。Foundation 的既有 `./editor` 能力集合尚不包含音频，本地 `editor-capabilities.ts` 仅扩展可执行动作类型和中文标签，使用正式 `./audio` 行为与图标，不复制共享资产。回复和主题共用 `wenyousite-web-editor-toolbar-v1`；Web 与 App 分别保存。默认与自定义预览直接调用运行时宽度收纳，同一编辑器坐标比较主栏、表情和 More 托盘，窄屏不横向滚动。历史列表无可见入口，解析及命令仍保留。

## 文件、处理与恢复

- 接受 MP3、M4A、WAV、OGG、FLAC，按能力验证 MIME（兼容常见别名，空/通用二进制 MIME 按支持扩展名回退，video/mp4 归一化为 audio/mp4）；输入最多 30 MiB，实际时长由后端处理校验，最多 10 分钟。播放副本由后端归一化为 `audio/mpeg`。
- `useUploadAudio` 经 `apiClient` 获取 `RICH_CONTENT_AUDIO` 预约。XHR 仅向返回的预签名 URL PUT，携带文件 Content-Type，不携带 API Bearer。确认与查询都核对账号、mediaId 和 purpose，只有有效 `COMPLETED` 投影才插入正文。
- `UPLOADING` 恢复先确认；仅 `40419` 缺对象才重签同一 ID 后再直传。`PROCESSING` 受控轮询，超时/断网保留恢复入口；`FAILED` 显示受控错误，重试重新预约。不自动重试网络失败或恢复后台任务。
- 占位使用 ProseMirror decoration，随文档事务映射位置，不进入 Markdown、撤销正文或云草稿。取消会中止请求并保留本机状态；继续或移除由用户明确触发。未完成上传或正在恢复本机记录时阻止发布。
- IndexedDB `wenyousite-audio-drafts` 保存 File、mediaId、已完成结果，按账号和正文/回复目标分组；刷新/重新打开只恢复占位，不发请求。编辑目标或账号切换会失效旧操作 generation、abort 并清空内存占位，旧目标本机记录仍保留。恢复完整结果不依赖新上传能力，也不重复上传。
- 本机记录保留七天，后续访问/保存时清理过期项；用户移除则删除。成功插入后保留完成记录，下一次打开若正文已包含对应链接则移除，避免插入与正文草稿保存之间刷新丢失结果。刷新恢复插入点使用当前正文段落位置，不承诺恢复此前光标坐标。本机保存失败保留错误，不冒称可恢复。

媒体沿用图片的公开桶 URL 语义；帖子权限不撤销已知媒体 URL，不宣称音频私有。回收、容量和存储路径由 Backend 管理。

## 正文协议与播放器

上传成功插入顶层独立、无 title 的 `[音频](URL)`。编辑态保持普通链接和 marks，输入态不挂载播放器。已有 label、粗体、斜体、删除线及行内代码保留；序列化保留原独立链接的外层与相邻独立同 URL 链接边界，内部来源属性只用于编辑器和中间 AST，不写入 Markdown/HTML 协议。不改变普通链接的既有 marks 排序或分片空白规则。

阅读仅把顶层单链接段落升级：sourceUrl 必须精确匹配 `mediaAudios`，mediaId 非空、MIME 为 audio/mpeg、size 为正整数、durationMs 为 1–600000 整数。label 仅允许文字及其 marks，不把链接内图片当音频。URL 使用 HTTPS；HTTP 仅允许本机测试地址 localhost、127.0.0.1、::1、10.0.2.2。正文内联、列表/引用、带 title、相邻独立链接、转义内容及无效/缺失投影均保持普通链接。楼层、回复、讨论根楼层、主题/子贴正文、资料楼层都透传各自 DTO 投影；列表沿用摘要，不挂载音源。

播放器使用正文宽度、surface、compact 圆角、品牌进度色和正式 `media.play`/`media.pause` 图标。表面使用轻边界，圆形播放按钮使用既有弱 accent 底色，标题与等宽时长同排。播放与进度命中区为 40px，原生 range 的视觉轨道为 3px；完整 label 可由辅助技术读取。复制播放器得到原 label/marks 的普通链接，不包含控制按钮或时间。

挂载、悬停和滚动不设置 `src`；`preload=none`，首次明确点击才交给原生音频读取精确桶 URL/Range。同页只能一个音频活动播放。普通暂停保留缓冲；后台/pagehide/卸载解除 src 并 load 以停止在途缓冲，记录进度；回到前台不请求，用户点击后等 metadata 到达再恢复进度。来源或页面改变重置实例状态。metadata 前禁用 seek，非法 currentTime 安全处理。失败只显示就近错误与显式重试，不自动恢复或重试。

## 定向验证

固定语料的 16 正文用例、5 无效投影用例由阅读与编辑 codec 消费；相关测试覆盖上传状态、响应错配、账号/编辑目标切换、迟到回调、本机恢复、普通链接往返、复制、播放互斥和背景停载。共享图片 PUT 的取消/超时/续签回归保持原提示。

可只运行音频 test 文件、设置/偏好相关 test、链接编辑回归子集和变更文件 lint。实际浏览器候选使用本轮合成 MP3、不可用 BACKEND_URL 和显式路由 mock，记录 Range、零真实业务请求、明暗/窄屏、坐标与拖放；不能把 mock 证明当作后端集成或部署结果。按负责人本轮要求，合并授权前不执行全量测试、全量分析、门禁或完整构建。

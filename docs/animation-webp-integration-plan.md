# 全场景动画 WebP 接入与验收

本文件记录本轮实现范围与验收矩阵；最终检查结果见文末验收记录。审计基线为 `c893ae29363e0085e22295a5997e9f346ff6021b`。实际行为已同步对应模块文档。实施契约为 Backend `94934be265e36e2f6dba2fbc8b53e58e2755fa52` 的 `display` 与正文 `mediaDisplays[{sourceUrl,display}]`；静态时序固定1帧/0ms/1次。

## 身份与展示源

- 原始 Markdown URL、媒体 ID、表情 asset ID 是业务身份；选择的 WebP URL 只是展示源。编辑保存、收藏来源校验、复制粘贴及重新发布不得将预览 URL 写回持久内容。
- 后端返回的完整动画 WebP 与列表预览档分别消费。正文和大图使用完整动画，列表根据现有尺寸/DPR选择预览；不能把最长边800的封面预览当作高清原尺寸大图。
- 纯资源 selector 不控制播放生命周期。输入是已验证服务端描述和用途，只解析展示URL；静态变体和就绪/失败状态仍由各入口控制。调用方继续执行现有可见性和错误恢复策略。
- 不拼接新派生对象路径，不根据 `.webp` 后缀猜是否动画，不重新转码已规范化 StickerAsset，不以完整动画替代静态列表首帧。
- 新GIF就绪必须有display；历史null允许过渡但不宣称已WebP。display加载失败不得自动回退昂贵GIF，使用静态状态和显式重试。原 GIF 保留，不在本任务删除。
- Markdown 消费 `mediaDisplays` 正文精确映射；只消费服务端已授权正文的批量结果，不引入任意URL resolver。调用必须经 apiClient 和共享 Hook，不在组件逐张直接 fetch。

## 场景与回归矩阵

| 场景 | 接入入口 | 回归入口与核心断言 |
| --- | --- | --- |
| 正文、楼层、子贴、回复 | MarkdownContent/MarkdownImage | markdown-content.test.tsx；新浏览器全场景用例：转换完成后正文请求完整WebP，不请求GIF；缺描述分支与历史外链边界 |
| 正文大图 | ImageLightbox | image-lightbox.test.tsx；点击后使用完整WebP，真实自然像素缩放、拖拽、关闭；原身份不变 |
| 封面首页/搜索/个人/收藏 | ThreadCover | thread-cover.test.tsx、thread-cover-playback/cache/pixels.spec.ts；50%进入、多播、>0保持、离屏停止、同URL原生时钟例外保持 |
| 静态封面 | ThreadCover静态分支 | 正确选择可信小尺寸静态派生图，不能回退为大主图却声称已优化 |
| 动态发现/关注/搜索/个人/收藏 | MomentCover/MomentMediaImage | moment-cover.test.tsx、moment-animation.spec.ts；始终只请求静态图 |
| 动态详情轮播、评论、回复 | MomentMediaImage | moment-media-image.test.tsx、moment-comments.test.tsx、moment-animation.spec.ts；当前/可见项使用WebP，非当前和离屏静止 |
| 动态全屏 | MomentGalleryLightbox | gallery-lightbox.test.tsx、moment-animation.spec.ts；只加载当前，背景暂停，实际WebP尺寸驱动缩放，显式失败重试 |
| 私聊图片/大图 | DirectMessageBubble | direct-message-bubble.test.tsx；完成后WebP、陌生消息揭示前零图片请求、撤回后不挂载、大图仍WebP |
| 上传后的乐观私聊 | UploadedImage/DirectMessageComposer | upload-image.test.ts、direct-message-composer.test.tsx、use-direct-message-actions.test.tsx；上传完成传递全部描述，替换本地预览且保留mediaId与恢复点 |
| 编辑器新上传/已有正文 | Milkdown图像NodeView/handleUpload | upload-animation.spec.ts、rich-text-stability.spec.ts；展示WebP但模型src不改，保存重开仍可解析；未知/迟到结果不污染别的节点 |
| 复制粘贴 | site-clipboard/编辑器模型 | site-clipboard.test.tsx、rich-text-stability.spec.ts；编辑区复制保留规范模型src，阅读区继续输出图片/表情文字投影；不从展示img.src推导持久引用 |
| 表情选择/正文/动态/私聊 | StickerPicker/getStickerDisplayUrl/StickerAsset | sticker-picker-popover.test.tsx、sticker-display.test.ts、正文与消息用例；沿用服务端规范WebP，缩略图/悬停/聚焦规则不变，不猜_md |
| 头像/主页背景 | 静态专属上传与展示 | 保持禁止动图的现有约束，不因格式接入扩大上传支持 |

## 浏览器素材与证据口径

完整展示新增固定Backend提交的实际编码器 `e2e/fixtures/media-display/duplicate-frames.webp`/GIF/manifest；旧播放回归继续复用仓库自制clock与motion素材，不下载真实论坛媒体作为测试附件。响应描述按冻结的新契约构造，原GIF端点记录任何意外请求；完整WebP与预览/首帧URL明确区分。

- 资源选择：正文、封面、大图、动态、消息、编辑器逐入口验证请求URL与请求次数，不能只通过helper单测。
- 像素与时间线：实际PNG像素变化与有限循环；真实有损WebP允许RGB小偏差，旧无损clock另验首帧时长；onLoad和元素visible不等于开始播放。
- 冷热：相同URL重入复用HTTP缓存，不新增query/fragment；不将历史Build65KMA性能数字当作本次构建结果。
- 原身份：提交Markdown、复制内容和收藏来源参数分别断言；缩放尺寸取展示资源描述/自然尺寸，不能套用不同分辨率源图。
- 真实帖 `cmtmw5b5l01go7q3wxhg99lfz` 由既有图片慢任务提供；本次匿名详情API读取返回404，待公开可访问时再验收，不绕权限或冒称已实测。

## 门禁与交付

后端精确提交后正常同步OpenAPI/生成类型，先跑相关单元与组件，再完整 `pnpm check`、受管理 `test:e2e:candidate` 的相关旅程与跨端核心验证。源码改变后重新构建候选，不使用旧构建伪装新源码通过。提交推送新PR，未经本轮明确授权不合并、不部署。

## 编辑器接入实现

已安装 Milkdown 7.21.3 的 imageBlock feature 支持 `proxyDomURL`，可将模型 `node.attrs.src` 映射为DOM展示URL而不改模型；复用该接口，不复制整个NodeView。该代理保持同步；映射变化通过decorations刷新NodeView，原模型不变。行内表情使用独立NodeView，同样不改schema.toDOM。


## 候选验收记录（2026-09-12）

- 契约通过正常同步与生成接入 Backend `94934be265e36e2f6dba2fbc8b53e58e2755fa52`，API `5.22.0-dev.20260912.2`；机器规则继续锁定 Foundation `6.9.0`，本轮 Foundation 图片用途解释变化不要求无关升级。
- 冻结应用源码完整 `pnpm check` 通过：300个测试文件、3099项测试，并通过契约、架构、文档、lint、类型与生产构建门禁。最后新增的忽略取消信号迟到GET/confirm回归另运行上传/表情61项全部通过；没有将其冒计为全量3101项执行。
- 候选 Build `9ki3Az5g3sJAxW4uqWL4G`；构建发生在本任务提交前的工作区，非正式发布。应用源码此后未修改，末尾仅完善测试素材命中区域与持久化证据。
- 浏览器证据分为同一候选的25项封面/缓存/原生像素/动态/上传回归，以及9项新增全场景验收；不同命令结果分别保存，不将中间包含失败的命令写成一次34项全绿。
- 新增验收覆盖正文/楼层/回复与灯箱、私聊、动态详情和评论、编辑上传/已有正文/表情/草稿。对每组所有来源URL断言零意外请求；编辑保存和真实Ctrl+C保留来源身份。复制期间浏览器会加载活动document内序列化图片的问题已改为惰性的独立document序列化，并经真实剪贴板回归验证。
- 完整display缺少poster、poster迟到或失败均不阻塞符合50%可见条件的封面；49%及后台/站内省流量阻断保持。失败灯箱真实点击重试后仍打开，仅重新请求WebP。
- 实际编码器24×16样本在测试中仅以CSS放大命中与PNG采样区域，未更改资源字节或应用布局；像素序列验证红/蓝变化和有限循环结束后的蓝色。既有无损clock另外覆盖首帧延迟与完整时间线。同URL实例继续遵循已获同意的浏览器共享时钟例外。
- 上传恢复以账号会话、用途、规范化标记和原始内容SHA-256隔离；跨文件显式恢复不接受，同内容重新选择可续查。切换账号立即取消在途流程；底层忽略AbortSignal的迟到GET/confirm不能调用完成回调或污染新账号恢复点。长时间PROCESSING保持原mediaId继续查询，不重复上传。
- 原始日志、请求清单、PNG与时间线归档在 VPS `/srv/wenyousite/artifacts/web-media-display-20260912`，以该目录的 `SHA256SUMS` 校验。历史失败日志保留，区分早期复制缺陷和极小素材点击/省流量测试入口修正。
- 这些浏览器入口运行真实应用组件并使用受控API响应和固定编码器产物；不是新Backend生产联调或负责人真实设备验收。匿名真实帖404限制仍在。本轮没有合并或部署Web，也没有删除历史GIF。全WebP产物并不保证每个文件都更小，固定样本WebP316字节、GIF144字节。

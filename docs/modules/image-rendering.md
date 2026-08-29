# 图片处理模块

## 1. 目标与范围

统一 Web 图片预处理、上传反馈、正文渲染与大图查看行为。所有上传入口共享同一媒体状态机，正式静态图是服务端标准化 WebP 主图，正文再利用用途对应的派生图降低带宽成本。

头像、封面、正文、缩略图与收藏表情的裁切/完整显示、状态、替代文本和查看器语义以 `foundation.lock.json` 锁定的[跨端图片呈现契约](https://github.com/morenk/wenyousite-foundation/blob/v1.1.0/docs/images.md)为准；本文只记录 Web 当前实现、后端媒体字段和验收入口，不建立第二套审美规范。

**当前能力：**
- 上传安全契约与后端对齐：仅接受 JPEG / PNG / GIF / WebP / AVIF，拒绝空文件与未经净化的 SVG
- 除 GIF 外，通用上传工具在浏览器按方向解码、最长边限制为 2560px、通过 Canvas 清除元数据并优先编码为 WebP 85；Safari 等浏览器回退 PNG/JPEG 时必须沿用 Blob 的真实 MIME 与匹配扩展名，已有裁切器输出通过 `clientNormalized` 避免重复编码，服务端最终仍统一为 WebP
- 每个入口显式传 `purpose`；正文、动态、私聊和评论只生成自身需要的派生尺寸，头像、主页背景和表情来源不生成通用派生图
- 页面 CSP 的 `connect-src` 放行 RainS3 媒体源，允许浏览器通过预签名 URL 直接 PUT 上传
- 统一上传管线通过 XHR 的上传字节事件报告真实进度；所有图片入口在准备、直传、媒体处理三个阶段持续反馈，直传阶段显示已传/总量和百分比，支持 `AbortSignal` 取消；直传与异步处理各自保留 120 秒等待上限
- `upload-done` 由后端核对对象存储实际大小和 MIME；确认网络/5xx 有限重试，对象缺失时调用同 ID 重签端点并重新 PUT。失败或取消后按文件指纹保留恢复点，重试沿用原 `mediaId`
- 动态多图、评论、私聊、头像、双画幅主页背景和批量表情导入会保存已经完成的 `mediaId`；后续业务请求失败时只重试未完成上传或业务提交，不重复上传成功字节
- GIF 动图在正文进入视口并加载后默认播放，不再以静态 `_md.webp` 首帧代替；循环次数遵循文件自身设置
- 正文图片渲染约束：`max-width: 100%` + `max-height: 50vh` + `height: auto` + `loading="lazy"`，长图不会撑满楼层
- 本站上传的静态图自动显示 `_md.webp` 中图，点击打开 lightbox 查看正式标准化主图；历史 `/uploads/` 原件仍按旧规则兼容
- lightbox 支持适应屏幕、1:1、滚轮缩放与拖拽平移；原图以自然像素作为缩放基准，避免被正文 CSS 重复缩小
- 共享渲染组件 `MarkdownContent` 接入楼层正文与子贴正文
- `MarkdownContent` 兼容 Milkdown 空段落协议：代码块外独占一行的 `<br />`（及历史变体）转换为安全的 Markdown break，保留用户手动输入的空行；其他原始 HTML 仍通过 `skipHtml` 忽略
- 楼层、子贴和回复正文不按高度折叠，长正文与连续空段始终完整显示
- 收藏表情的版本化 title 标记渲染为最大 128px 的内联图片；该上限与动态评论、私聊共用同一 Token，且优先级高于 `.prose img` 的普通正文图片规则。可访问帖子中的站内图片和表情在悬停/聚焦时显示快速收藏按钮

**设计决策（与后端派生图方案对齐）：**
- **Markdown 存正式主图 URL**。新静态图指向 `/media/*.webp` 标准化主图，历史正文可能指向 `/uploads/` 原件；Markdown 没有结构化变体字段，因此渲染器对这两种本站路径使用确定性中图并在失败时回退主图。
- **结构化媒体不猜 URL**：`GET /media/:id`、上传确认和私聊消息里的媒体对象显式返回 `url`、`thumbnailUrl`、`mediumUrl`，派生图未就绪时为 `null`。新 Web/Flutter 场景必须消费这些字段，不得复制 `_md.webp` / `_thumb.webp` 文件名规则。
- **GIF 正文使用原图**：现有 sharp 派生链路生成的是静态 WebP 首帧，无法满足默认播放；因此 `.gif`（扩展名大小写不敏感，允许 URL query/hash）跳过中图替换。仍保留 `loading="lazy"`，避免未进入视口的长页面动图提前消耗带宽。
- 独立图片 Worker 再次校验真实 MIME、尺寸和动画边界；静态图归正、限制 2560px、去元数据后写正式主图，GIF 在限制内保留动画字节。完成或最终失败后删除临时对象。
- 个人主页背景从同一原图独立裁剪为 Web 1920×640（3:1）与移动端 1600×800（2:1），浏览器优先输出 WebP（质量 0.92），不支持时按真实 PNG/JPEG 回退；两张并行上传后通过一次 PATCH 原子绑定。服务端再次校验本人归属、完成状态、用途、光栅 MIME 与各自比例，并统一生成 WebP 正式图。契约以 Web 画幅为根字段，并在 `mobile` 返回移动画幅；历史数据的 `mobile` 为 `null` 时移动客户端应回退 Web 画幅。服务端不保留上传前原图与裁切参数，再次调整需要用户重新选择文件。

## 2. 涉及 API

| Method | Path | Guard | 用途 |
|--------|------|-------|------|
| POST | `/media/upload-url` | Auth | 获取 S3 预签名 URL |
| POST | `/media/upload-done` | Auth | 幂等确认上传；后端核对对象实际大小/MIME并原子入队 |
| POST | `/media/:id/upload-url` | Auth | 为同一 UPLOADING 媒体和对象 key 重签 PUT 地址 |
| GET | `/media/:id` | Auth | 轮询图片处理状态 |

上传链路由 `src/lib/upload-image.ts` 统一实现。允许 MIME 为 `image/jpeg`、`image/png`、`image/gif`、`image/webp`、`image/avif`，源文件和预处理结果都必须在 1B–10MB。对象存储 PUT 使用 XHR，以获得真实上传进度；签名请求使用预处理后的文件名、MIME 和大小。`objectKey` 是临时 PUT key，业务不得持久化或读取；正式 URL 以完成态响应为准。

## 3. 组件清单

| 组件 | 路径 | 说明 |
|------|------|------|
| MarkdownContent | `src/components/thread/markdown-content.tsx` | 共享 markdown 渲染：图片约束 + 懒加载 + 中图替换 + lightbox |
| ImageLightbox | `src/components/shared/image-lightbox.tsx` | 基于共享 Dialog 的原图查看器：焦点圈定、滚动锁定、适应屏幕 / 1:1 / 滚轮缩放 / 拖拽 / Esc / 点背景关闭；thread 路径仅保留兼容导出 |
| Progress | `src/components/ui/progress.tsx` | 基于已安装 Base UI Progress 的统一无障碍进度原语 |
| ImageUploadProgress | `src/components/shared/image-upload-progress.tsx` | 准备/上传/处理三阶段反馈；上传阶段显示真实字节、百分比并可按场景提供取消 |
| getMarkdownImageVariantUrl | `src/lib/upload-image.ts` | Markdown 图片专用：本站正文主图 URL → 后端明确生成的中图/信息流图 URL（SVG 原样返回）；结构化媒体不得调用 |
| DirectMessageBubble | `src/components/message/direct-message-bubble.tsx` | 私聊静态图消费 `media.mediumUrl`，GIF 使用 `media.url`，不推导对象存储 key |

**接入点：**
- `src/components/thread/floor-card.tsx` — 楼层正文
- `src/components/thread/subthread-body.tsx` — 子贴正文
- `src/app/globals.css` — 注册 `@tailwindcss/typography` 插件（`@plugin`）提供 `.prose` 排版（引用/标题/列表等），并保留 `.prose img { max-width:100%; height:auto }` 兜底

## 4. 渲染约定

| 场景 | 行为 |
|------|------|
| 本站静态上传图（新 `/media/` 或历史 `/uploads/`，且不是派生图） | 显示 `_md.webp` 中图；404 时回退主图 |
| 本站 GIF（`.gif`，大小写不敏感） | 直接显示原图，加载后自动播放；保留懒加载和正文尺寸约束，循环策略由 GIF 自身决定 |
| 站外图片 / SVG / 已是派生图 URL | 原样显示，仅做尺寸约束 |
| 所有正文图片 | `max-width:100%` + `max-height:50vh` + `height:auto` + `loading="lazy"` + 居中圆角 |
| 收藏表情 | title 为 `wenyousite-sticker:v1:<assetId>`；通过 `--sticker-display-max` 统一限制为最大 128px、原子显示，不能被普通 `.prose img` 规则放大；点击仍可打开 lightbox |
| 点击正文图片 | 打开 lightbox，并直接请求 Markdown 中保存的正式主图或历史原图 URL |
| lightbox 默认状态 | 在不放大小图的前提下适应视口；缩放尺寸以图片自然像素为基准，不继承正文图片的宽度约束 |
| lightbox 图片单击 | 在适应屏幕与 1:1 原图之间切换；事件不会冒泡触发遮罩关闭 |
| lightbox 其他操作 | 滚轮/工具栏缩放，放大后拖拽平移；Esc、点背景或关闭按钮退出 |
| Milkdown 空段落 | 独占行 `<br />` / `<br>` / `<br/>` 规范化为安全空段落；围栏代码块中的同名示例原样保留 |
| 引用（blockquote） | 保留原生语义并消费 Foundation 引用 Token：`muted` 底色、2px `brandStrong` 起始边标记、只圆结束侧、正文排版继承；首尾内容贴合内边距，不生成引号、图标或阴影 |
| 原始 HTML | `react-markdown` 使用 `skipHtml` 忽略，不执行用户输入的标签或脚本 |

**识别本站上传图的判定**：新正式对象以 `media/` 开头，历史对象以 `uploads/` 开头；Web 同时识别两者，不识别临时 `staging/`。

## 5. 验收标准

- 大图不再撑满/溢出容器宽度
- 本站上传图正文显示中图，点击可看原图
- 站外图片不被错误替换派生图
- lightbox 支持 Esc / 点背景关闭
- 长图打开后不被 `max-width:100%` 与适应视口缩放重复缩小
- 单击原图执行缩放切换，不会同时关闭 lightbox
- 已入库的 Milkdown 空段落保留视觉高度且不显示为字面文本，原始 HTML 保持禁用
- 长正文与楼中楼回复不受视口高度裁切，不显示“展开全文 / 收起”控件
- SVG 与空文件在调用 `upload-url` 前被客户端拒绝
- Safari 等浏览器不支持 Canvas WebP 编码而返回 PNG/JPEG 时，签名声明、文件扩展名与上传字节格式保持一致，服务端处理不出现 `IMAGE_TYPE_MISMATCH`
- CSP 允许连接 RainS3 媒体源，预签名直传不会在发起请求前被浏览器拦截
- 本站 GIF 正文默认请求原图并播放，不需要先打开 lightbox
- 所有 Web 图片上传入口持续显示阶段状态，直传阶段显示真实字节与百分比
- 对象缺失、签名过期、取消或网络中断后重试继续使用原 `mediaId`；处理轮询最多等待 120 秒
- 业务提交失败后重试不重复上传已完成的图片；多图场景只续传失败项

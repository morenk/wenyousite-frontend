# 图片处理模块

## 1. 目标与范围

统一帖子正文图片的渲染与加载行为，避免大图溢出容器，同时利用后端已生成的派生图（`_md.webp` / `_thumb.webp`）降低带宽成本。

**本次迭代范围：**
- 上传安全契约与后端对齐：仅接受 JPEG / PNG / GIF / WebP / AVIF，拒绝空文件与未经净化的 SVG
- 页面 CSP 的 `connect-src` 放行 RainS3 媒体源，允许浏览器通过预签名 URL 直接 PUT 上传
- `upload-done` 由后端核对对象存储实际大小和 MIME，并支持网络超时后的幂等重试；Web/Flutter 都只把 `COMPLETED` 媒体写入正文或头像
- GIF 动图在正文进入视口并加载后默认播放，不再以静态 `_md.webp` 首帧代替；循环次数遵循文件自身设置
- 正文图片渲染约束：`max-width: 100%` + `max-height: 50vh` + `height: auto` + `loading="lazy"`，长图不会撑满楼层
- 本站上传的静态图自动显示 `_md.webp` 中图，点击打开 lightbox 查看原图
- lightbox 支持适应屏幕、1:1、滚轮缩放与拖拽平移；原图以自然像素作为缩放基准，避免被正文 CSS 重复缩小
- 共享渲染组件 `MarkdownContent` 接入楼层正文与子贴正文
- `MarkdownContent` 兼容 Milkdown 空段落协议：代码块外独占一行的 `<br />`（及历史变体）转换为安全的 Markdown break，保留用户手动输入的空行；其他原始 HTML 仍通过 `skipHtml` 忽略
- 正文实际渲染高度超过视口 1.2 倍时折叠为 `80vh`，楼层、子贴和回复共享“展开全文/收起”交互
- 收藏表情的版本化 title 标记渲染为最大 128px 的内联图片；可访问帖子中的站内图片和表情在悬停/聚焦时显示快速收藏按钮

**设计决策（与后端派生图方案对齐）：**
- **Markdown 存原图 URL**（`upload-image.ts` 插入的即为原图），渲染时识别本站上传图后显示中图。相比"插入时直接换成 `_md.webp`"，此方案：历史内容零迁移即可生效；lightbox 无需从 `_md.webp` 反推原图扩展名（.jpg/.png/.avif 有歧义）。
- **GIF 正文使用原图**：现有 sharp 派生链路生成的是静态 WebP 首帧，无法满足默认播放；因此 `.gif`（扩展名大小写不敏感，允许 URL query/hash）跳过中图替换。仍保留 `loading="lazy"`，避免未进入视口的长页面动图提前消耗带宽。
- 后端仍保留派生图生成（sharp：300×300 cover `_thumb.webp` q80 / 800px 等比 `_md.webp` q85）；上传完成确认会在入队前复核预签名阶段固化的大小与 MIME。

**后续迭代（未含）：**
- 上传前前端 canvas 压缩超大图（P2：>2000px 或 >3MB 压到 ~1600px，跳过 GIF）
- 后端原图像素封顶 + EXIF 清理（P3）
- 列表/封面预览使用 `_thumb.webp` 缩略图

## 2. 涉及 API

| Method | Path | Guard | 用途 |
|--------|------|-------|------|
| POST | `/media/upload-url` | Auth | 获取 S3 预签名 URL |
| POST | `/media/upload-done` | Auth | 幂等确认上传；后端核对对象实际大小/MIME并原子入队 |
| GET | `/media/:id` | Auth | 轮询图片处理状态 |

上传链路由 `src/lib/upload-image.ts` 统一实现。允许 MIME 为 `image/jpeg`、`image/png`、`image/gif`、`image/webp`、`image/avif`，文件大小范围为 1B–10MB；Web 先给出友好错误，后端仍是最终校验边界。Flutter 必须复用同一范围并在选择器中排除 SVG。

## 3. 组件清单

| 组件 | 路径 | 说明 |
|------|------|------|
| MarkdownContent | `src/components/thread/markdown-content.tsx` | 共享 markdown 渲染：图片约束 + 懒加载 + 中图替换 + lightbox |
| ImageLightbox | `src/components/thread/image-lightbox.tsx` | 原图查看器：适应屏幕 / 1:1 / 滚轮缩放 / 拖拽 / Esc / 点背景关闭 |
| getImageUrlBySize | `src/lib/upload-image.ts` | 静态原图 URL → `_md.webp` / `_thumb.webp` 派生图 URL（历史 SVG 原样返回） |

**接入点：**
- `src/components/thread/floor-card.tsx` — 楼层正文
- `src/components/thread/subthread-body.tsx` — 子贴正文
- `src/app/globals.css` — 注册 `@tailwindcss/typography` 插件（`@plugin`）提供 `.prose` 排版（引用/标题/列表等），并保留 `.prose img { max-width:100%; height:auto }` 兜底

## 4. 渲染约定

| 场景 | 行为 |
|------|------|
| 本站静态上传图（URL 含 `/uploads/`，且非 `_md.webp`/`_thumb.webp`） | 显示 `_md.webp` 中图；中图 404 时 `onError` 回退原图 |
| 本站 GIF（`.gif`，大小写不敏感） | 直接显示原图，加载后自动播放；保留懒加载和正文尺寸约束，循环策略由 GIF 自身决定 |
| 站外图片 / SVG / 已是派生图 URL | 原样显示，仅做尺寸约束 |
| 所有正文图片 | `max-width:100%` + `max-height:50vh` + `height:auto` + `loading="lazy"` + 居中圆角 |
| 收藏表情 | title 为 `wenyousite-sticker:v1:<assetId>`；最大 128px、原子显示，点击仍可打开 lightbox |
| 点击正文图片 | 打开 lightbox，并直接请求 Markdown 中保存的原图 URL |
| lightbox 默认状态 | 在不放大小图的前提下适应视口；缩放尺寸以图片自然像素为基准，不继承正文图片的宽度约束 |
| lightbox 图片单击 | 在适应屏幕与 1:1 原图之间切换；事件不会冒泡触发遮罩关闭 |
| lightbox 其他操作 | 滚轮/工具栏缩放，放大后拖拽平移；Esc、点背景或关闭按钮退出 |
| Milkdown 空段落 | 独占行 `<br />` / `<br>` / `<br/>` 规范化为安全空段落；围栏代码块中的同名示例原样保留 |
| 引用（blockquote） | 由 `@tailwindcss/typography` 插件（`prose` 类）提供：左边框 + 斜体 + 引号；该插件已在 `globals.css` 以 `@plugin` 注册（此前未注册导致引用发布后呈常规文字） |
| 原始 HTML | `react-markdown` 使用 `skipHtml` 忽略，不执行用户输入的标签或脚本 |

**识别本站上传图的判定**：objectKey 统一以 `uploads/` 开头（后端生成规则），故以 URL 包含 `/uploads/` 判断，无需前端持有 COS 域名配置。

## 5. 验收标准

- [x] 大图不再撑满/溢出容器宽度
- [x] 本站上传图正文显示中图，点击可看原图
- [x] 站外图片不被错误替换派生图
- [x] lightbox 支持 Esc / 点背景关闭
- [x] 长图打开后不被 `max-width:100%` 与适应视口缩放重复缩小
- [x] 单击原图执行缩放切换，不会同时关闭 lightbox
- [x] 已入库的 Milkdown 空段落保留视觉高度且不显示为字面文本，原始 HTML 保持禁用
- [x] 正文高度超过 `120vh` 时折叠为 `80vh`，展开/收起后按当前内容位置跳转
- [x] `pnpm lint && pnpm typecheck && pnpm test` 通过
- [x] SVG 与空文件在调用 `upload-url` 前被客户端拒绝
- [x] CSP 允许连接 RainS3 媒体源，预签名直传不会在发起请求前被浏览器拦截
- [x] 本站 GIF 正文默认请求原图并播放，不需要先打开 lightbox

## 6. 子任务

- [x] `feat: MarkdownContent 共享渲染组件 + 测试`
  - 新建 `markdown-content.tsx` / `image-lightbox.tsx`
  - 测试：普通文本 / 本站图换中图 / 站外图原样 / SVG 不替换 / 中图失败回退 / lightbox 开合
- [x] `feat: 楼层/子贴正文接入 + CSS 兜底`
  - `floor-card.tsx`、`subthread-body.tsx` 换用 `<MarkdownContent>`
  - `globals.css` 加 `.prose img` 兜底
- [x] `docs: 图片渲染约定`（本文档）
- [x] `fix: 修复 lightbox 长图重复缩小和图片点击冒泡`
  - 使用图片 `naturalWidth` / `naturalHeight` 作为 transform 尺寸基准
  - 增加原图点击不关闭、自然尺寸不被全局 CSS 二次约束的回归测试

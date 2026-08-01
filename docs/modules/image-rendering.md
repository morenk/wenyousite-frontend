# 图片处理模块

## 1. 目标与范围

统一帖子正文图片的渲染与加载行为，避免大图溢出容器，同时利用后端已生成的派生图（`_md.webp` / `_thumb.webp`）降低带宽成本。

**本次迭代范围：**
- 正文图片渲染约束：`max-width: 100%` + `height: auto` + `loading="lazy"`，任何 markdown 内容图片不超出容器宽度
- 本站上传图自动显示 `_md.webp` 中图，点击打开 lightbox 查看原图
- 共享渲染组件 `MarkdownContent` 接入楼层正文与子贴正文

**设计决策（与后端派生图方案对齐）：**
- **Markdown 存原图 URL**（`upload-image.ts` 插入的即为原图），渲染时识别本站上传图后显示中图。相比"插入时直接换成 `_md.webp`"，此方案：历史内容零迁移即可生效；lightbox 无需从 `_md.webp` 反推原图扩展名（.jpg/.png/.avif 有歧义）。
- 后端仍保留派生图生成（sharp：300×300 cover `_thumb.webp` q80 / 800px 等比 `_md.webp` q85），本次不涉及后端改动。

**后续迭代（未含）：**
- 上传前前端 canvas 压缩超大图（P2：>2000px 或 >3MB 压到 ~1600px，跳过 GIF/SVG）
- 后端原图像素封顶 + EXIF 清理（P3）
- 列表/封面预览使用 `_thumb.webp` 缩略图

## 2. 涉及 API

| Method | Path | Guard | 用途 |
|--------|------|-------|------|
| POST | `/media/upload-url` | Auth | 获取 S3 预签名 URL |
| POST | `/media/upload-done` | Auth | 确认上传完成 |
| GET | `/media/:id` | Auth | 轮询图片处理状态 |

> 上传链路（`src/lib/upload-image.ts`）本次未改动。后端生成派生图逻辑见后端 `docs/image-upload.md`。

## 3. 组件清单

| 组件 | 路径 | 说明 |
|------|------|------|
| MarkdownContent | `src/components/thread/markdown-content.tsx` | 共享 markdown 渲染：图片约束 + 懒加载 + 中图替换 + lightbox |
| ImageLightbox | `src/components/thread/image-lightbox.tsx` | 点击查看原图的轻量遮罩（Esc / 点背景关闭） |
| getImageUrlBySize | `src/lib/upload-image.ts` | 原图 URL → `_md.webp` / `_thumb.webp` 派生图 URL（SVG 原样返回） |

**接入点：**
- `src/components/thread/floor-card.tsx` — 楼层正文
- `src/components/thread/subthread-body.tsx` — 子贴正文
- `src/app/globals.css` — `.prose img { max-width:100%; height:auto }` 兜底

## 4. 渲染约定

| 场景 | 行为 |
|------|------|
| 本站上传图（URL 含 `/uploads/`，且非 `_md.webp`/`_thumb.webp`） | 显示 `_md.webp` 中图；中图 404 时 `onError` 回退原图 |
| 站外图片 / SVG / 已是派生图 URL | 原样显示，仅做尺寸约束 |
| 所有正文图片 | `max-width:100%` + `height:auto` + `loading="lazy"` + 居中圆角 |
| 点击图片 | 打开 lightbox 显示原图（Esc / 点击遮罩关闭） |

**识别本站上传图的判定**：objectKey 统一以 `uploads/` 开头（后端生成规则），故以 URL 包含 `/uploads/` 判断，无需前端持有 COS 域名配置。

## 5. 验收标准

- [x] 大图不再撑满/溢出容器宽度
- [x] 本站上传图正文显示中图，点击可看原图
- [x] 站外图片不被错误替换派生图
- [x] lightbox 支持 Esc / 点背景关闭
- [x] `pnpm lint && pnpm typecheck && pnpm test` 通过

## 6. 子任务

- [x] `feat: MarkdownContent 共享渲染组件 + 测试`
  - 新建 `markdown-content.tsx` / `image-lightbox.tsx`
  - 测试：普通文本 / 本站图换中图 / 站外图原样 / SVG 不替换 / 中图失败回退 / lightbox 开合
- [x] `feat: 楼层/子贴正文接入 + CSS 兜底`
  - `floor-card.tsx`、`subthread-body.tsx` 换用 `<MarkdownContent>`
  - `globals.css` 加 `.prose img` 兜底
- [x] `docs: 图片渲染约定`（本文档）

# 用户表情收藏模块

## 产品行为

登录用户在私聊和帖子编辑器中共用一个私有收藏夹。最多收藏 200 个，最近使用同步 20 个；新收藏排在最前，用户可拖拽排序、进入管理模式批量删除。重复收藏幂等且不改变位置，删除收藏同时从最近列表消失，但不影响已经发送的消息或帖子。

本地批量上传最多选择 10 张，前端并发 3 个复用媒体上传管线，再逐个提交表情导入。单项失败不会取消其他项，面板持续展示处理状态和失败原因。

## API 与缓存

| Hook/操作 | API | 行为 |
|-----------|-----|------|
| `useStickers` | `GET /stickers` | 收藏、最近和处理中导入；处理期间自动轮询 |
| `importMedia` | `POST /stickers/imports/media` | 本地上传完成后导入 |
| `importDirectMessage` | `POST /stickers/imports/direct-message` | 收藏消息中的图片或表情 |
| `importPostImage` | `POST /stickers/imports/post-image` | 收藏可访问帖子中的站内图片或表情 |
| `reorder` | `PUT /stickers/reorder` | 带版本号提交完整排序，冲突时刷新 |
| `remove` | `DELETE /stickers/:favoriteId` | 移除本人收藏 |

Query Key 始终包含当前 `userId`，避免切换账号串号。消息或帖子上的快速收藏按钮不要求外层已有 QueryClient，成功后发出 `stickers:changed` 事件，由已挂载的收藏面板刷新。

## 组件

| 组件 | 职责 |
|------|------|
| `StickerPickerPopover` | 按需挂载最近/收藏页签、上传、拖拽排序和批量管理 |
| `SaveStickerButton` | 图片悬停或键盘聚焦时显示的“收藏为表情”按钮；不拦截浏览器右键菜单 |
| `sticker-inline-plugin` | 把版本化 Markdown 图片标记显示为不可拆分的内联原子节点，并无损序列化 |

列表默认只加载静态缩略图；动图在悬停或键盘聚焦时切换为完整资产。帖子表情最大 128px，私聊纯表情最大 180px 且没有气泡背景。陌生消息请求中的图片和表情在用户点击前都不加载。

## 发送协议

- 私聊点选表情后立即发送独立 `stickerAssetId` 消息，不清空或改变当前输入的文字、待发送图片。服务端 `sticker` 字段优先，旧服务端/客户端可回退到 `media`。
- 帖子编辑器在当前光标插入 `![表情](ASSET_URL "wenyousite-sticker:v1:ASSET_ID")`；这是标准图片 Markdown，旧客户端仍可显示。每篇最多 20 个。
- 新普通图片只能通过本地文件上传；Crepe 的外部图片 URL 输入隐藏，服务端也拒绝新增或复制外链图片。普通超链接不受影响，历史外链图片可原位保留。

发送时只引用服务端已有资产，不重新上传图片字节，所以私聊发送与帖子提交保持小请求和快速响应。

# 通知模块（列表 / 未读数 / 红点）

## 1. 目标与范围

实现站内通知的列表查看、未读标记与导航红点。全局导航分别提供「通知」和「私聊」，两个页面内部复用同一消息中心分类栏。

**当前能力：**
- `/notifications` 通知列表页：类型图标 + 结构化 payload 文案（旧通知回退 content）+ 相对时间 + 未读高亮 + 跳转 + 删除
- 单条点击标记已读，顶部「全部已读」
- 导航栏「通知」显示通知未读数；「私聊」显示已接受会话未读与待处理请求合计（轮询刷新）
- 无限滚动（cursor 分页）+ loading / error / empty 三态
- 按 Foundation 分组过滤：全部、互动、订阅、系统
- 通知跳转精确定位到主题帖楼层/楼中楼及动态主评论/楼中楼：目标不在首屏分页时仍可直接注入、高亮并滚动定位
- 已读操作使用乐观缓存更新，跳转不再依赖请求完成
- 页面重新获得焦点时刷新通知；补齐加载更多失败重试
- 「全部已读」仅在有未读时展示，并即时更新列表与红点
- payload 结构化渲染：`actorName`、动作和 `preview` 分段排版；点赞聚合继续使用后端生成的完整文案

提及通知使用后端稳定 `eventKey` 幂等；同一帖子中显式提及已覆盖的用户不会再重复收到该帖的普通回复/新楼层提醒。正文中的 `[@用户名](/users/{userId})` 由 MarkdownContent 渲染为本站用户链接，兼容历史纯文本提及。

## 2. 页面与路由

| 路由 | 页面说明 | 权限 |
|------|----------|------|
| `/notifications` | 通知列表 | Auth（仅本人，未登录跳 /login） |

通知页和私聊页都显示「通知 / 私聊」分类栏，名称和各自徽标与全局导航一致。

## 3. 涉及 API

| Method | Path | Guard | 用途 |
|--------|------|-------|------|
| GET | `/notifications?cursor=&type=` | AuthRead | 通知列表（cursor 分页，按时间倒序，支持 type 过滤） |
| GET | `/notifications/unread` | AuthRead | 未读通知数量 `{ unreadCount }` |
| PATCH | `/notifications/:id` | AuthRead | 标记单条已读/未读（Body `{ isRead }`） |
| DELETE | `/notifications/:id` | AuthRead | 硬删除单条 |
| POST | `/notifications/read-all` | AuthRead | 一键全部已读 |
| GET | `/posts/:id` | Public | 获取通知目标帖的主题/子贴/父楼上下文，用于精确定位 |
| GET | `/moments/:id/comments/:commentId/context` | OptionalAuth | 获取动态通知目标主评论与楼中楼上下文，用于精确定位 |

> `NotificationType`：reply / mention / new_post / thread_created / follow / like / tip / level_up / system。旧类型 `new_floor` / `subthread_created` 后端自动映射为 `new_post`。

通知筛选分组由当前 Foundation v3.0.0 契约中的 `experiences.notifications` 定义，Web 直接消费生成产物，不在业务组件复制名称和成员：

| 分组 | 类型 |
|------|------|
| 互动 | reply / mention / follow / like |
| 订阅 | new_post / thread_created |
| 系统 | tip / level_up / system |

“全部”不发送 `type` 参数。历史 `reply,mention`、`follow,like`、`tip,level_up` 与 `system` URL 会归并到对应新分组；非法值回退“全部”。未知新增类型在 Foundation 升级前仍可从“全部”看到，客户端不猜测其分组。

## 4. 响应结构

列表项结构以后端 OpenAPI 契约和 `src/api/types.ts` 生成类型为准：

### GET /notifications?limit=20 → NotificationItem[]

```json
{
  "code": 0, "message": "ok",
  "data": [
    {
      "id": "cmsxxx",
      "type": "reply",
      "content": "morenk 回复了：楼中楼回复内容",
      "payload": { "schemaVersion": 1, "actorName": "morenk", "action": "reply", "preview": "楼中楼回复内容" },
      "target": { "kind": "post", "threadId": "cmsttt", "postId": "cmsppp", "userId": null },
      "postId": "cmsppp",
      "threadId": "cmsttt",
      "fromUserId": "cmsuuu",
      "isRead": false,
      "createdAt": "2026-08-01T18:25:14.395Z",
      "post": { "id": "cmsppp", "floorNumber": 1, "parentPostId": null },
      "thread": { "id": "cmsttt", "title": "管理面板测试帖" },
      "fromUser": { "id": "cmsuuu", "username": "morenk", "avatar": null }
    }
  ],
  "meta": { "cursor": "cmsxxx", "hasMore": false }
}
```

> **内容与导航字段**：新通知的 `payload.schemaVersion` 固定为 `1`，结构化字段用于展示；`content` 只承担旧数据和未知类型降级。客户端导航只读取必有的 `target.kind` 与对应 ID，不再从通知类型或可空关联字段猜测目的地。系统通知通常为 `target.kind: "none"`、`fromUserId: null`。

### GET /notifications/unread

```json
{ "code": 0, "message": "ok", "data": { "unreadCount": 3 } }
```

### PATCH /notifications/:id / DELETE /notifications/:id / POST /notifications/read-all

```json
{ "code": 0, "message": "ok", "data": { "message": "已标记为已读" } }
```

## 5. 状态管理

| 状态 | 来源 | 管理方式 |
|------|------|----------|
| 通知列表 | `GET /notifications` | TanStack Query `useInfiniteQuery`（`queryKeys.notifications.list(type, userId)`，按用户隔离） |
| 未读数 | `GET /notifications/unread` | `useQuery`（`queryKeys.notifications.unread(userId)`，按用户隔离，`refetchInterval: 30s`） |
| 标记已读/删除/全部已读 | 各 mutation | 乐观更新当前用户的列表与未读数；失败时回滚，再后台校验 |

> **缓存按用户隔离**：未读数与列表 key 均由 `queryKeys` 工厂生成并包含 `userId`。登录切换账号时还会重建 QueryClient，从 key 与容器两层避免私有通知串号。

## 6. 组件清单

| 组件 | 路径 | 说明 |
|------|------|------|
| NotificationItem | `src/components/notification/notification-item.tsx` | 单条通知：类型图标 + payload/content 降级文案 + 时间 + 未读高亮 + 跳转 + 删除 |
| NotificationList | `src/components/notification/notification-list.tsx` | 通知列表：无限滚动 + 三态 + 「全部已读」 |
| useNotifications | `src/api/hooks/use-notifications.ts` | 通知列表 hook（cursor 分页，`{ type, userId }` 按用户隔离） |
| useUnreadCount | `src/api/hooks/use-unread-count.ts` | 未读数 hook（`userId` 按用户隔离，30s 轮询） |
| useNotificationActions | `src/api/hooks/use-notification-actions.ts` | 标记已读/删除/全部已读 mutation |
| NotificationsPage | `src/app/notifications/page.tsx` | 通知列表页 |

## 7. 跳转与交互规则

- 跳转以 `target.kind` 为唯一分支：`post` → 通过共享 `getPostHref` 精确定位楼层/楼中楼；`thread` → `/threads/{threadId}`；`user` → `/users/{userId}`；`none` 不可点。顶层 `postId/threadId/fromUserId` 与关联对象仅保留展示、删除状态和旧数据兼容用途。
- **跳转对象已删除不跳转**：列表接口返回 thread/post/fromUser 的 `deletedAt`；目标已删除时该通知不渲染链接，行内显示提示（帖子/楼层 →「该内容已删除」，用户 →「该用户已注销」），点击仅标记已读并 toast 提示，不导航
- 详情页读取 `post` 参数后通过 `GET /posts/:id` 查询目标上下文：切换子贴并立即滚动到目标楼层；楼中楼采用二阶段定位，在父楼展开且回复渲染完成后立即滚动到目标回复。定位不使用平滑移动动画；高亮只加在目标楼层/回复卡片本身，父楼层和列表容器不高亮。已删除内容维持后端列表过滤策略。
- 动态详情以 `reply ?? comment` 查询评论上下文；目标不在已加载分页时直接注入并去重，不连续扫描主评论或楼中楼分页。目标 404 时保留动态与普通评论并提示“目标回复不存在或不可见”，其他定位错误提供重试。
- 点击通知（有跳转目标）：若未读，立即乐观标记为已读并异步提交，不阻塞跳转
- 删除按钮：硬删除 + 失效列表/未读数
- 类型图标：reply/mention/new_post/thread_created → MessageSquare/AtSign/PenLine/FilePlus；follow → UserPlus；like → Heart；tip → Fuel；level_up → TrendingUp；system → Megaphone
- 有操作者（`fromUser`）时左侧显示接口返回的头像母版（无则首字符占位）；系统通知无操作者时保留类型图标
- 未读：左侧圆点 + 背景高亮；点击后即时置为已读样式
- 类型筛选由 URL `?type=` 驱动；nuqs 将历史组合归并为 Foundation 当前分组，切换时把规范组合写入浏览历史；非法值回退「全部」，点击导航栏「通知」入口回到 `/notifications`（无参数）即重置为「全部」
- 类型筛选栏在任何状态下（加载中/出错/空数据）都保持渲染，空类型时不会丢失导航栏；「全部已读」仅在列表存在未读时显示
- 历史通知展示时移除残留图片 Markdown；仅当结构化 `payload.preview` 明确等于 `1.00` 时移除尾部比例 alt，避免误删正常数字正文
- 展示时顺带还原 Milkdown 序列化残留的反斜杠转义（`\<`/`\>` → `<`/`>`）及硬换行反斜杠（`\`+换行 → 换行），兼容已入库的旧通知，避免预览出现孤立 `\`

## 8. 错误处理

| 错误码 | 场景 | UI 行为 |
|--------|------|---------|
| 40100 | 未登录 | apiClient 拦截器跳 /login（页面另有登录守卫） |
| 网络错误 | 列表加载失败 | 错误态 + 重试按钮 |
| 网络错误 | 加载下一页失败 | 保留已加载通知，在列表末尾显示重试按钮 |
| 其他 | 标记/删除失败 | toast 后端 message 或"操作失败，请稍后重试" |

## 9. 权限与访问控制

| 场景 | 处理 |
|------|------|
| 未登录访问 /notifications | 登录守卫跳 /login（等待 isInitialized） |
| 仅本人 | 列表/未读均为当前登录用户数据 |
| 系统通知 | 无 fromUser/thread，不可点，普通样式渲染 |

## 10. 验收标准

- `/notifications` 列表展示通知（图标 + 文案 + 时间 + 未读高亮）
- 未读通知有醒目标识；点击已读并跳转
- 「全部已读」一键清零未读
- 单条删除
- 无限滚动加载更多
- 导航栏「通知」显示未读徽标，读数随操作更新
- 未登录跳 /login
- 类型筛选、精确定位与刷新策略（本轮）
- 通知定位取消平滑移动动画，且只高亮目标卡片
- 乐观已读缓存更新（失败时自动回滚）
- payload 结构化渲染（actorName/action/preview 分段，旧数据回退 content）

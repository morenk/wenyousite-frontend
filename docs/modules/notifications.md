# 通知模块（列表 / 未读数 / 红点）

## 1. 目标与范围

实现站内通知的列表查看、未读标记与导航红点。导航栏现统一为「消息」入口，与私聊共用消息中心。

**本次迭代范围（Phase 7 MVP，最小实现）：**
- `/notifications` 通知列表页：类型图标 + 结构化 payload 文案（旧通知回退 content）+ 相对时间 + 未读高亮 + 跳转 + 删除
- 单条点击标记已读，顶部「全部已读」
- 导航栏「消息」链接显示通知 + 私聊 + 消息请求合计徽标（轮询刷新）
- 无限滚动（cursor 分页）+ loading / error / empty 三态

**本轮迭代（通知可达性与一致性）：**
- 按类型过滤 Tab（`?type=mention,reply`）
- 通知跳转精确定位到楼层或楼中楼：主楼层在主题详情页高亮，楼中楼进入独立阅读页并高亮目标回复
- 已读操作使用乐观缓存更新，跳转不再依赖请求完成
- 页面重新获得焦点时刷新通知；补齐加载更多失败重试
- 「全部已读」仅在有未读时展示，并即时更新列表与红点

**本轮补充：**
- payload 结构化渲染：`actorName`、动作和 `preview` 分段排版；点赞聚合继续使用后端生成的完整文案

提及通知使用后端稳定 `eventKey` 幂等；同一帖子中显式提及已覆盖的用户不会再重复收到该帖的普通回复/新楼层提醒。正文中的 `[@用户名](/users/{userId})` 由 MarkdownContent 渲染为本站用户链接，兼容历史纯文本提及。

## 2. 页面与路由

| 路由 | 页面说明 | 权限 |
|------|----------|------|
| `/notifications` | 通知列表 | Auth（仅本人，未登录跳 /login） |

导航栏「消息」入口默认指向 `/notifications`；私聊通过消息中心“私聊”页签进入，并保留各自的未读数。

## 3. 涉及 API

| Method | Path | Guard | 用途 |
|--------|------|-------|------|
| GET | `/notifications?cursor=&type=` | AuthRead | 通知列表（cursor 分页，按时间倒序，支持 type 过滤） |
| GET | `/notifications/unread` | AuthRead | 未读通知数量 `{ unreadCount }` |
| PATCH | `/notifications/:id` | AuthRead | 标记单条已读/未读（Body `{ isRead }`） |
| DELETE | `/notifications/:id` | AuthRead | 硬删除单条 |
| POST | `/notifications/read-all` | AuthRead | 一键全部已读 |
| GET | `/posts/:id` | Public | 获取通知目标帖的主题/子贴/父楼上下文，用于精确定位 |

> `NotificationType`：reply / mention / new_post / thread_created / follow / like / system。旧类型 `new_floor` / `subthread_created` 后端自动映射为 `new_post`。

## 4. API 响应快照

真实响应见 `docs/snapshots/notifications.snapshot.json`（当前无数据）。列表项结构（后端 `notifications.service.findAll` include 为准）：

### GET /notifications?limit=20 → NotificationItem[]

```json
{
  "code": 0, "message": "ok",
  "data": [
    {
      "id": "cmsxxx",
      "type": "reply",
      "content": "morenk 回复了：楼中楼回复内容",
      "payload": { "actorName": "morenk", "action": "reply", "preview": "楼中楼回复内容" },
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

> **内容字段**：`content` 为后端生成的完整中文文案（`xxx 回复了：…` / `xxx 关注了你` / `A、B 赞了你的主题帖` 等），前端直接渲染即可，无需拼接。系统通知 `fromUserId: null`。

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

- 跳转优先级：有 `postId` → 通过共享 `getPostHref` 定位主楼层或直达楼中楼回复；否则有 `threadId` → `/threads/{threadId}`；否则有 `fromUserId`（follow）→ `/users/{fromUserId}`；system（均无）不可点
- **跳转对象已删除不跳转**：列表接口返回 thread/post/fromUser 的 `deletedAt`；目标已删除时该通知不渲染链接，行内显示提示（帖子/楼层 →「该内容已删除」，用户 →「该用户已注销」），点击仅标记已读并 toast 提示，不导航
- 详情页读取 `post` 参数后通过 `GET /posts/:id` 查询目标上下文：切换子贴并立即滚动到目标楼层；楼中楼采用二阶段定位，在父楼展开且回复渲染完成后立即滚动到目标回复。定位不使用平滑移动动画；高亮只加在目标楼层/回复卡片本身，父楼层和列表容器不高亮。已删除内容维持后端列表过滤策略。
- 点击通知（有跳转目标）：若未读，立即乐观标记为已读并异步提交，不阻塞跳转
- 删除按钮：硬删除 + 失效列表/未读数
- 类型图标：reply/mention/new_post/thread_created → MessageSquare/AtSign/PenLine/FilePlus；follow → UserPlus；like → Heart；system → Megaphone
- 有操作者（`fromUser`）时左侧显示操作者头像（`_thumb.webp` 缩略图，无则首字符占位）；系统通知无操作者时保留类型图标
- 未读：左侧圆点 + 背景高亮；点击后即时置为已读样式
- 类型筛选由 URL `?type=` 驱动（如 `?type=reply,mention`）；切换筛选通过 `router.replace` 同步到 URL，点击导航栏「通知」入口回到 `/notifications`（无参数）即重置为「全部」
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

- [x] `/notifications` 列表展示通知（图标 + 文案 + 时间 + 未读高亮）
- [x] 未读通知有醒目标识；点击已读并跳转
- [x] 「全部已读」一键清零未读
- [x] 单条删除
- [x] 无限滚动加载更多
- [x] 导航栏「通知」显示未读徽标，读数随操作更新
- [x] 未登录跳 /login
- [x] `pnpm lint && pnpm typecheck && pnpm test && pnpm build` 通过
- [x] 类型筛选、精确定位与刷新策略（本轮）
- [x] 通知定位取消平滑移动动画，且只高亮目标卡片
- [x] 乐观已读缓存更新（失败时自动回滚）
- [x] payload 结构化渲染（actorName/action/preview 分段，旧数据回退 content）

## 11. 子任务（切片）

- [x] 抓取 notifications 快照 + 编写模块文档 + Roadmap 更新
- [x] 切片2：通知 API hooks（useNotifications / useUnreadCount / useNotificationActions）+ 测试
- [x] 切片3：NotificationItem / NotificationList 组件 + 测试
- [x] 切片4：/notifications 页面 + 导航未读徽标
- [x] 修复：未读数/列表按 userId 隔离缓存，登录即时刷新徽标（含登录/注册后失效）
- [ ] 切片5：质量检查 + 部署 + 提交推送

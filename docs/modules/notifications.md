# 通知模块（列表 / 未读数 / 红点）

## 1. 目标与范围

实现站内通知的列表查看、未读标记与导航红点，补全导航栏「通知」链接死链。

**本次迭代范围（Phase 7 MVP，最小实现）：**
- `/notifications` 通知列表页：类型图标 + content 文案 + 相对时间 + 未读高亮 + 跳转 + 删除
- 单条点击标记已读，顶部「全部已读」
- 导航栏「通知」链接显示未读徽标（轮询刷新）
- 无限滚动（cursor 分页）+ loading / error / empty 三态

**后续迭代：**
- 按类型过滤 Tab（`?type=mention,reply`）
- 标记单条未读、楼层锚点跳转、下拉刷新
- payload 结构化渲染（actorName/action/preview 单独排版）

## 2. 页面与路由

| 路由 | 页面说明 | 权限 |
|------|----------|------|
| `/notifications` | 通知列表 | Auth（仅本人，未登录跳 /login） |

导航栏「通知」入口已存在（`nav-bar.tsx`），本模块补页面 + 未读徽标。

## 3. 涉及 API

| Method | Path | Guard | 用途 |
|--------|------|-------|------|
| GET | `/notifications?cursor=&type=` | AuthRead | 通知列表（cursor 分页，按时间倒序，支持 type 过滤） |
| GET | `/notifications/unread` | AuthRead | 未读通知数量 `{ unreadCount }` |
| PATCH | `/notifications/:id` | AuthRead | 标记单条已读/未读（Body `{ isRead }`） |
| DELETE | `/notifications/:id` | AuthRead | 硬删除单条 |
| POST | `/notifications/read-all` | AuthRead | 一键全部已读 |

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
| 通知列表 | `GET /notifications` | TanStack Query `useInfiniteQuery`（queryKey `["notifications", type, userId]`，按用户隔离） |
| 未读数 | `GET /notifications/unread` | `useQuery`（queryKey `["notifications","unread",userId]`，按用户隔离，`refetchInterval: 30s`） |
| 标记已读/删除/全部已读 | 各 mutation | 成功后失效 `["notifications"]` 前缀（覆盖列表 + 未读数） |

> **缓存按用户隔离**：未读数与列表 queryKey 均包含 `userId`。登录切换账号时 key 变化 → 挂载全新缓存条目立即拉取；登出后旧账号缓存自动失活，避免「刚登录徽标不显示旧数据 / 串号」。登录/注册成功后会失效 `["notifications"]` 前缀，保证同账号重复登录也能刷新。

## 6. 组件清单

| 组件 | 路径 | 说明 |
|------|------|------|
| NotificationItem | `src/components/notification/notification-item.tsx` | 单条通知：类型图标 + content + 时间 + 未读高亮 + 跳转 + 删除 |
| NotificationList | `src/components/notification/notification-list.tsx` | 通知列表：无限滚动 + 三态 + 「全部已读」 |
| useNotifications | `src/api/hooks/use-notifications.ts` | 通知列表 hook（cursor 分页，`{ type, userId }` 按用户隔离） |
| useUnreadCount | `src/api/hooks/use-unread-count.ts` | 未读数 hook（`userId` 按用户隔离，30s 轮询） |
| useNotificationActions | `src/api/hooks/use-notification-actions.ts` | 标记已读/删除/全部已读 mutation |
| NotificationsPage | `src/app/notifications/page.tsx` | 通知列表页 |

## 7. 跳转与交互规则

- 跳转优先级：有 `threadId` → `/threads/{threadId}`；否则有 `fromUserId`（follow）→ `/users/{fromUserId}`；system（均无）不可点
- 点击通知（有跳转目标）：先 `PATCH isRead: true`（若未读）再跳转
- 删除按钮：硬删除 + 失效列表/未读数
- 类型图标：reply/mention/new_post/thread_created → MessageSquare/AtSign/PenLine/FilePlus；follow → UserPlus；like → Heart；system → Megaphone
- 未读：左侧圆点 + 背景高亮；点击后即时置为已读样式

## 8. 错误处理

| 错误码 | 场景 | UI 行为 |
|--------|------|---------|
| 40100 | 未登录 | apiClient 拦截器跳 /login（页面另有登录守卫） |
| 网络错误 | 列表加载失败 | 错误态 + 重试按钮 |
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

## 11. 子任务（切片）

- [x] 抓取 notifications 快照 + 编写模块文档 + Roadmap 更新
- [x] 切片2：通知 API hooks（useNotifications / useUnreadCount / useNotificationActions）+ 测试
- [x] 切片3：NotificationItem / NotificationList 组件 + 测试
- [x] 切片4：/notifications 页面 + 导航未读徽标
- [x] 修复：未读数/列表按 userId 隔离缓存，登录即时刷新徽标（含登录/注册后失效）
- [ ] 切片5：质量检查 + 部署 + 提交推送

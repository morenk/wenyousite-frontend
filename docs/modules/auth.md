# 认证模块

## 1. 目标与范围

实现用户注册（两步：请求验证码 → 验证码+用户名密码完成注册）、登录、登出、忘记密码、重置密码、邮箱验证的全流程 UI。

**本次迭代范围：**
- 发布批次标识：`auth-login-terminal-2026-08-05`（与后端模块文档一致）
- [x] 登录页面 `/login`
- [x] 注册页面 `/register`
- [x] 忘记密码页面 `/forgot-password`
- [x] 重置密码页面 `/reset-password`
- [x] 邮箱验证页面 `/verify-email`
- [x] 全局导航栏（含登出按钮）
- [x] Zod 校验 schema 抽取
- [x] TanStack Query API hooks 抽取
- [x] Access Token 过期后使用 httpOnly refresh cookie 单飞刷新并重放原请求
- [x] 使用 Web Locks 协调多个浏览器标签页的 refresh token 轮转
- [x] access token 仅驻留内存，页面启动时用 httpOnly refresh cookie 恢复会话
- [x] `localStorage` 只保存不含凭证的用户 ID/修订号会话标记，用于跨标签页同步
- [x] 登出时检查服务端错误，确保 refresh cookie 与当前登录终端确实退出
- [x] 双端登录：每个账号最多一个 Web 登录终端和一个原生移动端登录终端，PC/手机网页共用 Web 槽位
- [x] 登录/注册使用 OpenAPI 生成请求与响应类型，Web 响应体不再假定存在 refresh token

**后续迭代：**
- 无

## 2. 页面与路由

| 路由 | 页面说明 | 权限 |
|------|----------|------|
| `/login` | 登录表单（邮箱或用户名 + 密码）；支持站内安全 `next` 回跳 | 公开，已登录自动跳转 `next` 或 `/` |
| `/register` | 注册两步：发验证码 → 填信息 | 公开，已登录自动跳转 `/` |
| `/forgot-password` | 输入邮箱，请求重置邮件 | 公开，已登录自动跳转 `/` |
| `/reset-password` | 输入验证码 + 新密码，完成重置 | 公开（通过链接/手动进入） |
| `/verify-email` | 输入验证码，验证邮箱 | 需登录（AuthRead） |

## 3. 涉及 API

| Method | Path | Guard | 用途 |
|--------|------|-------|------|
| POST | `/auth/login` | Public | 登录 |
| POST | `/auth/register/request-code` | Public | 注册第一步：发验证码 |
| POST | `/auth/register/verify-and-complete` | Public | 注册第二步：完成注册 |
| POST | `/auth/logout` | AuthRead | 登出 |
| POST | `/auth/refresh` | Public | access token 过期后轮换 refresh token，并重放原请求 |
| POST | `/auth/forgot-password` | Public | 请求重置密码邮件 |
| POST | `/auth/reset-password` | Public | 使用验证码重置密码 |
| POST | `/auth/verify-email` | AuthRead | 使用验证码验证邮箱 |
| POST | `/auth/resend-verification` | Public | 重发验证邮件 |

## 4. 状态管理

| 状态 | 来源 | 存储 |
|------|------|------|
| `accessToken` | 登录/注册/刷新响应 | 模块内存仓库；刷新页面后丢弃 |
| `refreshToken` | 登录/注册/刷新响应的 `Set-Cookie` | 仅 httpOnly Cookie（后端管理，JavaScript 不可读） |
| `user` 对象 | 登录/注册/刷新响应 | 内存仓库 + AuthContext |
| 会话标记 | 当前 userId + 随机 revision，不含 token/资料 | `localStorage`，只用于多标签页身份变化通知 |
| `isInitialized` | refresh cookie 启动恢复完成标志 | AuthContext（恢复前 false，结束后 true） |
| `email`（注册第一步） | 用户输入，暂存 | 组件 state，第二步复用 |
| 表单状态 | react-hook-form | 组件本地 |
| 提交 loading | useState | 组件本地 |

**刷新与缓存策略：** 注册/登录成功后把 access token 与 user 写入模块内存，绝不把 access token 写入 Web Storage。刷新页面时 `AuthProvider` 先调用 `/auth/refresh`，用 httpOnly cookie 恢复内存会话，完成后才把 `isInitialized` 置为 true。单个标签页内的并发 401 共享一个刷新 Promise；不同标签页通过名为 `wenyousite-auth-refresh` 的 Web Lock 串行轮换。登录/登出的会话标记变化会通知其他标签页重新恢复或清空，但标记本身不含凭证。确认刷新失败才清理登录态并跳转登录页。

TanStack Query 容器由当前认证身份隔离；首次 AuthContext hydration 只记录当前身份，不重复创建 QueryClient，避免公共首页请求两次。此后登录、登出或账号切换才重新创建 QueryClient。登录终端、黑名单等敏感 hook 还会把用户 ID 放入 query key，双层避免私有数据跨账号短暂复用。

## 5. 组件清单

| 组件 | 路径 | 说明 |
|------|------|------|
| LoginPage | `src/app/login/page.tsx` | 登录页面 |
| RegisterPage | `src/app/register/page.tsx` | 注册页面（两步） |
| ForgotPasswordPage | `src/app/forgot-password/page.tsx` | 忘记密码页面 |
| ResetPasswordPage | `src/app/reset-password/page.tsx` | 重置密码页面 |
| VerifyEmailPage | `src/app/verify-email/page.tsx` | 邮箱验证页面 |
| NavBar | `src/components/layout/nav-bar.tsx` | 全局导航栏 |
| Button | `src/components/ui/button.tsx` | shadcn Button |
| Input | `src/components/ui/input.tsx` | shadcn Input |
| Label | `src/components/ui/label.tsx` | shadcn Label |
| Card | `src/components/ui/card.tsx` | shadcn Card |
| useCountdown | `src/hooks/use-countdown.ts` | 60 秒倒计时 hook |
| useLogin | `src/api/hooks/use-login.ts` | 登录 TanStack Query hook |
| useRegister | `src/api/hooks/use-register.ts` | 注册 TanStack Query hook |

## 6. 表单与校验

校验 schema 放在 `src/lib/validations/auth.ts`。

### 登录

```ts
const loginSchema = z.object({
  account: z
    .string()
    .min(1, "请输入邮箱或用户名")
    .superRefine((val, ctx) => {
      // 含 @ 按邮箱校验，否则按用户名校验
      if (val.includes("@")) {
        if (!z.string().email().safeParse(val).success) {
          ctx.addIssue({ code: "custom", message: "邮箱格式不正确" });
        }
      } else if (!/^[a-zA-Z0-9\u4e00-\u9fff]{2,24}$/.test(val)) {
        ctx.addIssue({ code: "custom", message: "用户名只允许 2-24 位字母、数字、中文" });
      }
    }),
  password: z.string().min(1, "请输入密码").min(8, "密码至少 8 位"),
});
```

- `account` 为单一输入框，自动识别邮箱（含 `@`）或用户名
- 用户名规则与注册保持一致：2-24 位字母、数字、中文；登录时用户名**大小写敏感精确匹配**（后端与注册唯一约束一致）

### 注册第一步（邮箱）

```ts
const emailSchema = z.object({
  email: z.string().min(1, "请输入邮箱").email("邮箱格式不正确"),
});
```

### 注册第二步

```ts
const registerSchema = z.object({
  token: z.string().min(6).max(6).regex(/^\d+$/, "验证码为 6 位数字"),
  username: z
    .string()
    .min(2, "用户名至少 2 位")
    .max(24, "用户名最多 24 位")
    .regex(/^[a-zA-Z0-9\u4e00-\u9fff]+$/, "用户名只允许字母、数字、中文"),
  password: z
    .string()
    .min(8, "密码至少 8 位")
    .regex(/[a-zA-Z]/, "密码需包含至少一个字母")
    .regex(/\d/, "密码需包含至少一个数字"),
  confirmPassword: z.string().min(1, "请再次输入密码"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "两次输入的密码不一致",
  path: ["confirmPassword"],
});
```

- 注册需输入两次密码（`confirmPassword` 仅前端校验，不随请求提交）

### 忘记密码

```ts
const forgotPasswordSchema = z.object({
  email: z.string().min(1, "请输入邮箱").email("邮箱格式不正确"),
});
```

### 重置密码

```ts
const resetPasswordSchema = z.object({
  email: z.string().min(1, "请输入邮箱").email("邮箱格式不正确"),
  token: z.string().min(6).max(6).regex(/^\d+$/, "验证码为 6 位数字"),
  newPassword: z
    .string()
    .min(8, "密码至少 8 位")
    .regex(/[a-zA-Z]/, "密码需包含至少一个字母")
    .regex(/\d/, "密码需包含至少一个数字"),
});
```

### 邮箱验证

```ts
const verifyEmailSchema = z.object({
  token: z.string().min(6).max(6).regex(/^\d+$/, "验证码为 6 位数字"),
});
```

## 7. 错误处理

| 错误码 | 场景 | UI 行为 |
|--------|------|---------|
| 40100 | 账号或密码错误 / 未登录 | toast "账号或密码错误" |
| 40001 | 验证码错误 / 过期 / 业务校验 | toast 后端 message |
| 40300 | 邮箱未验证 | toast "请先验证邮箱" |
| 40900 | 用户名被占用 / 邮箱已注册 | toast "用户名已被占用" / "该邮箱已注册" |
| 42900 | 频繁请求 | toast "操作太频繁，请稍后再试" |
| 网络错误 | fetch 失败 | toast "网络连接失败，请检查网络后重试" |

**统一模式：**
```ts
const { data, error } = await apiClient.POST("/auth/xxx", { body });
if (error) {
  toast.error(error.message || "操作失败");
  return;
}
// 处理 data
```

> **401 拦截器例外**：`apiClient` 对携带 accessToken 的请求遇到 401 会先单飞调用 `/auth/refresh`，成功后重放原请求；刷新失败才清除登录态并跳转 `/login`。登录/注册/重置/验证码/改密/换邮箱等「业务 401」端点（`client.ts` 的 `BUSINESS_401_PATHS`）由页面自行 toast 提示，不触发刷新或跳转。

## 8. 权限与访问控制

| 场景 | 处理 |
|------|------|
| 已登录用户访问 `/login`、`/register` 等 | `useEffect` 检测 user 存在，`router.replace("/")` |
| 未登录用户访问需登录页面 | 受保护路由的 `layout.tsx` 统一挂载 `RequireAuth`，等待启动恢复后保留 `next` 路径跳登录 |
| 需验证邮箱的写入口 | 创建、编辑、邀请加入布局统一传 `requireVerifiedEmail`，未验证跳 `/verify-email` |
| 登出 | 调 `POST /auth/logout`；服务端成功后清除内存会话和无凭证标记并跳首页，失败则保留登录态并提示重试 |
| verify-email 需登录 | `/verify-email/layout.tsx` 使用 `RequireAuth`，未登录保留目标路径跳转 |

## 9. 用户流程

### 登录
```
进入 /login → 输入邮箱或用户名 + 密码 → 提交 → 成功: token 写入内存 / 跳首页 失败: toast
```

### 注册
```
进入 /register → Step1: 输入邮箱 → 点击获取验证码 → 成功: 进入 Step2
Step2: 输入验证码 / 用户名 / 密码 / 确认密码 → 提交 → 成功: 自动登录跳首页 失败: toast
60 秒倒计时后可重新发送验证码；邮箱输错可点「换个邮箱」返回 Step1 重新输入（新邮箱会生成新验证码）
```

### 忘记密码 / 重置密码
```
进入 /forgot-password → 输入邮箱 → 提交 → 成功: toast "重置邮件已发送" 跳 /reset-password
/reset-password 页也提供「发送验证码」按钮（复用 forgot-password 端点）+ 60s 倒计时重发，验证码丢失无需回退
输入验证码 / 新密码 → 提交 → 成功: toast "密码重置成功，请重新登录" 跳 /login（后端吊销所有 refresh token）
```
（后端反枚举，无论邮箱是否存在都返回成功）

### 邮箱验证
```
进入 /verify-email → 如未登录跳 /login → 输入验证码 → 提交 → 成功: toast "邮箱验证成功" 跳首页
「发送验证码」按钮（60s 倒计时，可重新发送）
```

## 10. 验收标准

- [x] `/login` 可正常登录并跳转首页
- [x] `/register` 两步注册流程完整可用
- [x] `/forgot-password` 发送重置邮件成功
- [x] `/reset-password` 重置密码成功并强制重新登录
- [x] `/verify-email` 验证邮箱成功
- [x] 导航栏根据登录状态显示不同按钮
- [x] 登出清除 token 并跳转首页
- [x] access token 过期后可无感刷新并重放原请求
- [x] 多个并发 401 只发起一次 refresh 请求
- [x] 多标签页同时过期时通过 Web Lock 串行轮换 refresh cookie
- [x] 生产代码静态门禁禁止恢复 `localStorage.accessToken`
- [x] 登录账号变化后不会复用上一个账号的私有 Query 缓存
- [x] 已登录用户访问公开认证页自动跳转
- [x] 所有错误状态有 toast 提示
- [x] 提交按钮有 loading 状态
- [x] `pnpm check` 全部通过

## 11. 子任务

- [x] 编写模块设计文档 `docs/modules/auth.md`
- [x] 抽取 Zod schema → `src/lib/validations/auth.ts`
- [x] 抽取 API hooks → `src/api/hooks/use-login.ts` 等
- [x] 抽取倒计时 hook → `src/hooks/use-countdown.ts`
- [x] 实现 /login（登录页面）
- [x] 实现 /register（注册页面）
- [x] 实现 /forgot-password（忘记密码）
- [x] 实现 /reset-password（重置密码）
- [x] 实现 /verify-email（邮箱验证）
- [x] 实现 NavBar（全局导航栏 + 登出）
- [x] 高风险认证切片：Web refresh cookie-only、多标签页单飞、账号切换缓存隔离；单元测试覆盖，跨端行为由后端 `pnpm test:e2e:auth-terminal` 在真实 PostgreSQL 临时 Schema 验证
- [x] 同步更新文档
- [x] `pnpm check` 通过

## 12. 跨端依赖与发布顺序

- **风险**：认证状态、refresh token 轮转和私有缓存属于高风险路径。Web 不得读取或持久化 refresh token；原生移动端仍从响应体读取，两个客户端都依赖后端以 `platform` 区分登录终端
- **契约依赖**：后端先保留可选 `refreshToken`、`createdAt` 和已废弃 `deviceInfo` 兼容字段，并新增稳定 `id`、`signedInAt`、`lastActiveAt`。前端类型必须由运行时 OpenAPI 重新生成，不手写平行类型
- **发布顺序**：先按后端文档执行备份、迁移和新后端烟雾测试，再发布本 Web 构建，最后通知原生移动端确认 `X-Client-Platform: mobile` 与响应体 refresh token 流程；不允许客户端先假定新后端已上线
- **兼容与回滚**：旧 Web 在兼容窗口内仍可使用 `createdAt`，新 Web 对缺失新时间字段提供显示兜底。Web 可回滚到上一构建而不回滚数据库；后端回滚及 token 重新登录影响见后端同批次文档
- **发布后验证**：分别验证 Web 登录、原生移动端登录、双端并存、同端替换、多标签页刷新、登录终端列表、远程退出和账号切换；持续 401/5xx 或 refresh 失败时停止客户端发布并回滚 Web 构建

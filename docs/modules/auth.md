# 认证模块

## 1. 目标与范围

实现用户注册（两步：请求验证码 → 验证码+用户名密码完成注册）、登录、登出、忘记密码、重置密码、邮箱验证的全流程 UI。

**当前能力：**
- 登录页面 `/login`
- 注册页面 `/register`
- 忘记密码页面 `/forgot-password`
- 重置密码页面 `/reset-password`
- 邮箱验证页面 `/verify-email`
- 全局导航栏（含登出按钮）
- Zod 校验 schema 抽取
- TanStack Query API hooks 抽取
- Access Token 过期后使用 httpOnly refresh cookie 单飞刷新并重放原请求
- 使用 Web Locks 协调多个浏览器标签页的 refresh token 轮转
- access token 仅驻留内存，页面启动时用 httpOnly refresh cookie 恢复会话
- `localStorage` 只保存不含凭证的用户 ID/修订号会话标记，用于跨标签页同步
- 登出时检查服务端错误，确保 refresh cookie 与当前登录终端确实退出
- 双端登录：每个账号最多一个 Web 登录终端和一个原生移动端登录终端，PC/手机网页共用 Web 槽位
- 登录/注册使用 OpenAPI 生成请求与响应类型，Web 响应体不假定存在 refresh token

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

**刷新与缓存策略：** 注册/登录成功后把 access token 与 user 写入模块内存，绝不把 access token 写入 Web Storage。刷新页面时 `AuthProvider` 先调用 `/auth/refresh`，用 httpOnly cookie 恢复内存会话，完成后才把 `isInitialized` 置为 true。仅 `40101 TOKEN_EXPIRED` 触发刷新；单个标签页内的并发过期请求共享一个刷新 Promise，不会把登录失败、验证码错误或无效 token 等其他 401xx 错当成 access token 过期。不同标签页通过名为 `wenyousite-auth-refresh` 的 Web Lock 串行轮换。登录/登出的会话标记变化会通知其他标签页重新恢复或清空，但标记本身不含凭证。确认刷新失败才清理登录态并跳转登录页。

TanStack Query 容器由当前认证身份隔离；首次 AuthContext hydration 只记录当前身份，不重复创建 QueryClient，避免公共首页请求两次。此后登录、登出或账号切换才重新创建 QueryClient。登录终端、黑名单等敏感 hook 还会把用户 ID 放入 query key。主题帖、帖子和用户主页等 OptionalAuth 查询使用 `useViewerScope` 把当前查看者 ID 放入 query key；页面从匿名启动恢复为登录态时会自动切换缓存维度并重新查询关系、权限和私密可见内容。

## 5. 组件清单

| 组件 | 路径 | 说明 |
|------|------|------|
| LoginPage | `src/app/login/page.tsx` | 登录页面 |
| RegisterPage | `src/app/register/page.tsx` | 注册页面（两步） |
| ForgotPasswordPage | `src/app/forgot-password/page.tsx` | 忘记密码页面 |
| ResetPasswordPage | `src/app/reset-password/page.tsx` | 重置密码页面 |
| VerifyEmailPage | `src/app/verify-email/page.tsx` | 邮箱验证页面 |
| GuestRoute / GuestOnly | `src/components/auth/guest-route.tsx` | 登录、注册和找回密码路由共享的访客边界与认证恢复等待 |
| AuthPageShell | `src/components/auth/auth-page-shell.tsx` | 认证流程统一双栏布局；左侧功能分区，右侧表单卡片 |
| NavBar | `src/components/layout/nav-bar.tsx` | 非认证路由的左侧全局导航栏 |
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
| 40100 | 未携带认证凭证 | 受保护路由跳转登录；业务页面展示后端 message |
| 40101 | access token 过期 | apiClient 单飞刷新并重放原请求 |
| 40102–40104 | token 无效、已撤销或触发盗用检测 | 不刷新；清理当前会话并要求重新登录 |
| 40105–40107 | 账号锁定、账号注销或邮箱未验证 | 展示后端 message；邮箱未验证跳 `/verify-email` |
| 40110 | 登录凭据错误 | toast "账号或密码错误" |
| 40111–40114 | 验证码过期、错误、超限或不存在 | 展示后端 message，按提示重新获取验证码 |
| 40115–40116 | 会话不存在或旧密码错误 | 展示后端 message，不触发 token 刷新 |
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

> **401 拦截规则**：`apiClient` 只对“携带 accessToken 且错误码为 `40101 TOKEN_EXPIRED`”的请求单飞调用 `/auth/refresh`，成功后重放原请求。其余 401xx 不触发刷新；登录/注册/重置/验证码/改密/换邮箱等端点由页面根据错误码和 message 提示。这样 Web 与 Flutter 可以共享同一套确定性的会话状态机。

## 8. 权限与访问控制

| 场景 | 处理 |
|------|------|
| 已登录用户访问 `/login`、`/register` 等 | 路由 `layout.tsx` 统一挂载 `GuestRoute`；等待会话恢复后跳转 `next` 或 `/` |
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

- `/login` 可正常登录并跳转首页
- `/register` 两步注册流程完整可用
- `/forgot-password` 发送重置邮件成功
- `/reset-password` 重置密码成功并强制重新登录
- `/verify-email` 验证邮箱成功
- 导航栏根据登录状态显示不同按钮
- 登出清除 token 并跳转首页
- access token 过期后可无感刷新并重放原请求
- 多个并发 401 只发起一次 refresh 请求
- 多标签页同时过期时通过 Web Lock 串行轮换 refresh cookie
- 生产代码静态门禁禁止恢复 `localStorage.accessToken`
- 登录账号变化后不会复用上一个账号的私有 Query 缓存
- 已登录用户访问公开认证页自动跳转
- 所有错误状态有 toast 提示
- 提交按钮有 loading 状态

## 11. 跨端约束

- **风险**：认证状态、refresh token 轮转和私有缓存属于高风险路径。Web 不得读取或持久化 refresh token；原生移动端仍从响应体读取，两个客户端都依赖后端以 `platform` 区分登录终端
- **契约依赖**：后端保留可选 `refreshToken`、`createdAt` 和已废弃 `deviceInfo` 兼容字段，并提供稳定 `id`、`signedInAt`、`lastActiveAt`。前端类型必须由已提交 OpenAPI 生成，不手写平行类型
- **客户端标识**：原生端必须发送 `X-Client-Platform: mobile` 并消费响应体 refresh token；PC 与手机浏览器都属于 Web 槽位，refresh token 仅使用 HttpOnly Cookie
- **回归范围**：认证改动至少验证 Web 登录、移动端登录、双端并存、同端替换、多标签页刷新、登录终端列表、远程退出和账号切换

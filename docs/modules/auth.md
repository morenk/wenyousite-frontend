# 认证模块

## 1. 目标与范围

实现用户注册（两步：请求验证码 → 验证码+用户名密码完成注册）、登录、登出、忘记密码、重置密码、邮箱验证的全流程 UI。

**本次迭代范围：**
- [x] 登录页面 `/login`
- [x] 注册页面 `/register`
- [x] 忘记密码页面 `/forgot-password`
- [x] 重置密码页面 `/reset-password`
- [x] 邮箱验证页面 `/verify-email`
- [x] 全局导航栏（含登出按钮）
- [x] Zod 校验 schema 抽取
- [x] TanStack Query API hooks 抽取

**后续迭代：**
- 修改密码
- 会话管理（列表 + 远程登出）
- 更换邮箱

## 2. 页面与路由

| 路由 | 页面说明 | 权限 |
|------|----------|------|
| `/login` | 登录表单（邮箱 + 密码） | 公开，已登录自动跳转 `/` |
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
| POST | `/auth/forgot-password` | Public | 请求重置密码邮件 |
| POST | `/auth/reset-password` | Public | 使用验证码重置密码 |
| POST | `/auth/verify-email` | AuthRead | 使用验证码验证邮箱 |
| POST | `/auth/resend-verification` | Public | 重发验证邮件 |

## 4. 状态管理

| 状态 | 来源 | 存储 |
|------|------|------|
| `accessToken` | 登录/注册/刷新响应 | `localStorage` |
| `refreshToken` | 登录/注册/刷新响应 | httpOnly Cookie（后端管理） |
| `user` 对象 | 登录/注册/刷新响应 | `localStorage` + AuthContext |
| `isInitialized` | 客户端 hydration 完成标志 | AuthContext（server=false, client=true） |
| `email`（注册第一步） | 用户输入，暂存 | 组件 state，第二步复用 |
| 表单状态 | react-hook-form | 组件本地 |
| 提交 loading | useState | 组件本地 |

**缓存策略：** 注册/登录成功后直接 `setAuth` 写入 context + localStorage，不做 react-query 缓存（认证态是全局的）。

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
  email: z.string().min(1, "请输入邮箱").email("邮箱格式不正确"),
  password: z.string().min(1, "请输入密码").min(8, "密码至少 8 位"),
});
```

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
    .regex(/^[\w\u4e00-\u9fff]+$/, "用户名只允许字母、数字、中文"),
  password: z
    .string()
    .min(8, "密码至少 8 位")
    .regex(/[a-zA-Z]/, "密码需包含至少一个字母")
    .regex(/\d/, "密码需包含至少一个数字"),
});
```

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
| 40100 | 邮箱或密码错误 / 未登录 | toast "邮箱或密码错误" |
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

## 8. 权限与访问控制

| 场景 | 处理 |
|------|------|
| 已登录用户访问 `/login`、`/register` 等 | `useEffect` 检测 user 存在，`router.replace("/")` |
| 未登录用户访问需登录页面 | 暂不拦截（后续用 middleware），页面内 `useAuth` 判断；需等待 `isInitialized` 为 true 后再跳转，避免 hydration 期间误判 |
| 登出 | 调 `POST /auth/logout` + 清除 localStorage + 跳转首页 |
| verify-email 需登录 | 页面内 `useAuth` 检查 user，需等 `isInitialized` 后再跳转 `/login` |

## 9. 用户流程

### 登录
```
进入 /login → 输入邮箱密码 → 提交 → 成功: 存 token / 跳首页 失败: toast
```

### 注册
```
进入 /register → Step1: 输入邮箱 → 点击获取验证码 → 成功: 进入 Step2
Step2: 输入验证码 / 用户名 / 密码 → 提交 → 成功: 自动登录跳首页 失败: toast
60 秒倒计时后可重新发送验证码
```

### 忘记密码
```
进入 /forgot-password → 输入邮箱 → 提交 → 成功: toast "重置邮件已发送" 跳 /reset-password
（后端反枚举，无论邮箱是否存在都返回成功）
```

### 重置密码
```
进入 /reset-password → 输入邮箱 / 验证码 / 新密码 → 提交 → 成功: toast "密码重置成功，请重新登录" 跳 /login
（后端会吊销所有 refresh token，需重新登录）
```

### 邮箱验证
```
进入 /verify-email → 如未登录跳 /login → 输入验证码 → 提交 → 成功: toast "邮箱验证成功" 跳首页
底部提供"重新发送验证码"按钮
```

## 10. 验收标准

- [x] `/login` 可正常登录并跳转首页
- [x] `/register` 两步注册流程完整可用
- [x] `/forgot-password` 发送重置邮件成功
- [x] `/reset-password` 重置密码成功并强制重新登录
- [x] `/verify-email` 验证邮箱成功
- [x] 导航栏根据登录状态显示不同按钮
- [x] 登出清除 token 并跳转首页
- [x] 已登录用户访问公开认证页自动跳转
- [x] 所有错误状态有 toast 提示
- [x] 提交按钮有 loading 状态
- [x] `pnpm lint && pnpm typecheck && pnpm build` 全部通过

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
- [x] 同步更新文档
- [x] lint / typecheck / build 通过

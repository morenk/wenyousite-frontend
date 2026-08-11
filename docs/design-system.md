# Web 设计基础接入

状态：`active`

跨端审美、共享 Token、字体角色和编辑器能力的唯一事实源是公开仓库
[`morenk/wenyousite-foundation`](https://github.com/morenk/wenyousite-foundation)。本仓库由
[`foundation.lock.json`](../foundation.lock.json) 固定到 `v1.1.0`，实现前必须读取同版本的：

- [`docs/foundation.md`](https://github.com/morenk/wenyousite-foundation/blob/v1.1.0/docs/foundation.md)
- [`docs/platforms/web.md`](https://github.com/morenk/wenyousite-foundation/blob/v1.1.0/docs/platforms/web.md)
- [`docs/images.md`](https://github.com/morenk/wenyousite-foundation/blob/v1.1.0/docs/images.md)
- [`contracts/foundation.v1.json`](https://github.com/morenk/wenyousite-foundation/blob/v1.1.0/contracts/foundation.v1.json)

本地只保留实现映射，不复制规范：

- `src/app/layout.tsx` 引入中央字体与 Token CSS，`globals.css` 只做 Tailwind 映射和 Web 组件样式。
- `src/lib/editor-capabilities.ts` 是中央编辑器契约的薄转发层。
- `src/components/ui/` 与 `src/components/layout/` 承担 Web 原语和页面骨架。
- 分类名称、排序和可选颜色等业务数据仍由 `GET /thread-categories` 提供，不进入设计基础仓库。
- `pnpm design:check` 同时校验版本锁、中央产物消费和业务 UI 静态约束。

需要新增共享语义时，先在基础仓库修改契约、生成产物并发布新标签，再升级本仓库锁文件；只影响 Web 的实现细节记录在对应 `docs/modules/` 文档。

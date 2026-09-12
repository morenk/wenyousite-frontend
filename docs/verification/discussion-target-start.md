# Web 讨论跳转定位验收记录

状态：负责人于 2026-09-12 明确反馈 Web「验收通过」，修复完成。

## 输入与预期

- 长楼层：<https://wenyou.site/threads/cmtjrn0xc05rp7qvw9t7zs1iv?post=cmtvt31qc00497qc2xwuu6ama>，从最新发言或坐标进入时，应看到作者与正文开头。
- AT 回复：<https://wenyou.site/threads/cmtrvxfsy004s7q8a240qqb29/posts/cmtwi05qf00i57qvy2gl4hd1j/replies?post=cmtwkqods000m7q1it9sf3vm1>，进入后应保持指定短回复，不能闪动后落到底部。
- 2026-09-12 只读接口快照中，长楼层正文为 6,733 字符（较移动端首轮记录已有变化），楼中楼仍为 18 条回复。原始作者正文只保留 VPS 本地 `/srv/wenyousite/artifacts/web-target-start-20260912/read-only-original-pages.json`，不提交到仓库；读取快照不登录、不写入数据。

## 根因与行为

旧实现的主楼、楼中楼及动态回复使用 `scrollIntoView({block: "center"})`，长目标会越过作者与正文开头；主楼只延迟滚动一次，动态回复仅在 focused 改变时滚动，后续图片和前方内容变化缺少校准。

共享逻辑改为块开头对齐，按吸顶阅读栏及楼中楼收起入口的实际布局高度避让。观察目标、祖先与前方内容的尺寸和 DOM 插入变化，在下一帧合并校准；几何已稳定时不重复滚动。滚动位置限制在文档自然边界内，短整页不强行移动，末尾短目标不增加空白。用户滚轮、指针、触摸或键盘接管后停止；目标、激活次数或讨论筛选改变才重启。

## 候选基线

- Web 基于已合并 `origin/dev` 的 `7f3a7805222db70c172a20629a32965623eee630`，包含完整 WebP 媒体契约与现有展示行为。
- 本任务不修改 API 产物；完整门禁通过 `BACKEND_CONTRACT_REF=6fdfa00eaf1f3056ba30f2ffbc529d12eed1c823` 明确核对同一已合并 Backend 产物，避免并行开发改变相邻 checkout 后影响校验来源。
- 初始基线的契约比较曾因 Backend 先合入媒体变更失败；随后 Web 对应任务合入 dev，本候选快进同步后重新执行门禁，未关闭或跳过契约检查。

## 自动验证

- 将组件断言改为开头对齐后，旧实现 3 项回归失败；候选 73 项原组件测试通过。
- 14 项定位单元回归覆盖几何、迟到目标、图片／分页变化、阅读栏、收起入口、用户释放、卸载与观察器缺失。
- `e2e/discussion-target-geometry.spec.ts` 在 Chromium 执行同一生产定位函数，14 项真实布局检查通过，覆盖 80/900/3600 高度、末尾、吸顶、不足一屏和尺寸变化。这是独立几何场景，不冒充原站点复现。
- `e2e/discussion-target-pages.spec.ts` 通过 `DISCUSSION_REPRO_FILE` 读取本地只读快照，在隔离候选完整页面验证原长楼层坐标、最新发言和两种 PC 宽度的 AT 回复；不提供原文时不执行这组可选原场景测试。
- 最终固定文件快照的 `BACKEND_CONTRACT_REF=6fdfa00eaf1f3056ba30f2ffbc529d12eed1c823 pnpm check` 全部通过：301 个测试文件、3,115 项测试，以及覆盖率、静态分析、契约、架构、设计、发布源、文档与 production build。中途新增边界断言的一轮有 1 项失败；已保留日志，最终重跑及独立 14 项回归均通过。
- `DISCUSSION_REPRO_FILE=/srv/wenyousite/artifacts/web-target-start-20260912/read-only-original-pages.json FRONTEND_E2E_PORT=3112 pnpm test:e2e:candidate e2e/discussion-target-pages.spec.ts` 全部 4 项通过：长楼层坐标、实际最新发言按钮、1024/1440 宽度下的 AT 回复。隔离预览退出时已清理临时进程与目录，未切换线上服务。
- 候选 Build ID：`A4G3YsM6X15Xpl1SmAlDh`。原始快照与旧实现、组件、几何、最终门禁、原页面日志保留在 VPS `/srv/wenyousite/artifacts/web-target-start-20260912`。浏览器自动验证范围为 Chromium；Firefox/WebKit 未单独验证。

## 负责人验收

- 2026-09-12 用户批准合并与部署，[PR #21](https://github.com/morenk/wenyousite-frontend/pull/21) 合并至 dev，提交 `1e9408041aff8d83ef531e87adcf57efeae7ec65`；原候选为 `5e843733965aa7b673027615bb421afcb990e7c6`，两者 Git tree 一致。
- 上线 Build ID 为 `A4G3YsM6X15Xpl1SmAlDh`，release 为 `20260912T090354Z-1e9408041aff-A4G3YsM6X15Xpl1SmAlDh-SUqiMa`。服务、健康、静态资源与启动日志检查通过。
- 上线后匿名 Chromium 原长楼层、1024/1440 AT 回复与实际最新发言共 4 项只读冒烟通过，作者可见、两次定位采样稳定且无页面 JavaScript 错误。实际最新发言已变化为一个末尾短回复，按自然底部展示。
- 2026-09-12 负责人在部署后明确反馈「验收通过」。以此确认 Web 原问题修复完成；不根据该反馈推定未提供的浏览器版本或逐项手测详情。
- 验收记录、原始只读快照、构建标识、上线截图和日志保留于 `/srv/wenyousite/artifacts/web-target-start-20260912`，清理任务 Worktree 不删除这些记录。

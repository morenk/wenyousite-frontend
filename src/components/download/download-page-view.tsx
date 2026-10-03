"use client";

import { BRAND_NAME } from "@wenyousite/foundation/brand";
import { QRCodeSVG } from "qrcode.react";

import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { LoadingState } from "@/components/shared/loading-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { WenyouIcon } from "@/components/ui/wenyou-icon";

/** 仅描述视图状态；后端 DTO 由已提交契约的适配层处理。 */
export type DownloadAvailability =
  | "loading"
  | "ready"
  | "empty"
  | "withdrawn"
  | "paused"
  | "unavailable"
  | "rate-limited"
  | "error";

export interface DownloadReleaseSummary {
  versionLabel: string;
  buildLabel: string;
  sizeLabel: string;
}

export interface DownloadPageViewProps {
  availability: DownloadAvailability;
  release?: DownloadReleaseSummary;
  pageUrl?: string;
  pending?: boolean;
  retryPending?: boolean;
  downloadDisabled?: boolean;
  retryDisabled?: boolean;
  feedback?: string;
  onDownload?: () => void;
  onRetry?: () => void;
}

const availabilityMessages = {
  empty: { title: "暂无推荐版本", description: "Android 安装包准备好后，会在这里提供下载。" },
  withdrawn: { title: "此版本已撤回", description: "请稍后查看新的推荐版本。" },
  paused: { title: "下载已暂停", description: "请稍后再来查看下载是否恢复。" },
  unavailable: { title: "下载暂不可用", description: "安装包暂时无法下载，请稍后重试。" },
  "rate-limited": { title: "下载请求较多", description: "请稍等片刻再试。" },
  error: { title: "下载信息加载失败", description: "请检查网络连接后重试。" },
} as const;

export function DownloadPageView({
  availability,
  release,
  pageUrl,
  pending = false,
  retryPending = false,
  downloadDisabled = false,
  retryDisabled = false,
  feedback,
  onDownload,
  onRetry,
}: DownloadPageViewProps) {
  const available = availability === "ready" && !!release && !!onDownload;
  const message = availability !== "ready" && availability !== "loading"
    ? availabilityMessages[availability]
    : null;

  return (
    <PageShell width="content" className="px-4 pb-12 pt-16 sm:px-6">
      <PageHeader
        title="下载 APP"
        purpose="functional"
        description={`在手机上使用${BRAND_NAME}，随时继续阅读与共创。`}
        backHref="/"
        backLabel={`返回${BRAND_NAME}`}
      />
      <Card appearance="content">
        <CardContent className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto]">
          <section aria-labelledby="android-download-heading" className="min-w-0 space-y-5">
            <div className="flex items-center gap-3">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-[var(--radius-card)] bg-muted text-brand-strong">
                <WenyouIcon id="security.device-mobile" className="size-6" />
              </div>
              <div>
                <h2 id="android-download-heading" className="text-lg font-semibold">{BRAND_NAME} Android 版</h2>
                <p className="mt-1 text-sm text-muted-foreground">官方 APK 安装包 · 无需登录即可下载</p>
              </div>
            </div>

            {release && (
              <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
                <div>
                  <dt className="text-muted-foreground">版本</dt>
                  <dd className="mt-1 break-words font-medium">{release.versionLabel}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">安装包大小</dt>
                  <dd className="mt-1 font-medium">{release.sizeLabel}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-muted-foreground">构建号</dt>
                  <dd className="mt-1 break-words">{release.buildLabel}</dd>
                </div>
              </dl>
            )}

            {availability === "loading" && <LoadingState label="正在获取下载信息…" variant="inline" className="justify-start py-4" />}
            {message && (
              <div role="status" aria-live="polite" className="space-y-1 rounded-[var(--radius-control)] bg-muted p-4">
                <p className="font-medium">{message.title}</p>
                <p className="text-sm text-muted-foreground">{message.description}</p>
              </div>
            )}

            <div className="space-y-3">
              <Button
                type="button"
                size="large"
                disabled={!available || downloadDisabled}
                pending={pending}
                pendingLabel="正在确认下载…"
                onClick={onDownload}
                className="w-full sm:w-auto"
              >
                <WenyouIcon id="action.download" />
                下载 Android 安装包
              </Button>
              {availability !== "loading" && onRetry && (
                <Button type="button" variant="outline" onClick={onRetry} disabled={retryDisabled} pending={retryPending} pendingLabel="正在刷新…" className="ml-0 sm:ml-3">
                  重新获取下载信息
                </Button>
              )}
              <p className="text-xs text-muted-foreground">建议连接 Wi-Fi 后下载安装包。</p>
              {feedback && <p role="status" aria-live="polite" className="text-sm text-muted-foreground">{feedback}</p>}
            </div>
          </section>

          {pageUrl && (
            <aside className="hidden space-y-3 border-l border-border pl-8 text-center lg:block" aria-label="手机扫码下载">
              <QRCodeSVG
                value={pageUrl}
                size={176}
                level="M"
                marginSize={4}
                role="img"
                title="用手机打开温油站下载页"
                aria-label="用手机打开温油站下载页"
              />
              <p className="text-sm font-medium">手机扫码打开下载页</p>
              <p className="text-xs text-muted-foreground">扫码后可查看版本并选择下载</p>
              <a href={pageUrl} className="inline-block rounded-[var(--radius-control)] text-xs text-brand-strong underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30">{pageUrl.replace("https://", "")}</a>
            </aside>
          )}
        </CardContent>
      </Card>

      <section aria-labelledby="installation-heading" className="mt-8 space-y-4 text-sm">
        <h2 id="installation-heading" className="text-base font-semibold">安装说明</h2>
        <ol className="list-decimal space-y-3 pl-5 leading-relaxed text-muted-foreground">
          <li>在 Android 手机的浏览器中打开本页，点击“下载 Android 安装包”。</li>
          <li>下载完成后，在浏览器下载列表或文件管理器中打开 APK 文件。</li>
          <li>如系统询问安装权限，请确认文件来自本站，再为本次使用的浏览器或文件管理器允许安装。安装完成后可关闭该权限。</li>
          <li>已安装温油站时可直接更新；如安装失败，请保留现有应用，稍后重试。</li>
        </ol>
        <p className="text-muted-foreground">目前提供 Android 版本；其他设备可继续使用网页版。</p>
      </section>
    </PageShell>
  );
}

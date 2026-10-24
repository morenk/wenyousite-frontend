"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAdminSession } from "@/api/hooks/use-admin";
import {
  useAdminTextFont,
  useAdminTextFontActions,
  useAdminTextFontPreview,
  type AdminFontFamily,
} from "@/api/hooks/admin/use-admin-text-fonts";
import { useContinueAdminFontJob } from "@/api/hooks/admin/use-admin-font-submission";
import { getApiError, getApiErrorMessage } from "@/api/errors";
import {
  emptyTextFontConfiguration,
  textFontMetadataSchema,
  type TextFontConfigurationValues,
} from "@/lib/admin-text-font-form";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { DynamicFontSpecimen } from "@/components/editor/dynamic-font-specimen";
import { TextFontMetadataFields } from "./text-font-metadata-fields";
import { TextFontUploadPanel } from "./text-font-upload-panel";
import { fontFailureReasons, fontLanguageLabels } from "@/lib/admin-text-font-upload";
import fontManagementFixture from "../../../contracts/admin-font-management-v1-fixtures.json";
import { TextFontWithdrawDialog } from "./text-font-withdraw-dialog";
import {
  AdminTable,
  AdminTableHead,
  AdminTableHeader,
  AdminTableBody,
  AdminTableRow,
  AdminTableCell,
  AdminTableActionCell,
  AdminTableActionHeader,
} from "./admin-table";
const statuses = {
  draft: "待处理",
  queued: "排队中",
  processing: "处理中",
  ready: "处理完成",
  failed: "处理失败",
};
const failures = {
  "invalid-font": "字体文件无效",
  "unsupported-font": "不支持此字体格式",
  "rights-required": "授权材料或权限不完整",
  "resource-limit": "超出处理资源限制",
  "sandbox-unavailable": "处理环境暂不可用",
  "processing-failed": "字体处理失败",
};
export function TextFontDetail({ familyId, submissionId }: { familyId?: string; submissionId?: string }) {
  const detail = useAdminTextFont(familyId);
  if (familyId && !detail.data)
    return (
      <div className="space-y-3">
        {detail.isError ? (
          <>
            <p role="alert">字体读取失败</p>
            <Button
              disabled={detail.isFetching}
              onClick={() => void detail.refetch()}
            >
              重试
            </Button>
          </>
        ) : (
          <p role="status">正在读取字体…</p>
        )}
      </div>
    );
  if (!familyId) return <TextFontUploadPanel />;
  return (
    <TextFontEditor
      key={familyId ?? "new"}
      record={detail.data}
      submissionId={submissionId}
      readFailed={detail.isError}
      reload={async () => {
        const result = await detail.refetch();
        if (!result.data || result.isError) throw result.error;
        return result.data;
      }}
    />
  );
}
function TextFontEditor({
  record, submissionId,
  readFailed,
  reload,
}: {
  record?: AdminFontFamily;
  submissionId?: string;
  readFailed: boolean;
  reload: () => Promise<AdminFontFamily>;
}) {
  const session = useAdminSession(),
    actions = useAdminTextFontActions();
  const continueJob = useContinueAdminFontJob();
  const [base, setBase] = useState(record),
    [uploading, setUploading] = useState(false),
    [pending, setPending] = useState<string>(),
    [conflict, setConflict] = useState(false),
    [comparison, setComparison] = useState<AdminFontFamily>(),
    [selected, setSelected] = useState(
      record?.currentVersionId ?? record?.versionIds.at(-1),
    ),
    [withdraw, setWithdraw] = useState(false),
    [readyVersion, setReadyVersion] = useState<string>();
  const lock = useRef(false);
  const previewSection = useRef<HTMLElement>(null);
  const preview = useAdminTextFontPreview(selected);
  const form = useForm<TextFontConfigurationValues>({
    resolver: zodResolver(textFontMetadataSchema),
    defaultValues: record ?? emptyTextFontConfiguration,
  });
  const language = useWatch({ control: form.control, name: "designLanguage" });
  const authenticated = session.sessionStatus === "authenticated";
  const stale =
    conflict || Boolean(base && record && base.revision !== record.revision);
  const disabled = Boolean(pending) || uploading || !authenticated;
  function error(error: unknown) {
    const info = getApiError(error);
    if (info.code === 40928 || (info.status === 409 && info.code !== 40929)) {
      setConflict(true);
      form.setError("root", {
        message: "状态或修订已变化，输入已保留。请读取最新状态后核对。",
      });
      return;
    }
    if (info.code === 40929) {
      form.setError("root", { message: "此历史任务缺少授权材料，请通过上传新版重新提交并确认字体使用权利。" });
      return;
    }
    const message = getApiErrorMessage(error, "操作失败，请重试");
    const field =
      info.code === 40001
        ? message.match(
            /^(name|designLanguage|sortOrder|author|sourceUrl|licenseName|licenseText|specimenText)(?:\b|\.)/,
          )?.[1]
        : undefined;
    if (!info.code && (info.status === undefined || [408, 500, 502, 503, 504].includes(info.status))) {
      setConflict(true);
      if (!base) {
        form.setError("root", { message: "操作结果尚未确认，请返回字体列表核对后再试。" });
        return;
      }
    }
    form.setError(
      (field as keyof TextFontConfigurationValues | undefined) ?? "root",
      { message },
    );
  }
  async function run(action: () => Promise<void>, operation: string) {
    if (lock.current || !authenticated) return;
    lock.current = true;
    setPending(operation);
    form.clearErrors("root");
    try {
      await action();
    } catch (reason) {
      error(reason);
    } finally {
      lock.current = false;
      setPending(undefined);
    }
  }
  function selectVersion(versionId: string) {
    if (versionId === selected) return;
    setReadyVersion(undefined);
    setSelected(versionId);
  }
  const refresh = async (automatic = false) => {
    const value = await reload();
    const configurationChanged = base && (["name", "designLanguage", "author", "sourceUrl", "licenseName", "licenseText", "specimenText"] as const)
      .some((field) => JSON.stringify(base[field]) !== JSON.stringify(value[field]));
    if (automatic && form.formState.isDirty && configurationChanged) {
      setComparison(value); setConflict(true);
      return value;
    }
    setBase(value); setConflict(false);
    if (!form.formState.isDirty) form.reset(value);
    return value;
  };
  const ready = Boolean(
    base && !stale && !readFailed && !form.formState.isDirty,
  );
  return (
    <div className="space-y-5">
      <Link
        href="/station/text-fonts"
        className={buttonVariants({ variant: "ghost", size: "compact" })}
      >
        返回字体列表
      </Link>
      <form
        className="space-y-4 rounded-[var(--radius-panel)] border border-border bg-card p-4"
        onSubmit={form.handleSubmit((values) =>
          run(async () => {
            if (stale || readFailed) return;
            if (base) {
              const saved = await actions.update.mutateAsync({
                ...values,
                specimenText: values.specimenText.trim() || fontManagementFixture.specimens[values.designLanguage],
                sortOrder: base.sortOrder, rights: base.rights,
                familyId: base.familyId,
                expectedFamilyRevision: base.revision,
              });
              setBase({ ...base, ...saved });
              form.reset(values);
              setComparison(undefined);
            }
          }, "save"),
        )}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="font-name" label="字体名称" error={form.formState.errors.name?.message} errorRole="alert">
            {(props) => <Input {...props} {...form.register("name")} disabled={disabled} />}
          </FormField>
          <FormField id="font-language" label="语言">
            {(props) => <Select value={language} disabled={disabled} onValueChange={(value) => { if (value && value in fontLanguageLabels) form.setValue("designLanguage", value as TextFontConfigurationValues["designLanguage"], { shouldDirty: true }); }}>
              <SelectTrigger {...props} className="w-full"><SelectValue>{fontLanguageLabels[language]}</SelectValue></SelectTrigger>
              <SelectContent>{Object.entries(fontLanguageLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
            </Select>}
          </FormField>
        </div>
        <TextFontMetadataFields form={form} disabled={disabled} />
        <Button type="submit" disabled={disabled || stale || readFailed}>
          {pending === "save" ? "正在保存…" : "保存配置"}
        </Button>
      </form>
      {form.formState.errors.root && (
        <p role="alert" className="text-sm text-destructive">
          {form.formState.errors.root.message}
        </p>
      )}
      {(stale || readFailed) && base && (
        <div className="space-y-2 text-sm">
          <p role="alert">最新状态需要核对，当前输入已保留。</p>
          <Button
            variant="outline"
            disabled={disabled}
            onClick={() =>
              void run(async () => {
                const fresh = await refresh();
                setComparison(fresh);
              }, "reload")
            }
          >
            {pending === "reload" ? "正在读取…" : "读取最新状态"}
          </Button>
        </div>
      )}
      {comparison && (
        <div className="space-y-2 rounded-[var(--radius-panel)] border border-border bg-muted p-4 text-sm">
          <p>
            最新配置：{comparison.name || "未命名"} · 作者{" "}
            {comparison.author || "未填写"} · 授权{" "}
            {comparison.licenseName || "未填写"}
          </p>
          <Button
            variant="outline"
            disabled={disabled}
            onClick={() => {
              form.reset(comparison); setBase(comparison); setConflict(false);
              setComparison(undefined);
            }}
          >
            采用服务端配置
          </Button>
        </div>
      )}
      {base && (
        <>
          <TextFontUploadPanel submissionId={submissionId} existing={{ familyId: base.familyId, revision: base.revision, name: base.name, language: base.designLanguage }} disabled={disabled || !ready} onBusyChange={setUploading} onUpdated={async () => { await refresh(true); }}
            onReady={(submission) => { if (submission.job?.versionId) selectVersion(submission.job.versionId); void refresh(true).catch((reason) => error(reason)); }} />
          <section className="space-y-3">
            <h2 className="text-base font-semibold">处理任务</h2>
            <AdminTable className="whitespace-nowrap">
              <AdminTableHead>
                <AdminTableRow>
                  {["任务", "大小", "状态", "结果"].map((label) => (
                    <AdminTableHeader key={label}>{label}</AdminTableHeader>
                  ))}
                  <AdminTableActionHeader>操作</AdminTableActionHeader>
                </AdminTableRow>
              </AdminTableHead>
              <AdminTableBody>
                {record?.jobs.map((job) => (
                  <AdminTableRow key={job.jobId}>
                    <AdminTableCell>{job.jobId.slice(-8)}</AdminTableCell>
                    <AdminTableCell>
                      {(job.sourceBytes / 1048576).toFixed(2)} MiB
                    </AdminTableCell>
                    <AdminTableCell>{statuses[job.status]}</AdminTableCell>
                    <AdminTableCell>
                      {job.failureReason
                        ? fontFailureReasons[job.failureReason]
                        : job.failureCode ? failures[job.failureCode]
                        : (job.versionId?.slice(-8) ?? "—")}
                    </AdminTableCell>
                    <AdminTableActionCell>
                      {job.status === "draft" || job.status === "failed" ? (
                        <Button
                          size="compact"
                          variant="outline"
                          disabled={disabled || !ready}
                          onClick={() =>
                            void run(async () => {
                              const submissionId = job.submissionId;
                              if (submissionId) await continueJob.mutateAsync({ submissionId, jobId: job.jobId, familyId: base.familyId, retryFailed: job.status === "failed" });
                              else await actions.process.mutateAsync(job.jobId);
                              await refresh();
                            }, `process:${job.jobId}`)
                          }
                        >
                          {pending === `process:${job.jobId}` ? "提交处理中…" : job.status === "failed" ? "重试处理" : "开始处理"}
                        </Button>
                      ) : job.versionId ? (
                        <Button
                          size="compact"
                          variant="ghost"
                          disabled={disabled}
                          onClick={() => { selectVersion(job.versionId!); previewSection.current?.scrollIntoView({ block: "start" }); }}
                        >
                          预览
                        </Button>
                      ) : null}
                    </AdminTableActionCell>
                  </AdminTableRow>
                ))}
                {!record?.jobs.length && (
                  <AdminTableRow>
                    <AdminTableCell colSpan={5}>尚未上传源文件</AdminTableCell>
                  </AdminTableRow>
                )}
              </AdminTableBody>
            </AdminTable>
          </section>
          <section ref={previewSection} className="space-y-3 rounded-[var(--radius-panel)] border border-border bg-card p-4">
            <h2 className="text-base font-semibold">版本与发布</h2>
            <Select
              value={selected ?? null}
              onValueChange={(value) => {
                if (typeof value === "string") selectVersion(value);
              }}
              disabled={disabled}
            >
              <SelectTrigger aria-label="字体版本" className="w-full">
                <SelectValue placeholder="选择处理完成的版本">
                  {selected ? `${preview.data?.versionId === selected ? `版本 ${preview.data.versionNumber} · ` : ""}${selected.slice(-8)}${selected === record?.currentVersionId ? " · 当前版本" : ""}` : undefined}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {record?.versionIds.map((id) => (
                  <SelectItem key={id} value={id}>
                    {id.slice(-8)}
                    {id === record.currentVersionId ? " · 当前版本" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {preview.isLoading && selected && (
              <p role="status">正在读取预览…</p>
            )}
            {preview.isError && (
              <div role="alert" className="space-y-2">
                <p>预览读取失败</p>
                <Button
                  variant="outline"
                  disabled={preview.isFetching}
                  onClick={() => void preview.refetch()}
                >
                  重试
                </Button>
              </div>
            )}
            {preview.data && (
              <div className="space-y-3">
                <p className="text-sm">
                  {preview.data.name} · 版本 {preview.data.versionNumber} ·{" "}
                  {preview.data.status === "withdrawn"
                    ? "已撤回"
                    : preview.data.status === "preview"
                      ? "待发布"
                      : preview.data.status === "disabled"
                        ? "已停用"
                        : "已发布"}
                </p>
                <DynamicFontSpecimen
                  key={preview.data.versionId}
                  versionId={preview.data.versionId}
                  descriptor={preview.data}
                  onReady={(ready) => setReadyVersion(ready ? preview.data?.versionId : undefined)}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={
                      disabled ||
                      !ready ||
                      preview.isError ||
                      readyVersion !== selected ||
                      preview.data.versionId !== selected ||
                      preview.data.status === "withdrawn" ||
                      selected === record?.currentVersionId
                    }
                    onClick={() =>
                      void run(async () => {
                        await actions.publish.mutateAsync({
                          familyId: base.familyId,
                          versionId: selected!,
                          expectedFamilyRevision: base.revision,
                          expectedCatalogRevision: base.catalogRevision,
                        });
                        await refresh();
                        await preview.refetch();
                      }, "publish")
                    }
                  >
                    {pending === "publish" ? "正在发布…" : preview.data.status === "preview"
                      ? "发布此版本"
                      : "回滚为当前版本"}
                  </Button>
                  <Button
                    variant="outline"
                    disabled={disabled || !ready || !record?.currentVersionId}
                    onClick={() =>
                      void run(async () => {
                        await actions.enabled.mutateAsync({
                          familyId: base.familyId,
                          enabled: !base.enabled,
                          expectedFamilyRevision: base.revision,
                          expectedCatalogRevision: base.catalogRevision,
                        });
                        await refresh();
                        await preview.refetch();
                      }, "enabled")
                    }
                  >
                    {pending === "enabled" ? "正在更新…" : base.enabled ? "停用家族" : "启用家族"}
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={
                      disabled || !ready || preview.data.status === "withdrawn"
                    }
                    onClick={() => setWithdraw(true)}
                  >
                    紧急撤回此版本
                  </Button>
                </div>
              </div>
            )}
            {!record?.versionIds.length && (
              <p className="text-sm text-muted-foreground">
                处理完成后可预览并发布。
              </p>
            )}
          </section>
        </>
      )}
      {withdraw && selected && base && (
        <TextFontWithdrawDialog
          versionId={selected}
          revision={base.catalogRevision}
          onClose={() => {
            setWithdraw(false);
            void run(async () => {
              await refresh();
              await preview.refetch();
            }, "reload");
          }}
        />
      )}
    </div>
  );
}

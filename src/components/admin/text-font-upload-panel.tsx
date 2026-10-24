"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAdminTextFontPreview } from "@/api/hooks/admin/use-admin-text-fonts";
import { DynamicFontSpecimen } from "@/components/editor/dynamic-font-specimen";
import { getApiError, getApiErrorMessage } from "@/api/errors";
import { useAdminSession } from "@/api/hooks/use-admin";
import { fontSubmissionApi, useAdminFontSubmission, useRefreshAdminFonts, type FontSubmission } from "@/api/hooks/admin/use-admin-font-submission";
import { getAdminSessionSnapshot } from "@/lib/admin-session-store";
import { continueFontSubmission, FontSubmissionCreateRejected, fontRecoveryId, resumeFontSubmissionRecovery, newFontSubmissionRecovery, readFontRecovery, saveFontRecovery, type FontSubmissionRecovery, type FontSubmissionProgress } from "@/lib/admin-font-submission";
import { fontFailureReasons, type AdminTextFontUploadValues, type FontLanguage } from "@/lib/admin-text-font-upload";
import { Button, buttonVariants } from "@/components/ui/button";
import { TextFontUploadForm } from "./text-font-upload-form";

type UploadCallbacks = { submissionId?: string; onReady?: (value: FontSubmission) => void; onUpdated?: () => Promise<void>; onBusyChange?: (busy: boolean) => void };
type ExistingFont = { familyId: string; revision: number; name: string; language: FontLanguage };
export function TextFontUploadPanel({ existing, disabled, onReady, onUpdated, onBusyChange, submissionId }: { existing?: ExistingFont; disabled?: boolean } & UploadCallbacks) {
  const session = useAdminSession();
  const userId = session.data?.user.id;
  if (!userId) return <p role="status">正在核验管理会话…</p>;
  return <SubmissionUpload key={`${userId}:${existing?.familyId ?? "new"}`} storageKey={`admin-font-submission:${userId}:${existing?.familyId ?? "new"}`}
    submissionId={submissionId} existing={existing} disabled={disabled || session.sessionStatus !== "authenticated"} onReady={onReady} onUpdated={onUpdated} onBusyChange={onBusyChange} />;
}
function SubmissionUpload({ storageKey, existing, disabled, onReady, onUpdated, onBusyChange, submissionId }: { storageKey: string; existing?: ExistingFont; disabled?: boolean } & UploadCallbacks) {
  const [recovery, setRecovery] = useState(() => readFontRecovery(storageKey));
  const [ignoreLinked, setIgnoreLinked] = useState(false);
  const [reselectFile, setReselectFile] = useState(Boolean(recovery || submissionId));
  const [progress, setProgress] = useState<FontSubmissionProgress>();
  const [error, setError] = useState("");
  const [result, setResult] = useState<FontSubmission>();
  const lock = useRef(false);
  useEffect(() => { onBusyChange?.(Boolean(progress)); }, [onBusyChange, progress]);
  const notified = useRef<string>(undefined);
  const query = useAdminFontSubmission(recovery ? fontRecoveryId(recovery) : ignoreLinked ? undefined : submissionId);
  const refresh = useRefreshAdminFonts();
  const candidate = query.data ?? result;
  const wrongFamily = Boolean(existing && candidate && existing.familyId !== candidate.familyId);
  const value = wrongFamily ? undefined : candidate;
  const job = value?.job;
  useEffect(() => {
    if (value?.job?.status === "ready" && notified.current !== `${value.job.jobId}:${value.job.versionId}`) {
      notified.current = `${value.job.jobId}:${value.job.versionId}`;
      onReady?.(value);
    }
  }, [onReady, value]);
  const persist = (next: FontSubmissionRecovery) => { saveFontRecovery(storageKey, next); setRecovery(next); };
  const run = async (values?: AdminTextFontUploadValues, retryFailed = false) => {
    if (lock.current || disabled) return;
    lock.current = true; setError("");
    if (values) setReselectFile(false);
    const generation = getAdminSessionSnapshot().generation;
    const current = () => { if (generation !== getAdminSessionSnapshot().generation) throw new DOMException("管理会话已变化", "AbortError"); };
    try {
      let next = recovery;
      if (!next && submissionId && !ignoreLinked) { next = resumeFontSubmissionRecovery(submissionId); persist(next); }
      if (!next) {
        if (!values) throw new Error("请选择字体文件");
        next = newFontSubmissionRecovery({ submissionId: crypto.randomUUID(), name: existing?.name ?? values.name, language: existing?.language ?? values.language,
          ...(existing ? { familyId: existing.familyId, expectedFamilyRevision: existing.revision } : {}) });
        persist(next);
      }
      const saved = await continueFontSubmission({ recovery: next, file: values?.file, retryFailed, persist, progress: setProgress,
        api: {
          read: async (id) => { current(); const value = await fontSubmissionApi.read(id); if (existing && value.familyId !== existing.familyId) throw new Error("提交不属于当前字体"); return value; },
          create: (body) => { current(); return fontSubmissionApi.create(body); },
          upload: (submission, file, bytes) => { current(); return fontSubmissionApi.upload(submission, file, bytes); },
          process: (id, requestId) => { current(); return fontSubmissionApi.process(id, requestId); },
        },
      });
      current(); setResult(saved); await refresh(); current(); await onUpdated?.();
    } catch (reason) {
      if (reason instanceof FontSubmissionCreateRejected) {
        sessionStorage.removeItem(storageKey); setRecovery(undefined);
        if (existing) await onUpdated?.();
      }
      if (values) throw reason;
      setError(getApiErrorMessage(reason, "上传未完成，请查询后继续"));
    }
    finally { lock.current = false; setProgress(undefined); }
  };
  const readError = wrongFamily || (query.isError && getApiError(query.error).status !== 404);
  return <section className="space-y-3 rounded-[var(--radius-panel)] border border-border bg-card p-4">
    {existing && <h2 className="text-base font-semibold">上传新版</h2>}
    {readError && <div role="alert" className="flex items-center gap-3 text-sm"><span>提交状态读取失败</span><Button variant="outline" disabled={query.isFetching || Boolean(progress)} onClick={() => void query.refetch()}>查询结果</Button></div>}
    {(recovery || (submissionId && !ignoreLinked)) && query.isLoading && !progress ? <p role="status">正在恢复提交…</p> : !job ? <>
      {reselectFile && !readError && <p className="text-sm text-muted-foreground">继续时请重新选择原字体文件。</p>}
      <TextFontUploadForm existing={existing ?? (recovery ? { name: recovery.create?.name ?? value?.name ?? "", language: recovery.create?.language ?? value?.language ?? "other" } : undefined)}
        disabled={disabled || readError} progress={progress} onSubmit={run} />
      <p className="text-xs text-muted-foreground">上传即确认有权分发、转换和分片此字体。</p>
    </> : <>
      <p role="status" className="text-sm">{progress ? "正在查询并继续处理…" : job.status === "queued" ? "排队中…" : job.status === "processing" ? "正在处理…" : job.status === "ready" ? "处理完成，请预览后发布。" : job.status === "draft" ? "文件已上传，可继续处理。" : "处理失败，可使用已上传文件重试。"}</p>
      {!existing && job.status === "ready" && job.versionId && <NewFontPreview versionId={job.versionId} />}
      {job.failureReason && <p role="alert" className="text-sm text-destructive">{fontFailureReasons[job.failureReason]}</p>}
      <div className="flex flex-wrap gap-2">
        {(job.status === "draft" || job.status === "failed") && <Button disabled={disabled || readError || Boolean(progress)} onClick={() => void run(undefined, job.status === "failed")}>{job.status === "failed" ? "重试处理" : "继续处理"}</Button>}
        {job.status === "ready" && !existing && <Link href={`/station/text-fonts/${value!.familyId}`} className={buttonVariants()}>预览并发布</Link>}
        {["ready", "failed"].includes(job.status) && <Button variant="outline" disabled={Boolean(progress) || disabled} onClick={() => { sessionStorage.removeItem(storageKey); setIgnoreLinked(true); setReselectFile(false); setRecovery(undefined); setResult(undefined); setError(""); }}>上传另一个文件</Button>}
      </div>
    </>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </section>;
}


function NewFontPreview({ versionId }: { versionId: string }) {
  const preview = useAdminTextFontPreview(versionId);
  if (preview.isError) return <div role="alert" className="flex items-center gap-3 text-sm"><span>样张读取失败</span><Button variant="outline" disabled={preview.isFetching} onClick={() => void preview.refetch()}>重试样张</Button></div>;
  if (!preview.data) return <p role="status" className="text-sm">正在读取样张…</p>;
  return <DynamicFontSpecimen versionId={versionId} descriptor={preview.data} />;
}

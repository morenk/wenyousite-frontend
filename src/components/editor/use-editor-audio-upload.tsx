"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import type { EditorView } from "@milkdown/kit/prose/view";
import type { CrepeBuilder } from "@milkdown/crepe/builder";
import { editorViewCtx } from "@milkdown/core";
import { useApiMeta } from "@/api/hooks/use-api-meta";
import { useUploadAudio } from "@/api/hooks/use-upload-audio";
import { getApiErrorMessage } from "@/api/errors";
import { FinalAudioUploadError, validateAudioFile, type AudioUploadProgress } from "@/lib/upload-audio";
import { isValidMediaAudio, type MarkdownMediaAudio } from "@/lib/markdown-audio";
import { loadAudioDraft, saveAudioDraft, removeAudioDraft, type AudioDraftRecord } from "@/lib/audio-draft";
import { createAudioUploadAnchor } from "./editor-audio-anchor";
import { toast } from "sonner";
import { AudioUploadCard } from "@/components/shared/audio-player";

/** 可变上传会话属于外部任务状态，React 只持有其稳定身份与展示快照。 */
class UploadScope {
  active = true;
  generation = 0;
  controller: AbortController | null = null;
  file: File | null = null;
  backup: AudioDraftRecord | null = null;
  view: EditorView | null = null;
  restoring: boolean;
  constructor(readonly key: string | null, readonly userId?: string) { this.restoring = key !== null; }
  restored() { this.restoring = false; }
  activate() { this.active = true; }
  invalidate() { this.active = false; this.generation++; this.controller?.abort(); this.file = null; this.backup = null; }
  begin() { this.controller?.abort(); this.controller = new AbortController(); this.generation++; return this.controller; }
  finishRequest() { this.controller = null; }
  setBackup(record: AudioDraftRecord) { this.backup = record; }
  setPending(file: File, record: AudioDraftRecord | null, view: EditorView) { this.file = file; this.backup = record; this.view = view; }
  inserted() { this.file = null; }
  remove() { this.controller?.abort(); this.controller = null; return ++this.generation; }
  clear() { this.file = null; this.backup = null; }
  clearReservation() { if (this.backup) this.backup = { ...this.backup, mediaId: undefined }; }
}
type UploadUi = {
  scope: UploadScope;
  target: HTMLElement | null;
  fileName: string;
  status: "idle" | "uploading" | "paused" | "failed";
  progress: AudioUploadProgress | null;
  error: string;
};
const idleUi = (scope: UploadScope): UploadUi => ({ scope, target: null, fileName: "", status: "idle", progress: null, error: "" });

/** 文件、预约和异步回调都绑定账号与编辑目标，恢复只由用户显式继续。 */
export function useEditorAudioUpload(editor: RefObject<CrepeBuilder | null>, userId: string | undefined, draftKey: string | undefined, loading: boolean, onCompleted?: (media: MarkdownMediaAudio) => Promise<void> | void) {
  const { data: meta } = useApiMeta();
  const { mutateAsync: upload } = useUploadAudio();
  const capability = meta?.audioUpload;
  const capabilityRef = useRef(capability);
  useEffect(() => { capabilityRef.current = capability; }, [capability]);
  const [anchor] = useState(createAudioUploadAnchor);
  const storageKey = userId && draftKey ? JSON.stringify([userId, draftKey]) : null;
  const scope = useMemo(() => new UploadScope(storageKey, userId), [storageKey, userId]);
  const [state, setState] = useState(() => idleUi(scope));
  const ui = state.scope === scope ? state : idleUi(scope);
  useLayoutEffect(() => {
    scope.activate();
    return () => {
      scope.invalidate();
      if (scope.view && !scope.view.isDestroyed) anchor.remove(scope.view);
      anchor.setTarget(null);
    };
  }, [anchor, scope]);
  useEffect(() => {
    if (loading || !scope.key || !scope.userId) return;
    const generation = scope.generation;
    const valid = () => scope.active && scope.generation === generation;
    void loadAudioDraft(scope.key, scope.userId).then(async (record) => {
      if (!valid() || !record || scope.file) return;
      const view = editor.current?.editor.action((ctx) => ctx.get(editorViewCtx));
      if (!view) return;
      let exists = false;
      if (record.completed) view.state.doc.descendants((node) => {
        if (node.marks.some((mark) => mark.type.name === "link" && mark.attrs.href === record.completed?.sourceUrl)) exists = true;
      });
      if (exists && record.completed) {
        if (valid()) await onCompleted?.(record.completed);
        if (valid()) await removeAudioDraft(record.key);
        return;
      }
      const target = document.createElement("div"); target.contentEditable = "false"; target.className = "not-prose my-2";
      scope.setPending(record.file, record, view);
      anchor.setTarget(target); anchor.start(view);
      setState({ ...idleUi(scope), target, fileName: record.file.name, status: "paused" });
    }).catch(() => { if (valid()) toast.error("本机音频恢复失败，请重试"); }).finally(() => { if (valid()) scope.restored(); });
  }, [anchor, editor, loading, onCompleted, scope]);
  useEffect(() => {
    if (ui.status === "idle") return;
    const protect = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, [ui.status]);

  const run = async (file: File) => {
    if (!scope.active || !scope.key || !scope.userId) return;
    const controller = scope.begin();
    const generation = scope.generation;
    const valid = () => scope.active && scope.generation === generation;
    const assertCurrent = () => { controller.signal.throwIfAborted(); if (!valid()) throw new DOMException("上传已取消", "AbortError"); };
    const update = (patch: Partial<UploadUi>) => { if (valid()) setState((previous) => ({ ...previous, ...patch, scope })); };
    update({ status: "uploading", error: "", progress: { stage: "uploading", percent: 0 } });
    try {
      const existing = scope.backup;
      const record: AudioDraftRecord = { key: scope.key, userId: scope.userId, file, mediaId: existing?.mediaId, completed: existing?.completed, updatedAt: Date.now() };
      scope.setBackup(record);
      await saveAudioDraft(record); assertCurrent();
      let media = record.completed;
      if (!isValidMediaAudio(media)) {
        const available = capabilityRef.current;
        if (!available) throw new Error("音频上传暂不可用");
        media = await upload({ file, capability: available, options: {
          signal: controller.signal,
          onProgress: (progress) => update({ progress }),
          resume: record.mediaId ? { mediaId: record.mediaId } : undefined,
          onReservation: async ({ mediaId }) => { assertCurrent(); record.mediaId = mediaId; await saveAudioDraft(record); assertCurrent(); },
        } });
        assertCurrent(); record.completed = media;
        await saveAudioDraft(record); assertCurrent();
      }
      await onCompleted?.(media); assertCurrent();
      const view = editor.current?.editor.action((ctx) => ctx.get(editorViewCtx));
      if (!view || !anchor.insert(view, media.sourceUrl, file.name)) throw new Error("插入位置已失效，请重新选择音频");
      scope.inserted(); update({ status: "idle", fileName: "" });
    } catch (failure) {
      if (!valid()) return;
      if (failure instanceof FinalAudioUploadError && scope.backup) {
        scope.clearReservation();
        try { await saveAudioDraft(scope.backup); } catch { update({ status: "failed", error: "本机音频保存失败，请重试" }); return; }
      }
      if (!valid()) return;
      update(controller.signal.aborted || (failure instanceof DOMException && failure.name === "AbortError") ? { status: "paused" } : { status: "failed", error: getApiErrorMessage(failure, "音频上传失败，请重试") });
    } finally { if (valid()) scope.finishRequest(); }
  };
  const open = () => {
    if (!scope.active || !capabilityRef.current) return;
    if (scope.restoring) { toast.error("正在恢复本机音频，请稍后"); return; }
    if (scope.file) { toast.error("请先完成或移除当前音频"); return; }
    const generation = scope.generation;
    const input = document.createElement("input"); input.type = "file";
    input.accept = ".mp3,.m4a,.mp4,.wav,.ogg,.oga,.flac,audio/mpeg,audio/mp4,audio/wav,audio/ogg,audio/flac";
    input.onchange = () => {
      if (!scope.active || scope.generation !== generation) return;
      const file = input.files?.[0]; const available = capabilityRef.current;
      if (!file || !available) return;
      const validation = validateAudioFile(file, available);
      if (validation) { toast.error(validation); return; }
      const view = editor.current?.editor.action((ctx) => ctx.get(editorViewCtx));
      if (!view) return;
      const target = document.createElement("div"); target.contentEditable = "false"; target.className = "not-prose my-2";
      anchor.setTarget(target); anchor.start(view); scope.setPending(file, null, view);
      setState({ ...idleUi(scope), target, fileName: file.name, status: "uploading" });
      void run(file);
    };
    input.click();
  };
  const remove = async () => {
    const generation = scope.remove();
    const valid = () => scope.active && scope.generation === generation;
    try { if (scope.key) await removeAudioDraft(scope.key); }
    catch { if (valid()) setState((previous) => ({ ...previous, status: "failed", error: "本机音频移除失败，请重试" })); return; }
    if (!valid()) return;
    scope.clear();
    const view = editor.current?.editor.action((ctx) => ctx.get(editorViewCtx));
    if (view) anchor.remove(view);
    setState(idleUi(scope));
  };
  return {
    available: Boolean(capability?.version === 1 && userId && draftKey),
    anchor,
    open,
    hasPending: () => scope.restoring || scope.file !== null,
    placeholder: ui.target && ui.status !== "idle" ? createPortal(
      <AudioUploadCard fileName={ui.fileName} status={ui.status} progress={ui.progress} error={ui.error}
        onCancel={() => scope.controller?.abort()}
        onResume={() => { if (scope.file) void run(scope.file); }}
        onRemove={() => void remove()} />, ui.target,
    ) : null,
  };
}

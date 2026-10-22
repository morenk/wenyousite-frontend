"use client";
import { useRef, useState } from "react";
import { normalizeTextFont, textFontFamily } from "@/lib/markdown-text-font";
import { useVisibleTextFonts } from "./use-visible-text-fonts";
import { textFontPreviewSample } from "./editor-text-font-options";
export function EditorFontPreview({ fontId, designLanguage }: { fontId: string; designLanguage?: unknown }) {
  const root = useRef<HTMLSpanElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "fallback">("loading");
  useVisibleTextFonts(root, fontId, setStatus);
  return <span ref={root} className="grid gap-1"><span data-wenyou-font-v1={normalizeTextFont(fontId) ?? undefined} style={{ fontFamily: textFontFamily(fontId) }} className="text-lg">{textFontPreviewSample(designLanguage)}</span>{status !== "ready" && <span role="status" className="text-xs text-muted-foreground">{status === "loading" ? "正在加载字体…" : "字体不可用，已使用系统字体"}</span>}</span>;
}

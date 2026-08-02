/** MarkdownContent：共享 Markdown 渲染，图片约束尺寸 + 懒加载 + 点击查看原图 */

"use client";

import { useState, type ComponentProps } from "react";
import ReactMarkdown, { type Components, type ExtraProps } from "react-markdown";
import remarkGfm from "remark-gfm";
import { getImageUrlBySize } from "@/lib/upload-image";
import { ImageLightbox } from "@/components/thread/image-lightbox";

/** 判断是否为本站上传图片（objectKey 统一以 uploads/ 开头）且非派生图 */
function isUploadedMediaUrl(url: string): boolean {
  return (
    url.includes("/uploads/") &&
    !url.endsWith("_md.webp") &&
    !url.endsWith("_thumb.webp")
  );
}

type ImageProps = ComponentProps<"img"> & ExtraProps;

/** 图片组件：本站上传图默认显示 _md.webp 中图，失败回退原图；点击打开原图 lightbox */
function MarkdownImage({ src, alt }: ImageProps) {
  const originalUrl = typeof src === "string" ? src : "";
  const mediumUrl = isUploadedMediaUrl(originalUrl)
    ? getImageUrlBySize(originalUrl, "md")
    : originalUrl;
  const [failed, setFailed] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const displaySrc = failed ? originalUrl : mediumUrl;

  // 空 URL 图片（历史脏数据如 ![1.00]()）直接不渲染，避免破图图标 + alt 泄漏
  if (!originalUrl) return null;

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- COS 远程图 + onError 回退 + lightbox，用原生 img */}
      <img
        src={displaySrc}
        alt={alt ?? ""}
        loading="lazy"
        className="mx-auto my-2 block max-w-full cursor-zoom-in rounded-lg"
        style={{ maxWidth: "100%", height: "auto" }}
        onError={() => {
          if (mediumUrl !== originalUrl) setFailed(true);
        }}
        onClick={() => setLightboxOpen(true)}
      />
      {lightboxOpen && (
        <ImageLightbox
          src={originalUrl}
          alt={alt}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </>
  );
}

const components: Components = {
  img: MarkdownImage,
};

interface MarkdownContentProps {
  content: string;
}

export function MarkdownContent({ content }: MarkdownContentProps) {
  return (
    <div className="prose prose-sm max-w-none dark:prose-invert">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}

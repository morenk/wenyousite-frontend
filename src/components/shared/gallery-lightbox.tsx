/** 多图沉浸查看器：统一键盘、触控、缩放与原图加载。 */

"use client";

import Lightbox, { type Render } from "yet-another-react-lightbox";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import { useReducedMotion } from "framer-motion";
import { motionTokens } from "@/lib/motion";

export interface GalleryLightboxImage {
  src: string;
  alt: string;
  width?: number | null;
  height?: number | null;
}

interface GalleryLightboxProps {
  images: GalleryLightboxImage[];
  renderSlide?: Render["slide"];
  preload?: number;
  index: number;
  onClose: () => void;
}

export function GalleryLightbox({ images, index, onClose, renderSlide, preload = 2 }: GalleryLightboxProps) {
  const reduced = useReducedMotion();
  return (
    <Lightbox
      open
      close={onClose}
      index={index}
      animation={{ fade: reduced ? 0 : motionTokens.standardMs,
        swipe: reduced ? 0 : motionTokens.slowMs, navigation: reduced ? 0 : motionTokens.standardMs,
        easing: { fade: motionTokens.standardEase, swipe: motionTokens.standardEase, navigation: motionTokens.standardEase } }}
      slides={images.map((image) => ({
        src: image.src,
        alt: image.alt,
        width: image.width ?? undefined,
        height: image.height ?? undefined,
      }))}
      render={renderSlide ? { slide: renderSlide } : undefined}
      plugins={[Zoom]}
      carousel={{ finite: images.length <= 1, preload, imageFit: "contain" }}
      zoom={{ maxZoomPixelRatio: 2, zoomInMultiplier: 2 }}
      labels={{
        Previous: "上一张",
        Next: "下一张",
        Close: "关闭大图",
        Slide: "图片",
        Carousel: "图片画廊",
        Lightbox: "查看大图",
        "Photo gallery": "图片画廊",
        "{index} of {total}": "第 {index} 张，共 {total} 张",
        "Zoom in": "放大",
        "Zoom out": "缩小",
      }}
    />
  );
}

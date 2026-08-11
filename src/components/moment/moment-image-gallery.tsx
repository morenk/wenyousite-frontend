/** 动态详情图片舞台：Embla 拖动切换、缩略导航与按需大图查看。 */

"use client";

import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { MomentDetail } from "@/api/hooks/use-moments";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const GalleryLightbox = dynamic(
  () => import("@/components/shared/gallery-lightbox").then((module) => module.GalleryLightbox),
  { ssr: false },
);

type MomentImage = MomentDetail["images"][number];

interface MomentImageGalleryProps {
  title: string;
  images: MomentImage[];
  coverMedia?: MomentDetail["coverMedia"];
}

function getCarouselAspectRatio(image: { width: number | null; height: number | null } | null | undefined): number {
  if (!image?.width || !image.height) return 1;
  return Math.max(3 / 4, Math.min(16 / 10, image.width / image.height));
}

export function MomentImageGallery({ title, images, coverMedia }: MomentImageGalleryProps) {
  const [viewportRef, emblaApi] = useEmblaCarousel({
    loop: images.length > 1,
    align: "start",
    duration: 24,
    watchDrag: images.length > 1,
  });
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const aspectRatio = getCarouselAspectRatio(coverMedia ?? images[0]);

  const syncSelection = useCallback(() => {
    if (emblaApi) setActiveIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on("select", syncSelection);
    emblaApi.on("reInit", syncSelection);
    return () => {
      emblaApi.off("select", syncSelection);
      emblaApi.off("reInit", syncSelection);
    };
  }, [emblaApi, syncSelection]);

  const lightboxImages = useMemo(() => images.map((image, index) => ({
    src: image.url,
    alt: `${title}，第 ${index + 1} 张图片`,
    width: image.width,
    height: image.height,
  })), [images, title]);

  if (images.length === 0) return null;

  return (
    <section
      data-slot="moment-detail-carousel"
      aria-roledescription="轮播图"
      aria-label={`${title}的图片，共 ${images.length} 张`}
      className="w-full bg-muted/40 p-2"
    >
      <div className="relative overflow-hidden" ref={viewportRef}>
        <div className="flex touch-pan-y">
          {images.map((image, index) => (
            <div key={image.id} className="min-w-0 flex-[0_0_100%]">
              <button
                type="button"
                data-slot="moment-detail-image"
                onClick={() => setLightboxIndex(index)}
                className="relative block w-full max-h-[min(72vh,42rem)] overflow-hidden rounded-xl bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/40"
                style={{ aspectRatio }}
                aria-label={`查看大图：${title}，第 ${index + 1} 张图片`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- COS 处理中图已按契约选择 */}
                <img
                  src={image.mediumUrl ?? image.url}
                  alt={`${title}，第 ${index + 1} 张图片`}
                  width={image.width ?? undefined}
                  height={image.height ?? undefined}
                  loading={index === 0 ? "eager" : "lazy"}
                  decoding="async"
                  draggable={false}
                  className="h-full w-full select-none object-contain"
                />
              </button>
            </div>
          ))}
        </div>

        {images.length > 1 ? (
          <>
            <Tooltip content="上一张图片" side="right">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => emblaApi?.scrollPrev()}
                className="absolute left-3 top-1/2 z-10 -mt-4 bg-foreground/60 text-background shadow-popover hover:bg-foreground/75 hover:text-background"
                aria-label="上一张图片"
              >
                <ChevronLeft />
              </Button>
            </Tooltip>
            <Tooltip content="下一张图片" side="left">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => emblaApi?.scrollNext()}
                className="absolute right-3 top-1/2 z-10 -mt-4 bg-foreground/60 text-background shadow-popover hover:bg-foreground/75 hover:text-background"
                aria-label="下一张图片"
              >
                <ChevronRight />
              </Button>
            </Tooltip>
            <span
              className="absolute bottom-3 right-3 z-10 rounded-full bg-foreground/65 px-2.5 py-1 font-utility text-xs font-bold tabular-nums text-background"
              aria-live="polite"
            >
              {activeIndex + 1} / {images.length}
            </span>
          </>
        ) : null}
      </div>

      {images.length > 1 ? (
        <div className="mt-2 flex max-w-full justify-center gap-1.5 overflow-x-auto px-1 pb-0.5" aria-label="选择图片">
          {images.map((image, index) => (
            <button
              key={image.id}
              type="button"
              onClick={() => emblaApi?.scrollTo(index)}
              aria-label={`显示第 ${index + 1} 张图片`}
              aria-current={activeIndex === index ? "true" : undefined}
              className={cn(
                "size-10 shrink-0 overflow-hidden rounded-lg border bg-card p-0.5 opacity-65 transition-[border-color,opacity,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
                activeIndex === index
                  ? "border-brand-strong opacity-100 ring-1 ring-brand-strong/20"
                  : "border-border hover:opacity-100",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- 缩略图优先使用服务端派生图 */}
              <img
                src={image.thumbnailUrl ?? image.feedUrl ?? image.mediumUrl ?? image.url}
                alt=""
                aria-hidden="true"
                draggable={false}
                className="h-full w-full rounded-md object-cover"
              />
            </button>
          ))}
        </div>
      ) : null}

      {lightboxIndex !== null ? (
        <GalleryLightbox
          images={lightboxImages}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      ) : null}
    </section>
  );
}

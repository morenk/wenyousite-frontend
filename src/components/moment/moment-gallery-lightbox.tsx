"use client";

import { useState } from "react";
import { GalleryLightbox, type GalleryLightboxImage } from "@/components/shared/gallery-lightbox";
import { MomentMediaImage } from "@/components/moment/moment-media-image";
import type { MomentMediaAsset } from "@/lib/moment-media";

interface MomentGalleryImage extends GalleryLightboxImage { momentMedia: MomentMediaAsset }

/** 动态专用策略通过通用渲染扩展注入，主题帖继续使用灯箱默认行为。 */
export function MomentGalleryLightbox({ images, index, onClose }: { images: MomentGalleryImage[]; index: number; onClose: () => void }) {
  const [naturalSizes, setNaturalSizes] = useState<Record<string, { width: number; height: number }>>({});
  return <GalleryLightbox
    images={images.map((image) => ({ ...image, width: image.width ?? naturalSizes[image.src]?.width, height: image.height ?? naturalSizes[image.src]?.height }))}
    index={index}
    onClose={onClose}
    preload={0}
    renderSlide={({ slide, offset, rect }) => {
          const image = images.find((image) => image.src === slide.src);
          const width = image?.width ?? (image && naturalSizes[image.src]?.width) ?? rect.width;
          const height = image?.height ?? (image && naturalSizes[image.src]?.height) ?? rect.height;
          const scale = Math.min(1, rect.width / width, rect.height / height);
          return image?.momentMedia ? <MomentMediaImage
            media={image.momentMedia}
            allowPlayback={offset === 0}
            wrapperStyle={{ width: width * scale, height: height * scale }}
            mode="full"
            foreground
            alt={image.alt}
            onLoad={(event) => {
              const { naturalWidth: width, naturalHeight: height } = event.currentTarget;
              if (event.currentTarget.getAttribute("src") === image.src && width > 0 && height > 0 && !naturalSizes[image.src] && (!image.width || !image.height)) {
                setNaturalSizes((sizes) => ({ ...sizes, [image.src]: { width, height } }));
              }
            }}
            width={image.width ?? undefined}
            height={image.height ?? undefined}
            className="h-full w-full object-contain"
          /> : undefined;
        }}
  />;
}

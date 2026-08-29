/** 头像裁剪：将 react-easy-crop 的裁剪区域输出为 512×512 webp Blob */

import { cropImageToBlob, type CropArea } from "@/lib/image-crop";

export type { CropArea } from "@/lib/image-crop";

const OUTPUT_SIZE = 512;

/** 按 1:1 裁剪区域绘制并优先导出 WebP Blob（quality 0.9；浏览器可回退 PNG）。
 * react-easy-crop 的 croppedAreaPixels 已基于原图自然像素（mediaNaturalBBoxSize），
 * 可直接作为 drawImage 源矩形，切勿再按缩放比换算，否则会偏移/溢出/留白。 */
export async function getCroppedBlob(imageSrc: string, crop: CropArea): Promise<Blob> {
  return cropImageToBlob(imageSrc, crop, {
    width: OUTPUT_SIZE,
    height: OUTPUT_SIZE,
    type: "image/webp",
    quality: 0.9,
  });
}

/** 个人主页背景图双画幅裁剪：同一原图分别输出 Web 3:1 与移动端 2:1，优先 WebP。 */

import { cropImageToBlob, type CropArea } from "@/lib/image-crop";

const OUTPUT_QUALITY = 0.92;

export const PROFILE_COVER_SPECS = {
  web: {
    label: "电脑端",
    aspect: 3,
    width: 1920,
    height: 640,
    filenameStem: "profile-cover-web",
  },
  mobile: {
    label: "移动端",
    aspect: 2,
    width: 1600,
    height: 800,
    filenameStem: "profile-cover-mobile",
  },
} as const;

export type ProfileCoverSurface = keyof typeof PROFILE_COVER_SPECS;

export async function getCroppedProfileCoverBlob(
  imageSrc: string,
  crop: CropArea,
  surface: ProfileCoverSurface,
): Promise<Blob> {
  const spec = PROFILE_COVER_SPECS[surface];
  return cropImageToBlob(imageSrc, crop, {
    width: spec.width,
    height: spec.height,
    type: "image/webp",
    quality: OUTPUT_QUALITY,
  });
}

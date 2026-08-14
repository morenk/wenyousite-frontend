/** 个人主页背景图双画幅裁剪：同一原图分别输出 Web 3:1 与移动端 2:1 WebP。 */

import type { CropArea } from "@/lib/avatar-crop";

const OUTPUT_QUALITY = 0.92;

export const PROFILE_COVER_SPECS = {
  web: {
    label: "电脑端",
    aspect: 3,
    width: 1920,
    height: 640,
    filename: "profile-cover-web.webp",
  },
  mobile: {
    label: "移动端",
    aspect: 2,
    width: 1600,
    height: 800,
    filename: "profile-cover-mobile.webp",
  },
} as const;

export type ProfileCoverSurface = keyof typeof PROFILE_COVER_SPECS;

function createImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("图片加载失败"));
    image.src = src;
  });
}

export async function getCroppedProfileCoverBlob(
  imageSrc: string,
  crop: CropArea,
  surface: ProfileCoverSurface,
): Promise<Blob> {
  const spec = PROFILE_COVER_SPECS[surface];
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  canvas.width = spec.width;
  canvas.height = spec.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("当前浏览器不支持画布裁剪");

  context.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    spec.width,
    spec.height,
  );

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/webp", OUTPUT_QUALITY);
  });
  if (!blob) throw new Error("裁剪失败，请重试");
  return blob;
}

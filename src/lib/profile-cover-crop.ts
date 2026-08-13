/** 个人主页背景图裁剪：将 react-easy-crop 区域输出为 1920×640 高质量 WebP。 */

import type { CropArea } from "@/lib/avatar-crop";

const OUTPUT_WIDTH = 1920;
const OUTPUT_HEIGHT = 640;
const OUTPUT_QUALITY = 0.92;

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
): Promise<Blob> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT_WIDTH;
  canvas.height = OUTPUT_HEIGHT;
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
    OUTPUT_WIDTH,
    OUTPUT_HEIGHT,
  );

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/webp", OUTPUT_QUALITY);
  });
  if (!blob) throw new Error("裁剪失败，请重试");
  return blob;
}

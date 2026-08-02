/** 头像裁剪：将 react-easy-crop 的裁剪区域输出为 512×512 webp Blob */

export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

const OUTPUT_SIZE = 512;

function createImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("图片加载失败"));
    img.src = src;
  });
}

/** 按 1:1 裁剪区域绘制并导出 webp Blob（quality 0.9）。
 * react-easy-crop 的 croppedAreaPixels 已基于原图自然像素（mediaNaturalBBoxSize），
 * 可直接作为 drawImage 源矩形，切勿再按缩放比换算，否则会偏移/溢出/留白。 */
export async function getCroppedBlob(imageSrc: string, crop: CropArea): Promise<Blob> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("当前浏览器不支持画布裁剪");

  ctx.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    OUTPUT_SIZE,
    OUTPUT_SIZE,
  );

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/webp", 0.9);
  });
  if (!blob) throw new Error("裁剪失败，请重试");
  return blob;
}

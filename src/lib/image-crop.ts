/** 通用图片裁剪：按自然像素源矩形绘制并导出指定规格的图片 Blob。 */

export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface CropImageOptions {
  width: number;
  height: number;
  type?: string;
  quality?: number;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("图片加载失败"));
    image.src = src;
  });
}

export async function cropImageToBlob(
  imageSrc: string,
  crop: CropArea,
  {
    width,
    height,
    type = "image/webp",
    quality,
  }: CropImageOptions,
): Promise<Blob> {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
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
    width,
    height,
  );

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, type, quality);
  });
  if (!blob) throw new Error("裁剪失败，请重试");
  return blob;
}

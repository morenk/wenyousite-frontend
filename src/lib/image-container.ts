/** 在任何有损绘制之前检查容器；实际像素解码和安全校验仍由浏览器及服务端负责。 */
type ImageKind = "jpeg" | "png" | "gif" | "webp" | "avif";
interface ImageContainer { kind: ImageKind; animated: boolean }
const INVALID_IMAGE = "图片格式无效或文件已损坏，请重新选择";
const ANIMATION_UNSUPPORTED = "暂不支持此格式的动图，请使用 GIF 或静态图片";

const PNG_CRC_TABLE = Uint32Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  return crc >>> 0;
});

function invalid(): never { throw new Error(INVALID_IMAGE); }

export function inspectImageContainer(bytes: Uint8Array): ImageContainer {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const text = (offset: number, length: number) => String.fromCharCode(...bytes.subarray(offset, offset + length));
  const u32 = (offset: number, littleEndian = false) => view.getUint32(offset, littleEndian);
  const requireBytes = (offset: number, length: number) => {
    if (offset + length > bytes.length) invalid();
  };
  if (text(0, 6) === "GIF87a" || text(0, 6) === "GIF89a") {
    requireBytes(0, 13);
    if (!view.getUint16(6, true) || !view.getUint16(8, true)) invalid();
    let offset = 13 + (bytes[10] & 0x80 ? 3 * 2 ** ((bytes[10] & 7) + 1) : 0);
    let frames = 0;
    const skipBlocks = () => {
      while (true) {
        requireBytes(offset, 1);
        const size = bytes[offset++];
        requireBytes(offset, size);
        offset += size;
        if (!size) return;
      }
    };
    while (offset < bytes.length) {
      const marker = bytes[offset++];
      if (marker === 0x3b) {
        if (!frames) invalid();
        return { kind: "gif", animated: frames > 1 };
      }
      if (marker === 0x21) {
        requireBytes(offset, 1);
        offset++;
        skipBlocks();
      } else if (marker === 0x2c) {
        requireBytes(offset, 9);
        if (!view.getUint16(offset + 4, true) || !view.getUint16(offset + 6, true)) invalid();
        const packed = bytes[offset + 8];
        offset += 9 + (packed & 0x80 ? 3 * 2 ** ((packed & 7) + 1) : 0);
        requireBytes(offset, 1);
        if (bytes[offset] < 2 || bytes[offset] > 8) invalid();
        offset++;
        skipBlocks();
        frames++;
      } else invalid();
    }
    invalid();
  }
  if (text(0, 8) === "\x89PNG\r\n\x1a\n") {
    let offset = 8;
    let animated = false;
    let imageData = false;
    while (offset < bytes.length) {
      requireBytes(offset, 12);
      const size = u32(offset);
      const type = text(offset + 4, 4);
      requireBytes(offset, size + 12);
      if (offset === 8 && (type !== "IHDR" || size !== 13)) invalid();
      let crc = 0xffffffff;
      for (let index = offset + 4; index < offset + 8 + size; index++) {
        crc = (crc >>> 8) ^ PNG_CRC_TABLE[(crc ^ bytes[index]) & 0xff];
      }
      if (((crc ^ 0xffffffff) >>> 0) !== u32(offset + 8 + size)) invalid();
      if (type === "acTL" || type === "fcTL" || type === "fdAT") animated = true;
      if (type === "IDAT") imageData = true;
      offset += size + 12;
      if (type === "IEND") {
        if (size || !imageData || offset !== bytes.length) invalid();
        return { kind: "png", animated };
      }
    }
    invalid();
  }
  if (text(0, 4) === "RIFF" && text(8, 4) === "WEBP") {
    requireBytes(0, 12);
    if (u32(4, true) + 8 !== bytes.length) invalid();
    let offset = 12;
    let animated = false;
    let imageData = false;
    while (offset < bytes.length) {
      requireBytes(offset, 8);
      const type = text(offset, 4);
      const size = u32(offset + 4, true);
      requireBytes(offset, 8 + size + size % 2);
      if (type === "VP8X") {
        if (size !== 10) invalid();
        animated ||= Boolean(bytes[offset + 8] & 2);
      }
      if (type === "ANIM" || type === "ANMF") animated = true;
      if (type === "VP8 " || type === "VP8L" || type === "ANMF") imageData = true;
      offset += 8 + size + size % 2;
    }
    if (!imageData) invalid();
    return { kind: "webp", animated };
  }
  if (text(4, 4) === "ftyp") {
    // AVIF 动画使用 avis 品牌和时序轨道；按 box 边界读取，不能扫描压缩载荷。
    let offset = 0;
    let avif = false;
    let animated = false;
    while (offset < bytes.length) {
      requireBytes(offset, 8);
      const type = text(offset + 4, 4);
      let size = u32(offset);
      let header = 8;
      if (size === 1) {
        requireBytes(offset, 16);
        const largeSize = view.getBigUint64(offset + 8);
        if (largeSize > BigInt(Number.MAX_SAFE_INTEGER)) invalid();
        size = Number(largeSize);
        header = 16;
      } else if (!size) size = bytes.length - offset;
      if (size < header) invalid();
      requireBytes(offset, size);
      if (type === "ftyp") {
        if (offset || size < header + 8 || (size - header) % 4) invalid();
        for (let brandOffset = offset + header; brandOffset < offset + size; brandOffset += 4) {
          if (brandOffset === offset + header + 4) continue;
          const brand = text(brandOffset, 4);
          avif ||= brand === "avif" || brand === "avis";
          animated ||= brand === "avis";
        }
      }
      animated ||= type === "moov";
      offset += size;
    }
    if (!avif) invalid();
    return { kind: "avif", animated };
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { kind: "jpeg", animated: false };
  }
  invalid();
}

/** 只允许 GIF 保留动画；裁剪和动态发布等静态入口连 GIF 也不得送入 Canvas。 */
export async function assertImageCanBeProcessed(file: File, staticOnly = false): Promise<ImageContainer> {
  const container = inspectImageContainer(new Uint8Array(await file.arrayBuffer()));
  if (file.type !== `image/${container.kind}`) {
    throw new Error("图片声明格式与实际内容不一致，请重新选择或导出图片");
  }
  if (staticOnly && (container.animated || container.kind === "gif")) {
    throw new Error("此处暂不支持动图，请使用静态图片");
  }
  if (container.animated && container.kind !== "gif") throw new Error(ANIMATION_UNSUPPORTED);
  return container;
}

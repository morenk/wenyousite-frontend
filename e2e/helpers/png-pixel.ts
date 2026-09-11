import { inflateSync } from "node:zlib";
/** 仅用于读取 Chromium 截图中心像素，不参与产品图像处理。 */
export function centerPixel(png: Buffer): number[] {
  const chunks: Buffer[] = []; let width = 0, height = 0, channels = 0;
  for (let offset = 8; offset < png.length;) {
    const length = png.readUInt32BE(offset), kind = png.toString("ascii", offset + 4, offset + 8);
    const data = png.subarray(offset + 8, offset + 8 + length);
    if (kind === "IHDR") { width = data.readUInt32BE(0); height = data.readUInt32BE(4); channels = data[9] === 6 ? 4 : data[9] === 2 ? 3 : 0; if (data[8] !== 8 || !channels) throw new Error("Unsupported screenshot PNG"); }
    if (kind === "IDAT") chunks.push(data); offset += length + 12;
  }
  const raw = inflateSync(Buffer.concat(chunks)), stride = width * channels; let prior = Buffer.alloc(stride);
  for (let y = 0; y <= Math.floor(height / 2); y++) {
    const offset = y * (stride + 1), filter = raw[offset], row = Buffer.from(raw.subarray(offset + 1, offset + 1 + stride));
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? row[x - channels] : 0, b = prior[x], c = x >= channels ? prior[x - channels] : 0;
      let prediction = 0;
      if (filter === 1) prediction = a; else if (filter === 2) prediction = b; else if (filter === 3) prediction = Math.floor((a + b) / 2);
      else if (filter === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); prediction = pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      row[x] = (row[x] + prediction) & 255;
    }
    prior = row;
  }
  return [...prior.subarray(Math.floor(width / 2) * channels, Math.floor(width / 2) * channels + 3)];
}

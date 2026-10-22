/** 已验证描述符的通用字形覆盖和字节校验，不读取目录或字体 ID 白名单。 */
export function rangesContain(
  ranges: readonly string[],
  codepoint: number,
): boolean {
  return ranges.some((range) => {
    const [start, end = start] = range
      .slice(2)
      .split("-")
      .map((v) => parseInt(v, 16));
    return codepoint >= start! && codepoint <= end!;
  });
}
export function requiredFontShards<
  T extends readonly { unicodeRanges: readonly string[] }[],
>(shards: T, text: string): T[number][] {
  const points = [
    ...new Set(Array.from(text, (letter) => letter.codePointAt(0)!)),
  ];
  const selected: T[number][] = [];
  for (const part of shards)
    if (points.some((point) => rangesContain(part.unicodeRanges, point)))
      selected.push(part);
  return selected;
}
export async function verifyFontBytes(
  bytes: ArrayBuffer,
  descriptor: { bytes: number; sha256: string },
): Promise<boolean> {
  if (bytes.byteLength !== descriptor.bytes) return false;
  const actual = Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
  return actual === descriptor.sha256;
}

export interface FontFaceInput {
  family: string;
  unicodeRanges: readonly string[];
  web?: { sha256: string };
}
const installedFaces = new Map<
  string,
  { promise: Promise<FontFace>; users: number }
>();
/** 返回真实注销函数；驻留与请求账本由调用方持有。 */
export async function installThreadFontFace(
  part: FontFaceInput,
  bytes: ArrayBuffer,
): Promise<() => void> {
  const key =
    (part.web?.sha256 ??
      Array.from(
        new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
        (b) => b.toString(16).padStart(2, "0"),
      ).join("")) +
    ":" +
    part.family;
  let entry = installedFaces.get(key);
  if (!entry) {
    const face = new FontFace(part.family, bytes, {
      unicodeRange: part.unicodeRanges.join(","),
      weight: "400",
      style: "normal",
      display: "swap",
    });
    entry = {
      users: 0,
      promise: face.load().then(() => {
        document.fonts.add(face);
        return face;
      }),
    };
    installedFaces.set(key, entry);
  }
  entry.users++;
  let face: FontFace;
  try {
    face = await entry.promise;
  } catch (error) {
    if (installedFaces.get(key) === entry) installedFaces.delete(key);
    throw error;
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--entry.users === 0) {
      document.fonts.delete(face);
      if (installedFaces.get(key) === entry) installedFaces.delete(key);
    }
  };
}

export function formatWenyou(value: string): string {
  try {
    return new Intl.NumberFormat("zh-CN").format(BigInt(value));
  } catch {
    return value;
  }
}

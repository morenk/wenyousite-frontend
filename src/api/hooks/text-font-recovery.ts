/** 字体元数据与字库使用相同的静默暂时错误分类；权威拒绝不无限重试。 */
export class FontMetadataError extends Error {
  constructor(readonly retryable: boolean, readonly retryAt?: number) { super("字体元数据暂不可用"); }
}
export function fontMetadataHttpError(response: Response) {
  const retryable=[408,429,500,502,503,504].includes(response.status);
  const retry=response.headers.get("retry-after");
  const at=retry?(/^\d+$/u.test(retry)?performance.now()+Number(retry)*1000:performance.now()+Math.max(0,Date.parse(retry)-Date.now())):undefined;
  return new FontMetadataError(retryable,Number.isFinite(at)?at:undefined);
}
export const fontMetadataRetry = (_count: number, error: unknown) => error instanceof FontMetadataError ? error.retryable : error instanceof TypeError || (error instanceof DOMException && error.name === "TimeoutError");
export function fontMetadataRetryDelay(attempt: number, error: unknown) {
  const ceiling=Math.min(60000,1000*2**Math.min(attempt,6));
  return Math.max(1,Math.floor(Math.random()*(ceiling+1)),error instanceof FontMetadataError&&error.retryAt?error.retryAt-performance.now():0);
}

import { getApiError } from "@/api/errors";

/** 网关可能返回 HTML 或空错误体；只向界面传递业务错误和简洁的恢复提示。 */
export async function adminTextFontData<T>(request: Promise<{
  data?: { data: T };
  error?: unknown;
  response?: Response;
}>): Promise<T> {
  let result;
  try {
    result = await request;
  } catch (error) {
    if (error instanceof TypeError || (error instanceof Error && error.name === "AbortError")) {
      throw new Error("连接中断，操作结果尚未确认。请读取最新状态后重试。");
    }
    throw error;
  }
  const { data, error, response } = result;
  if (data && !error) return data.data;
  const info = getApiError(error);
  if (info.code !== undefined) throw { ...info, status: response?.status ?? info.status };
  const status = response?.status ?? info.status;
  const message = status === 413
    ? "上传被大小限制拒绝，单个字体最大 64 MiB；未超限时请联系管理员检查上传服务。"
    : status === 408 || status === 504
      ? "请求超时，操作结果尚未确认。请读取最新状态后重试。"
      : status === 502 || status === 503
        ? "字体服务暂不可用，请读取最新状态后重试。"
        : "字体请求失败，请读取最新状态后重试。";
  throw { status, message };
}

import {
  expireAdminSession,
  getAdminSessionSnapshot,
  registerAdminRequest,
} from "@/lib/admin-session-store";

/** body 解析也属于请求生命周期：headers 到达不代表旧响应可以进入新会话缓存。 */
class AdminResponse extends Response {
  constructor(
    response: Response,
    private readonly current: () => void,
    private readonly release: () => void,
  ) {
    super(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  }
  private async consume<T>(read: () => Promise<T>): Promise<T> {
    try {
      const value = await read();
      this.current();
      return value;
    } finally {
      this.release();
    }
  }
  override json(): Promise<unknown> {
    return this.consume(() => super.json());
  }
  override text(): Promise<string> {
    return this.consume(() => super.text());
  }
  override blob(): Promise<Blob> {
    return this.consume(() => super.blob());
  }
  override arrayBuffer(): Promise<ArrayBuffer> {
    return this.consume(() => super.arrayBuffer());
  }
  override formData(): Promise<FormData> {
    return this.consume(() => super.formData());
  }
}
export async function fetchAdminRequest(
  request: Request,
  fetchImpl: typeof fetch,
): Promise<Response> {
  const generation = getAdminSessionSnapshot().generation;
  const controller = new AbortController();
  const unregister = registerAdminRequest(controller);
  const abort = () => controller.abort();
  const release = () => {
    unregister();
    request.signal.removeEventListener("abort", abort);
  };
  const current = () => {
    if (generation !== getAdminSessionSnapshot().generation)
      throw new DOMException("过期的管理请求", "AbortError");
  };
  request.signal.addEventListener("abort", abort, { once: true });
  if (request.signal.aborted) controller.abort();
  try {
    const response = await fetchImpl(
      new Request(request, { signal: controller.signal }),
    );
    current();
    if (response.status === 401) {
      let code: unknown;
      try {
        code = ((await response.clone().json()) as { code?: unknown }).code;
      } catch {
        /* 无结构错误由调用方处理。 */
      }
      current();
      if (code === 40117 || code === 40118) {
        release();
        expireAdminSession(generation, code === 40118 ? "expired" : undefined);
        return response;
      }
    }
    if (response.status === 204 || request.method === "HEAD") {
      release();
      return response;
    }
    return new AdminResponse(response, current, release);
  } catch (error) {
    release();
    throw error;
  }
}

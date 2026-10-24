import { fetchAdminRequest } from "@/api/admin-fetch";

export type UploadBytes = { loaded: number; total: number };
/** 作为 apiClient 的单次传输实现；请求头仍由统一中间件构造，会话切换仍中止请求。 */
export function adminUploadFetch(onProgress: (bytes: UploadBytes) => void): typeof fetch {
  const transport: typeof fetch = async (input, init) => {
    const request = input instanceof Request && !init ? input : new Request(input, init);
    const body = await request.arrayBuffer();
    if (request.signal.aborted) throw new DOMException("上传已中止", "AbortError");
    return new Promise<Response>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      let timer: ReturnType<typeof setTimeout>;
      let timedOut = false;
      let loaded = 0;
      const release = () => { clearTimeout(timer); request.signal.removeEventListener("abort", abort); };
      const abort = () => xhr.abort();
      // 与代理上游空闲限制一致；持续有进度的慢传不受绝对总时长限制。
      const renew = () => { clearTimeout(timer); timer = setTimeout(() => { timedOut = true; xhr.abort(); }, 120_000); };
      xhr.open(request.method, request.url);
      xhr.withCredentials = request.credentials !== "omit";
      request.headers.forEach((value, name) => xhr.setRequestHeader(name, value));
      xhr.upload.onprogress = (event) => {
        if (event.loaded > loaded) { loaded = event.loaded; renew(); }
        if (!request.signal.aborted && event.lengthComputable) onProgress({ loaded: event.loaded, total: event.total });
      };
      xhr.onload = () => {
        release();
        try {
        const headers = new Headers();
        for (const line of xhr.getAllResponseHeaders().trim().split(/[\r\n]+/)) {
          const at = line.indexOf(":");
          if (at > 0) headers.append(line.slice(0, at), line.slice(at + 1).trim());
        }
        resolve(new Response(xhr.status === 204 ? null : xhr.responseText, { status: xhr.status, statusText: xhr.statusText, headers }));
        } catch (error) { reject(error); }
      };
      xhr.onerror = () => { release(); reject(new TypeError("上传连接中断")); };
      xhr.ontimeout = () => { release(); reject(new TypeError("上传超时")); };
      xhr.onabort = () => { release(); reject(timedOut ? new TypeError("上传等待超时，结果尚未确认") : new DOMException("上传已中止", "AbortError")); };
      request.signal.addEventListener("abort", abort, { once: true });
      renew();
      try { xhr.send(body); } catch (error) { release(); reject(error); }
    });
  };
  return (input, init) => fetchAdminRequest(input instanceof Request && !init ? input : new Request(input, init), transport);
}

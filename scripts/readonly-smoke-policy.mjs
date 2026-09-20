const contentId = "c[a-z0-9]{24}";
const readingPaths = [
  /^\/api\/v1\/(health|meta|thread-categories)$/,
  /^\/api\/v1\/threads$/,
  new RegExp(`^/api/v1/threads/${contentId}$`, "i"),
  new RegExp(`^/api/v1/subthreads/${contentId}/posts(?:/authors)?$`, "i"),
];
const readQuery = new Set(["sort", "limit", "cursor", "category", "status", "order", "_rsc"]);

export function smokeOrigin(value = "https://wenyou.site") {
  let url;
  try { url = new URL(value); } catch { throw new Error("只读烟雾目标 URL 无效"); }
  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash
    || !["https:", "http:"].includes(url.protocol)
    || !(url.origin === "https://wenyou.site"
      || (url.protocol === "http:" && ["127.0.0.1", "[::1]"].includes(url.hostname)))) {
    throw new Error("只读烟雾目标必须为 wenyou.site 或显式本机 HTTP origin");
  }
  return url.origin;
}

/** 白名单故意只覆盖匿名首页、登录页和主题帖正文；未知 GET 也不得触达服务端。 */
export function isReadonlySmokeRequest(rawUrl, method, origin) {
  let url;
  try { url = new URL(rawUrl); } catch { return false; }
  if (!["GET", "HEAD"].includes(method) || url.origin !== origin
    || url.username || url.password || /%|\\/.test(url.pathname)) return false;
  if ([...url.searchParams.keys()].some((key) => !readQuery.has(key))) return false;
  const path = url.pathname;
  return path === "/" || path === "/login"
    || new RegExp(`^/threads/${contentId}$`, "i").test(path)
    || readingPaths.some((pattern) => pattern.test(path))
    || /^\/_next\/static\/[\w./-]+\.(js|css|woff2?|png|svg)$/.test(path)
    || /^\/(favicon\.ico|brand\/[\w/-]+\.svg)$/.test(path);
}

export function anonymousHeaders(headers) {
  const safe = Object.fromEntries(Object.entries(headers).filter(([key]) =>
    !/^(authorization|proxy-authorization|cookie|x-.*token|x-.*key)$/i.test(key)));
  // route.fetch 的独立请求上下文也不得从 cookie jar 补入会话。
  return { ...safe, cookie: "", authorization: "" };
}

export async function installReadonlySmokeGuard(context, origin) {
  const blocked = [];
  await context.routeWebSocket("**/*", (socket) => socket.close());
  await context.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (!isReadonlySmokeRequest(request.url(), request.method(), origin)) {
      // 匿名启动会探测 refresh；本地返回未登录，绝不发往线上。
      if (url.origin === origin && url.pathname === "/api/v1/auth/refresh") {
        await route.fulfill({ status: 401, json: { code: 401, message: "匿名只读烟雾", data: null } });
      } else {
        blocked.push({ method: request.method(), path: url.pathname });
        await route.abort("blockedbyclient");
      }
      return;
    }
    // Playwright 不保证重定向再次触发 route；因此不向浏览器转发任何重定向。
    try {
      const response = await route.fetch({ headers: anonymousHeaders(request.headers()), maxRedirects: 0, timeout: 15000 });
      await context.clearCookies();
      if (response.status() >= 300 && response.status() < 400) {
        blocked.push({ method: "REDIRECT_BLOCKED", path: url.pathname });
        await response.dispose();
        await route.abort("blockedbyclient");
        return;
      }
      const headers = { ...response.headers() };
      delete headers["set-cookie"];
      await route.fulfill({ response, headers });
      await response.dispose();
    } catch {
      blocked.push({ method: "NETWORK_ERROR", path: url.pathname });
      await route.abort().catch(() => {});
    }
  });
  return blocked;
}

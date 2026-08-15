#!/usr/bin/env node

const [, , baseUrlArgument, ...routeArguments] = process.argv;

if (!baseUrlArgument) {
  console.error("用法: node scripts/verify-static-assets.mjs <base-url> [route ...]");
  process.exit(2);
}

const baseUrl = new URL(baseUrlArgument);
const routes = routeArguments.length > 0 ? routeArguments : ["/", "/login"];
const assetPaths = new Set();

async function fetchChecked(url, expectedKind) {
  const response = await fetch(url, {
    cache: "no-store",
    redirect: "follow",
    signal: AbortSignal.timeout(5_000),
  });
  const contentType = response.headers.get("content-type") ?? "";

  if (response.status !== 200) {
    throw new Error(`${url} 返回 ${response.status} (${contentType || "无 Content-Type"})`);
  }

  if (expectedKind === "html" && !contentType.startsWith("text/html")) {
    throw new Error(`${url} 的 MIME 应为 text/html，实际为 ${contentType || "空"}`);
  }

  if (expectedKind === "css" && !contentType.startsWith("text/css")) {
    throw new Error(`${url} 的 MIME 应为 text/css，实际为 ${contentType || "空"}`);
  }

  if (
    expectedKind === "js" &&
    !contentType.startsWith("application/javascript") &&
    !contentType.startsWith("text/javascript")
  ) {
    throw new Error(`${url} 的 MIME 应为 JavaScript，实际为 ${contentType || "空"}`);
  }

  return response;
}

try {
  for (const route of routes) {
    const pageUrl = new URL(route, baseUrl);
    const response = await fetchChecked(pageUrl, "html");
    const html = await response.text();

    for (const match of html.matchAll(/\/_next\/static\/[^"'<>\s]+\.(?:css|js)(?:\?[^"'<>\s]*)?/g)) {
      assetPaths.add(match[0]);
    }
  }

  if (assetPaths.size === 0) {
    throw new Error(`页面 ${routes.join(", ")} 未引用任何 Next.js CSS/JS 静态资源`);
  }

  for (const assetPath of [...assetPaths].sort()) {
    const assetUrl = new URL(assetPath, baseUrl);
    const expectedKind = assetUrl.pathname.endsWith(".css") ? "css" : "js";
    await fetchChecked(assetUrl, expectedKind);
  }

  console.log(
    `静态资源验证通过: ${routes.length} 个页面, ${assetPaths.size} 个 CSS/JS (${baseUrl.origin})`,
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

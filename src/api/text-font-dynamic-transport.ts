import { apiClient } from "./client";
import { fontMetadataHttpError } from "./hooks/text-font-recovery";
import type { components } from "./types";
export type DynamicFontPage = components["schemas"]["FontCatalogPageDto"];
export async function fetchDynamicFontPage(
  cursor: string | undefined,
  etag: string | undefined,
  signal: AbortSignal,
) {
  const result = await apiClient.GET("/api/v1/meta/text-fonts/v2", {
    params: { query: { limit: 200, ...(cursor ? { cursor } : {}) } },
    signal,
    headers: etag ? { "If-None-Match": etag } : undefined,
  });
  if (result.response.status === 304)
    return { data: undefined, etag, unchanged: true };
  if (!result.data) throw fontMetadataHttpError(result.response);
  return {
    data: result.data.data,
    etag: result.response.headers.get("etag") ?? undefined,
    unchanged: false,
  };
}
export async function fetchDynamicFontDescriptor(
  versionId: string,
  etag: string | undefined,
  signal: AbortSignal,
) {
  const result = await apiClient.GET(
    "/api/v1/meta/text-fonts/v2/versions/{versionId}",
    {
      params: { path: { versionId } },
      signal,
      headers: etag ? { "If-None-Match": etag } : undefined,
    },
  );
  if (result.response.status === 304)
    return { data: undefined, etag, unchanged: true };
  if (!result.data) throw fontMetadataHttpError(result.response);
  return {
    data: result.data.data,
    etag: result.response.headers.get("etag") ?? undefined,
    unchanged: false,
  };
}
export async function fetchDynamicFontPolicy(signal: AbortSignal) {
  const result = await apiClient.GET(
    "/api/v1/meta/text-fonts/v2/runtime-policy",
    { signal },
  );
  if (!result.data) throw fontMetadataHttpError(result.response);
  return result.data.data;
}
/** 资源经过 apiClient 和按版本状态校验网关；响应流交给共享限额读取器。 */
export const dynamicFontAssetTransport: typeof fetch = async (input, init) => {
  const url = new URL(
    String(input),
    typeof location === "undefined" ? "http://localhost" : location.origin,
  );
  const match =
    /^\/api\/v1\/(meta\/text-fonts\/v2|admin\/text-fonts)\/versions\/(tfv_[a-f0-9]{32})\/assets\/([a-f0-9]{64}\.(?:woff2|ttf|otf|json|png))$/u.exec(
      url.pathname,
    );
  if (
    !match ||
    url.search ||
    url.hash ||
    (typeof location !== "undefined" && url.origin !== location.origin)
  )
    throw new Error("font-asset-path");
  const options = {
    params: { path: { versionId: match[2]!, asset: match[3]! } },
    signal: init?.signal,
    parseAs: "stream" as const,
  };
  const result =
    match[1] === "admin/text-fonts"
      ? await apiClient.GET(
          "/api/v1/admin/text-fonts/versions/{versionId}/assets/{asset}",
          options,
        )
      : await apiClient.GET(
          "/api/v1/meta/text-fonts/v2/versions/{versionId}/assets/{asset}",
          options,
        );
  return result.response;
};

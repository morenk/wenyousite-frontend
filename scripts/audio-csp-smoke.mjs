import assert from "node:assert/strict";

// 检查真实文档响应，不能用桶对象的 200/206 代替浏览器媒体许可。
export function assertAudioMediaPolicy(response) {
  assert.ok(response?.ok(), "页面响应必须成功");
  const csp = response.headers()["content-security-policy"];
  assert.ok(csp, "页面缺少 Content-Security-Policy");
  const policies = csp.split(",");
  for (const policy of policies) {
    const directive = policy.split(";").map((part) => part.trim())
      .find((part) => part.startsWith("media-src "));
    assert.ok(directive, "页面 CSP 缺少 media-src");
    assert.deepEqual(new Set(directive.split(/\s+/).slice(1)),
      new Set(["'self'", "blob:", "https://cn-nb1.rains3.com"]),
      "音频必须允许固定 RainS3 源，且不能拓宽媒体许可");
  }
}

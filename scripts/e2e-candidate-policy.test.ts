// @vitest-environment node
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { assertBrowserArguments, assertCandidateBuild, assertCandidateResponse, assertDeployableBuild, candidateHeaders, candidateOptions, isolatedOrigin } from "./e2e-candidate-policy.mjs";

const roots: string[] = [];
const candidateId = "12345678-1234-1234-1234-123456789012";
function build(destination = "http://127.0.0.1:39100/api/v1/:path*") {
  const root = mkdtempSync(join(tmpdir(), "web-e2e-policy-"));
  roots.push(root);
  writeFileSync(join(root, "BUILD_ID"), `e2e-${candidateId}`);
  writeFileSync(join(root, "routes-manifest.json"), JSON.stringify({ rewrites: { beforeFiles: [], afterFiles: [{ source: "/api/v1/:path*", destination }], fallback: [] } }));
  writeFileSync(join(root, "required-server-files.json"), JSON.stringify({ config: { distDir: ".next-e2e" } }));
  return root;
}
afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true })));
describe("隔离候选构建身份", () => {
  test("保留用例筛选，拒绝长短别名替换配置、报告或断言", () => {
    expect(() => assertBrowserArguments(["e2e/s5/", "--grep", "保存", "--project=chromium", "--matrix"])).not.toThrow();
    for (const arg of ["-c", "--config=other.ts", "--reporter=html", "--trace=on", "-u", "--ignore-snapshots", "--ui", "--output=public"]) {
      expect(() => assertBrowserArguments([arg, "other.ts"])).toThrow();
    }
  });
  test.each([undefined, "https://wenyou.site", "http://127.0.0.1:3000", "http://127.0.0.1:3001", "http://localhost:3100", "http://user:secret@127.0.0.1:39100", "http://127.0.0.1:39100/api/v1"])("拒绝线上或不确定目标 %s", (origin) => {
    expect(() => isolatedOrigin(origin)).toThrow();
  });
  test("生产构建保持默认目录，隔离构建拥有独立目录和可识别 Build ID", async () => {
    expect(candidateOptions({})).toEqual({});
    expect(() => candidateOptions({ WENYOU_E2E_CANDIDATE_ID: candidateId })).toThrow();
    const options = candidateOptions({ WENYOU_E2E_CANDIDATE_ID: candidateId, BACKEND_URL: "http://127.0.0.1:39100" });
    expect(options.distDir).toBe(".next-e2e");
    expect(await options.generateBuildId?.()).toBe(`e2e-${candidateId}`);
  });
  test("拒绝启动变量正确但构建 rewrites 指向线上的候选", () => {
    expect(() => assertCandidateBuild(build("http://127.0.0.1:3000/api/v1/:path*"), candidateId, "http://127.0.0.1:39100")).toThrow(/rewrites/);
    expect(assertCandidateBuild(build(), candidateId, "http://127.0.0.1:39100")).toBe(`e2e-${candidateId}`);
    expect(() => assertCandidateBuild(build(), "other-run", "http://127.0.0.1:39100")).toThrow();
  });
  test("复制或改名不能把 E2E 构建变成可部署产物", () => {
    const root = build();
    expect(() => assertDeployableBuild(root)).toThrow();
    writeFileSync(join(root, "required-server-files.json"), JSON.stringify({ config: { distDir: ".next" } }));
    expect(() => assertDeployableBuild(root)).toThrow();
    writeFileSync(join(root, "BUILD_ID"), "production-id");
    expect(() => assertDeployableBuild(root)).not.toThrow();
  });
  test("拒绝额外 rewrite 覆盖部分写入路径，即使通用 API 路由正确", () => {
    const root = build();
    writeFileSync(join(root, "routes-manifest.json"), JSON.stringify({ rewrites: [
      { source: "/api/v1/threads/:path*", destination: "http://127.0.0.1:3000/api/v1/threads/:path*" },
      { source: "/api/v1/:path*", destination: "http://127.0.0.1:39100/api/v1/:path*" },
    ] }));
    expect(() => assertCandidateBuild(root, candidateId, "http://127.0.0.1:39100")).toThrow(/rewrites/);
  });
  test("候选端口被旧服务复用时拒绝其响应，生产构建不发布测试身份", () => {
    expect(candidateHeaders({})).toEqual([]);
    expect(candidateHeaders({ WENYOU_E2E_CANDIDATE_ID: candidateId, BACKEND_URL: "http://127.0.0.1:39100" }))
      .toEqual([{ key: "X-Wenyou-E2E-Candidate", value: candidateId }]);
    expect(() => assertCandidateResponse(new Response("ok"), candidateId)).toThrow();
    expect(() => assertCandidateResponse(new Response("ok", { headers: { "x-wenyou-e2e-candidate": "old-run" } }), candidateId)).toThrow();
    expect(() => assertCandidateResponse(new Response("ok", { headers: { "x-wenyou-e2e-candidate": candidateId } }), candidateId)).not.toThrow();
  });
});

import { expect, test } from "vitest";
import policy from "../../../contracts/thread-font-runtime-policy-v2.json";
import fixtures from "../../../contracts/thread-font-runtime-policy-v2-fixtures.json";
import catalogSource from "../../../contracts/thread-font-catalog-v1.json";
import { fontSessionPolicy } from "../thread-font-policy";
import type { ThreadFontCatalog } from "../thread-font-protocol";
const catalog = { ...catalogSource, assetBaseUrl: "https://assets.wenyou.site/", manifest: { path: `fonts/v1/${policy.manifestSha256}.json`, sha256: policy.manifestSha256, bytes: 5031019 } } as ThreadFontCatalog;
test("官方策略同 manifest 绑定才开启；旧后端、未知版本、空源与错绑不放宽旧限额", () => {
 for (const fixture of fixtures.activationCases) {
  const value = fixture.endpoint === "404" ? null : { ...policy, policyVersion: fixture.supported ? 2 : 3 };
  const source = { ...catalog, assetBaseUrl: fixture.baseConfigured ? catalog.assetBaseUrl : null, manifest: { ...catalog.manifest!, sha256: fixture.manifestMatches ? policy.manifestSha256 : "0".repeat(64) } };
  expect(fontSessionPolicy(value, source) !== null, fixture.id).toBe(fixture.expected === "v2");
 }
 expect(fontSessionPolicy(policy, catalog)).toMatchObject({ residency: { families: 29, faces: 64, bytes: 16777216, originalBytes: 18410600 }, download: {windowMs:60000,requestsPerWindow:64} });
});
test("拒绝远端扩大预算、未知模式、额外字段与替换原件身份", () => {
 for (const change of [
  (p: typeof policy) => { p.web.residency.maxFamilies = 100; },
  (p: typeof policy) => { p.web.residency.maxSfntBytes++; },
  (p: typeof policy) => { p.web.network.maxRequests++; },
  (p: typeof policy) => { p.web.network.windowMs--; },
  (p: typeof policy) => { p.originalAsset.sha256 = "0".repeat(64); },
  (p: typeof policy) => { p.originalAsset.maxResidentCopies++; },
  (p: typeof policy) => { p.retry.delayCeilingsMs = [1]; },
  (p: typeof policy) => { p.web.residency.mode = "unbounded"; },
  (p: typeof policy) => { Object.assign(p, { extraBudget: 10000000 }); },
 ]) { const value = structuredClone(policy); change(value); expect(fontSessionPolicy(value, catalog)).toBeNull(); }
});

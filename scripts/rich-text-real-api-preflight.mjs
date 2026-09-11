import { execFileSync } from "node:child_process";

export const candidateSha = "6859f00c305b7c63a62fc2d3f709d811c55f2dc0";
const git = (...args) => execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
const configured = (name) => {
  const value = process.env[name]?.trim() ?? "";
  return Boolean(value) && !value.includes("example.invalid") && !value.startsWith("replace-with-");
};

try {
  const backend = new URL(process.env.BACKEND_URL || "http://127.0.0.1:3000");
  if (!new Set(["127.0.0.1", "localhost", "[::1]"]).has(backend.hostname)
    || backend.username || backend.password || backend.search || backend.hash || backend.pathname !== "/") {
    throw new Error("invalid-loopback-api");
  }
  const expectedApiSha = process.env.RICH_TEXT_EXPECTED_API_SHA;
  if (!/^[a-f0-9]{40}$/u.test(expectedApiSha ?? "")) throw new Error("expected-api-sha-required");
  const unchanged = git("diff", candidateSha, "--", "src", "public", "package.json", "pnpm-lock.yaml", "next.config.ts", "postcss.config.mjs", "tsconfig.json") === "";
  const untracked = git("ls-files", "--others", "--exclude-standard", "--", "src", "public");
  if (!unchanged || untracked) throw new Error("candidate-runtime-source-drift");
  const response = await fetch(new URL("/api/v1/meta", backend), { signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error("api-meta-unavailable");
  const { data } = await response.json();
  if (data?.buildSha !== expectedApiSha) throw new Error("api-sha-mismatch");
  const credentials = { E2E_EMAIL: configured("E2E_EMAIL"), E2E_PASSWORD: configured("E2E_PASSWORD") };
  const ready = Object.values(credentials).every(Boolean);
  console.log(JSON.stringify({ status: ready ? "ready" : "blocked-credentials", candidateSha,
    harnessSha: git("rev-parse", "HEAD"), apiSha: data.buildSha, markdownContractVersion: data.markdownContractVersion,
    apiOrigin: backend.origin, credentials }));
  if (process.argv.includes("--require-credentials") && !ready) process.exitCode = 2;
} catch (error) {
  const allowed = new Set(["invalid-loopback-api", "expected-api-sha-required", "candidate-runtime-source-drift", "api-meta-unavailable", "api-sha-mismatch"]);
  console.error(JSON.stringify({ status: "blocked", reason: allowed.has(error?.message) ? error.message : "preflight-failed" }));
  process.exitCode = 1;
}
